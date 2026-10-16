import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadScope, loanScope } from "@/lib/scope";
import { readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document?.storageKey) return NextResponse.json({ error: "File not found." }, { status: 404 });

  if (document.loanCaseId) {
    const loan = await prisma.loanCase.findFirst({ where: { id: document.loanCaseId, ...loanScope(user) } });
    if (!loan) return NextResponse.json({ error: "File not found." }, { status: 404 });
  } else if (document.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: document.leadId, ...leadScope(user) } });
    if (!lead) return NextResponse.json({ error: "File not found." }, { status: 404 });
  } else {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  try {
    const bytes = await readStoredFile(document.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(document.fileName || "document").replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
