import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createLeadRecord } from "@/lib/leads";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  source: z.string().min(2).default("Website"),
  category: z.string().min(2),
  productName: z.string().min(2),
  state: z.string().min(2),
  district: z.string().min(2),
  city: z.string().min(2),
  loanRequired: z.boolean().optional(),
  loanAmount: z.number().optional(),
  requirementText: z.string().optional(),
});

export async function POST(request: Request) {
  const key = request.headers.get("x-api-key");
  if (!process.env.INTAKE_API_KEY || key !== process.env.INTAKE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit("intake", 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const actor = await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!actor) return NextResponse.json({ error: "CRM is not ready" }, { status: 503 });

  const result = await createLeadRecord(
    { id: actor.id, name: actor.name, email: actor.email, role: actor.role, dealerId: null, vendorId: null },
    {
      ...parsed.data,
      loanRequired: parsed.data.loanRequired ?? false,
      loanAmount: parsed.data.loanAmount ?? null,
      budget: null,
      priority: "WARM",
      duplicateChoice: "lead",
      assignedToId: null,
    },
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ leadId: result.code, id: result.id });
}
