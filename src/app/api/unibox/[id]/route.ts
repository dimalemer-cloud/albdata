import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyInterest } from "@/lib/engine/classify";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const t = await db.thread.findUnique({
    where: { id },
    include: {
      account: { select: { email: true, fromName: true } },
      campaign: { select: { id: true, name: true } },
      lead: true,
      messages: { orderBy: { sentAt: "asc" }, where: { isBounce: false } },
    },
  });
  if (!t) throw new HttpError(404, "Conversation not found");
  if (t.unread) await db.thread.update({ where: { id }, data: { unread: false } });
  const deal = t.leadId ? await db.deal.findFirst({ where: { leadId: t.leadId } }) : null;
  return { ...t, deal };
});

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = z.object({ interest: z.string().nullable().optional(), unread: z.boolean().optional(), archived: z.boolean().optional() }).parse(await req.json());
  if (b.interest) await applyInterest(id, b.interest);
  else if (b.interest === null) await db.thread.update({ where: { id }, data: { interest: null } });
  const { interest: _i, ...rest } = b;
  if (Object.keys(rest).length) await db.thread.update({ where: { id }, data: rest });
  return { ok: true };
});
