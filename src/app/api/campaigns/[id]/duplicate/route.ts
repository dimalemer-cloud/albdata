import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const c = await db.campaign.findUniqueOrThrow({ where: { id }, include: { steps: { include: { variants: true } }, accounts: true } });
  const { id: _id, createdAt: _c, launchedAt: _l, status: _s, steps, accounts, ...rest } = c;
  return db.campaign.create({
    data: {
      ...rest,
      name: `${c.name} (copy)`,
      steps: { create: steps.map((s) => ({ order: s.order, delayDays: s.delayDays, variants: { create: s.variants.map((v) => ({ label: v.label, subject: v.subject, body: v.body, enabled: v.enabled })) } })) },
      accounts: { create: accounts.map((a) => ({ accountId: a.accountId })) },
    },
  });
});
