import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { daily, stepBreakdown, totals } from "@/lib/analytics";

export const GET = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const [t, d, b, statuses] = await Promise.all([
    totals([id]),
    daily([id], 30),
    stepBreakdown(id),
    db.campaignLead.groupBy({ by: ["status"], where: { campaignId: id }, _count: { _all: true } }),
  ]);
  return { totals: t, daily: d, breakdown: b, leadStatuses: Object.fromEntries(statuses.map((s) => [s.status, s._count._all])) };
});
