"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, Stat } from "@/components/ui";
import { DailyChart, type DayPoint } from "@/components/charts";
import type { Totals } from "@/lib/analytics";
import { pct } from "@/lib/utils";
import type { CampaignFull } from "./types";

type Data = { totals: Totals; daily: DayPoint[]; breakdown: { steps: Record<string, Record<string, number>>; variants: Record<string, Record<string, number>> }; leadStatuses: Record<string, number> };

export function StatGrid({ t }: { t: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat label="Emails sent" value={t.sent.toLocaleString()} sub={`${t.contacted} leads contacted`} />
      <Stat label="Opened" value={`${t.openRate}%`} sub={`${t.opened} unique opens`} />
      <Stat label="Replied" value={`${t.replyRate}%`} sub={`${t.replied} replies`} color="#7c3aed" />
      <Stat label="Interested" value={t.interested} sub={`${t.positiveRate}% of replies`} color="#059669" />
      <Stat label="Clicked" value={`${t.clickRate}%`} sub={`${t.clicked} clicks`} />
      <Stat label="Bounced" value={`${t.bounceRate}%`} sub={`${t.bounced} bounced · ${t.unsubscribed} unsubscribed`} color={t.bounceRate > 3 ? "#dc2626" : undefined} />
    </div>
  );
}

export function CampaignAnalytics({ campaign }: { campaign: CampaignFull }) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    api<Data>(`/api/campaigns/${campaign.id}/analytics`).then(setD);
  }, [campaign.id]);
  if (!d) return <div className="text-sm text-slate-400">Loading analytics…</div>;
  const ls = d.leadStatuses;
  return (
    <div className="space-y-4">
      <StatGrid t={d.totals} />
      <Card title="Last 30 days"><div className="p-3"><DailyChart data={d.daily} /></div></Card>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Step & A/B variant performance">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>Step</th><th>Variant</th><th>Sent</th><th>Opened</th><th>Replied</th><th>Clicked</th></tr></thead>
              <tbody>
                {campaign.steps.map((s, i) =>
                  s.variants.map((v, j) => {
                    const m = (v.id && d.breakdown.variants[v.id]) || {};
                    const sent = m.SENT || 0;
                    return (
                      <tr key={v.id || `${i}-${j}`}>
                        <td>{j === 0 ? `Step ${i + 1}` : ""}</td>
                        <td><span className="font-medium">{v.label}</span> <span className="text-xs text-slate-500">{v.subject?.slice(0, 40) || (i > 0 ? "(thread reply)" : "")}</span></td>
                        <td>{sent}</td>
                        <td>{m.OPEN || 0} <span className="text-xs text-slate-400">{pct(m.OPEN || 0, sent)}%</span></td>
                        <td>{m.REPLY || 0} <span className="text-xs text-slate-400">{pct(m.REPLY || 0, sent)}%</span></td>
                        <td>{m.CLICK || 0}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Lead status">
          <div className="space-y-2 p-4 text-sm">
            {[
              ["In sequence", ls.ACTIVE || 0, "rgb(var(--brand))"],
              ["Completed", ls.COMPLETED || 0, "#64748b"],
              ["Replied", ls.REPLIED || 0, "#7c3aed"],
              ["Bounced", ls.BOUNCED || 0, "#dc2626"],
              ["Unsubscribed", ls.UNSUBSCRIBED || 0, "#f97316"],
              ["Paused", ls.PAUSED || 0, "#eab308"],
              ["Error", ls.ERROR || 0, "#991b1b"],
            ].map(([label, n, color]) => (
              <div key={label as string} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color as string }} />{label}</span>
                <span className="font-medium">{n as number}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
