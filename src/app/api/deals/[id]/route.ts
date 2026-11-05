import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = z.object({ title: z.string().optional(), value: z.coerce.number().optional(), stage: z.string().optional(), notes: z.string().optional(), position: z.number().optional(), clientId: z.string().nullish() }).parse(await req.json());
  const deal = await db.deal.update({ where: { id }, data: b });
  if (b.stage && deal.leadId) {
    const map: Record<string, string> = { won: "WON", lost: "LOST", meeting: "MEETING_BOOKED", interested: "INTERESTED" };
    if (map[b.stage]) await db.lead.update({ where: { id: deal.leadId }, data: { status: map[b.stage] as never } });
  }
  return deal;
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.deal.delete({ where: { id } });
  return { ok: true };
});
