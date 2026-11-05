import { format } from "date-fns";
import { db } from "@/lib/db";
import { campaignRows, daily, totals } from "@/lib/analytics";
import { Card, StatusBadge, Badge } from "@/components/ui";
import { DailyChart } from "@/components/charts";
import { StatGrid } from "@/components/campaigns/CampaignAnalytics";

export async function ReportView({ clientId }: { clientId: string }) {
  const campaigns = await db.campaign.findMany({ where: { clientId }, select: { id: true } });
  const ids = campaigns.map((c) => c.id);
  const [t, d, rows, positives, deals] = await Promise.all([
    totals(ids),
    daily(ids, 30),
    campaignRows(ids),
    db.thread.findMany({
      where: { campaignId: { in: ids }, interest: { in: ["INTERESTED", "MEETING_BOOKED"] } },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      include: { lead: true, campaign: { select: { name: true } }, messages: { where: { direction: "INBOUND", isAutoReply: false }, orderBy: { sentAt: "desc" }, take: 1 } },
    }),
    db.deal.groupBy({ by: ["stage"], where: { clientId }, _count: { _all: true }, _sum: { value: true } }),
  ]);
  const meetings = deals.find((x) => x.stage === "meeting")?._count._all ?? 0;
  const won = deals.find((x) => x.stage === "won")?._count._all ?? 0;
  return (
    <div className="space-y-4">
      <StatGrid t={t} />
      <div className="grid gap-3 md:grid-cols-3">
        <Card><div className="p-4"><div className="text-xs text-slate-500">Positive replies</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{positives.length}</div></div></Card>
        <Card><div className="p-4"><div className="text-xs text-slate-500">Meetings booked</div><div className="mt-1 text-2xl font-semibold text-blue-600">{meetings}</div></div></Card>
        <Card><div className="p-4"><div className="text-xs text-slate-500">Deals won</div><div className="mt-1 text-2xl font-semibold">{won}</div></div></Card>
      </div>
      <Card title="Activity — last 30 days"><div className="p-3"><DailyChart data={d} /></div></Card>
      <Card title="Campaigns">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr><th>Campaign</th><th>Status</th><th>Leads</th><th>Sent</th><th>Open rate</th><th>Replies</th><th>Interested</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.leads}</td>
                  <td>{r.sent}</td>
                  <td>{r.openRate}%</td>
                  <td>{r.replied}</td>
                  <td className="font-medium text-emerald-600">{r.interested}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No campaigns yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Interested leads">
        <div className="divide-y divide-slate-100">
          {positives.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.contactName || p.contactEmail}</span>
                {p.lead?.companyName && <span className="text-sm text-slate-500">· {p.lead.companyName}</span>}
                <StatusBadge status={p.interest} />
                {p.campaign && <Badge>{p.campaign.name}</Badge>}
                <span className="ml-auto text-xs text-slate-400">{format(p.lastMessageAt, "MMM d")}</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{p.contactEmail}{p.lead?.phone ? ` · ${p.lead.phone}` : ""}</div>
              {p.messages[0] && <p className="mt-1 line-clamp-2 text-sm text-slate-600">“{p.messages[0].bodyText.split(/\nOn .*wrote:|\n>/)[0].trim().slice(0, 280)}”</p>}
            </div>
          ))}
          {!positives.length && <div className="py-8 text-center text-sm text-slate-400">No interested leads yet</div>}
        </div>
      </Card>
    </div>
  );
}
