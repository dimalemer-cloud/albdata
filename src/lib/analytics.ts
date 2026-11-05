import { Prisma } from "@prisma/client";
import { db } from "./db";
import { pct } from "./utils";

export type Totals = {
  sent: number; contacted: number; opened: number; clicked: number; replied: number; autoReplies: number;
  bounced: number; unsubscribed: number; interested: number;
  openRate: number; clickRate: number; replyRate: number; bounceRate: number; positiveRate: number;
};

function where(campaignIds: string[] | null, since?: Date): Prisma.EventWhereInput {
  return { ...(campaignIds ? { campaignId: { in: campaignIds } } : { campaignId: { not: null } }), ...(since ? { createdAt: { gte: since } } : {}) };
}

export async function totals(campaignIds: string[] | null, since?: Date): Promise<Totals> {
  if (campaignIds && !campaignIds.length) return emptyTotals();
  const w = where(campaignIds, since);
  const [groups, contacted] = await Promise.all([
    db.event.groupBy({ by: ["type"], where: w, _count: { _all: true } }),
    db.event.findMany({ where: { ...w, type: "SENT" }, distinct: ["campaignLeadId"], select: { campaignLeadId: true } }),
  ]);
  const c = (t: string) => groups.find((g) => g.type === t)?._count._all ?? 0;
  const sent = c("SENT");
  const leads = contacted.length;
  return {
    sent,
    contacted: leads,
    opened: c("OPEN"),
    clicked: c("CLICK"),
    replied: c("REPLY"),
    autoReplies: c("AUTO_REPLY"),
    bounced: c("BOUNCE"),
    unsubscribed: c("UNSUBSCRIBE"),
    interested: c("INTERESTED"),
    openRate: pct(c("OPEN"), sent),
    clickRate: pct(c("CLICK"), sent),
    replyRate: pct(c("REPLY"), leads),
    bounceRate: pct(c("BOUNCE"), sent),
    positiveRate: pct(c("INTERESTED"), c("REPLY")),
  };
}

export function emptyTotals(): Totals {
  return { sent: 0, contacted: 0, opened: 0, clicked: 0, replied: 0, autoReplies: 0, bounced: 0, unsubscribed: 0, interested: 0, openRate: 0, clickRate: 0, replyRate: 0, bounceRate: 0, positiveRate: 0 };
}

export type DayPoint = { date: string; sent: number; opened: number; replied: number; clicked: number; bounced: number; interested: number };

export async function daily(campaignIds: string[] | null, days = 30): Promise<DayPoint[]> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  if (campaignIds && !campaignIds.length) return fillDays([], since, days);
  const filter = campaignIds ? Prisma.sql`AND "campaignId" IN (${Prisma.join(campaignIds)})` : Prisma.sql`AND "campaignId" IS NOT NULL`;
  const rows = await db.$queryRaw<{ d: string; type: string; c: number }[]>`
    SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS d, type, count(*)::int AS c
    FROM "Event" WHERE "createdAt" >= ${since} ${filter}
    GROUP BY 1, 2`;
  return fillDays(rows, since, days);
}

function fillDays(rows: { d: string; type: string; c: number }[], since: Date, days: number): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const get = (t: string) => rows.find((r) => r.d === d && r.type === t)?.c ?? 0;
    out.push({ date: d, sent: get("SENT"), opened: get("OPEN"), replied: get("REPLY"), clicked: get("CLICK"), bounced: get("BOUNCE"), interested: get("INTERESTED") });
  }
  return out;
}

export async function stepBreakdown(campaignId: string) {
  const [byStep, byVariant] = await Promise.all([
    db.event.groupBy({ by: ["stepIndex", "type"], where: { campaignId }, _count: { _all: true } }),
    db.event.groupBy({ by: ["variantId", "type"], where: { campaignId, variantId: { not: null } }, _count: { _all: true } }),
  ]);
  const steps = new Map<number, Record<string, number>>();
  for (const g of byStep) {
    if (g.stepIndex == null) continue;
    const s = steps.get(g.stepIndex) || {};
    s[g.type] = g._count._all;
    steps.set(g.stepIndex, s);
  }
  const variants = new Map<string, Record<string, number>>();
  for (const g of byVariant) {
    if (!g.variantId) continue;
    const v = variants.get(g.variantId) || {};
    v[g.type] = g._count._all;
    variants.set(g.variantId, v);
  }
  return { steps: Object.fromEntries(steps), variants: Object.fromEntries(variants) };
}

export async function campaignRows(campaignIds?: string[]) {
  const campaigns = await db.campaign.findMany({
    where: campaignIds ? { id: { in: campaignIds } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { client: true, _count: { select: { leads: true } } },
  });
  const ids = campaigns.map((c) => c.id);
  const groups = ids.length ? await db.event.groupBy({ by: ["campaignId", "type"], where: { campaignId: { in: ids } }, _count: { _all: true } }) : [];
  const done = ids.length
    ? await db.campaignLead.groupBy({ by: ["campaignId"], where: { campaignId: { in: ids }, status: { not: "ACTIVE" } }, _count: { _all: true } })
    : [];
  const contacted = ids.length
    ? await db.campaignLead.groupBy({ by: ["campaignId"], where: { campaignId: { in: ids }, currentStep: { gt: 0 } }, _count: { _all: true } })
    : [];
  return campaigns.map((c) => {
    const g = (t: string) => groups.find((x) => x.campaignId === c.id && x.type === t)?._count._all ?? 0;
    const sent = g("SENT");
    const leadsContacted = contacted.find((d) => d.campaignId === c.id)?._count._all ?? 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      client: c.client?.name ?? null,
      clientId: c.clientId,
      leads: c._count.leads,
      completedLeads: done.find((d) => d.campaignId === c.id)?._count._all ?? 0,
      sent,
      opened: g("OPEN"),
      replied: g("REPLY"),
      interested: g("INTERESTED"),
      bounced: g("BOUNCE"),
      openRate: pct(g("OPEN"), sent),
      replyRate: pct(g("REPLY"), leadsContacted),
      createdAt: c.createdAt.toISOString(),
    };
  });
}
