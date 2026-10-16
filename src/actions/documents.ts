"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { leadScope, loanScope } from "@/lib/scope";
import { saveFile } from "@/lib/storage";
import { DOCUMENT_STATUSES } from "@/lib/constants";

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function saveDocument(formData: FormData) {
  const user = await requireAction("documents.write");
  if (!user) return { error: "You cannot update documents." };
  const loanCaseId = String(formData.get("loanCaseId") || "");
  const docType = String(formData.get("docType") || "");
  const status = String(formData.get("status") || "Uploaded");
  const notes = String(formData.get("notes") || "").trim();
  if (!(DOCUMENT_STATUSES as readonly string[]).includes(status)) return { error: "Unknown document status." };

  const loan = await prisma.loanCase.findFirst({ where: { id: loanCaseId, ...loanScope(user) } });
  if (!loan) return { error: "Case not found." };

  const file = formData.get("file");
  let storageKey: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) return { error: "File must be under 8 MB." };
    if (!ALLOWED.has(file.type)) return { error: "Upload a PDF, JPG, PNG, or WebP file." };
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storageKey = `${loan.id}/${randomUUID()}-${safeName}`;
    await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));
    fileName = file.name;
    mimeType = file.type;
    sizeBytes = file.size;
  }

  const openRow = await prisma.document.findFirst({
    where: { loanCaseId: loan.id, docType, storageKey: null },
    orderBy: { createdAt: "asc" },
  });

  if (openRow) {
    await prisma.document.update({
      where: { id: openRow.id },
      data: {
        status: storageKey ? status : status,
        notes: notes || openRow.notes,
        storageKey: storageKey || openRow.storageKey,
        fileName: fileName || openRow.fileName,
        mimeType: mimeType || openRow.mimeType,
        sizeBytes: sizeBytes || openRow.sizeBytes,
        uploadedById: storageKey ? user.id : openRow.uploadedById,
      },
    });
  } else if (storageKey) {
    const latest = await prisma.document.findFirst({
      where: { loanCaseId: loan.id, docType },
      orderBy: { version: "desc" },
    });
    await prisma.document.create({
      data: {
        loanCaseId: loan.id,
        leadId: loan.leadId,
        docType,
        status,
        notes: notes || null,
        storageKey,
        fileName,
        mimeType,
        sizeBytes,
        version: (latest?.version ?? 0) + 1,
        uploadedById: user.id,
      },
    });
  } else {
    return { error: "Choose a file or update an existing checklist row." };
  }

  await writeAudit(prisma, {
    userId: user.id,
    entity: "document",
    entityId: loan.id,
    action: "document.update",
    changes: [{ field: docType, newValue: status }],
  });

  revalidatePath(`/loans/${loan.id}`);
  revalidatePath("/dashboard");
  return { error: "" };
}

export async function saveChecklistDocument(formData: FormData) {
  const user = await requireAction("documents.write");
  if (!user) return;
  const documentId = String(formData.get("documentId") || "");
  const status = String(formData.get("status") || "Uploaded");
  if (!(DOCUMENT_STATUSES as readonly string[]).includes(status)) return;
  const document = await prisma.document.findFirst({
    where: { id: documentId, loanCaseId: null, lead: leadScope(user) },
  });
  if (!document?.leadId) return;

  const file = formData.get("file");
  let storageKey = document.storageKey;
  let fileName = document.fileName;
  let mimeType = document.mimeType;
  let sizeBytes = document.sizeBytes;
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024 || !ALLOWED.has(file.type)) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storageKey = `leads/${document.leadId}/${randomUUID()}-${safeName}`;
    await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));
    fileName = file.name;
    mimeType = file.type;
    sizeBytes = file.size;
  }

  await prisma.document.update({
    where: { id: document.id },
    data: {
      status,
      storageKey,
      fileName,
      mimeType,
      sizeBytes,
      uploadedById: file instanceof File && file.size > 0 ? user.id : document.uploadedById,
    },
  });
  await writeAudit(prisma, {
    userId: user.id,
    entity: "document",
    entityId: document.leadId,
    action: "document.checklist",
    changes: [{ field: document.docType, oldValue: document.status, newValue: status }],
  });
  revalidatePath(`/leads/${document.leadId}`);
  revalidatePath("/pipeline");
}
