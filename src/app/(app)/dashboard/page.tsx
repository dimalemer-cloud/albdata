import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { campaignRows, daily, totals } from "@/lib/analytics";
import { getSecrets } from "@/lib/workspace";
import { requireTeam } from "@/lib/auth";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { DailyChart } from "@/components/charts";
import { StatGrid } from "@/components/campaigns/CampaignAnalytics";
import { startOfUtcDay } from "@/lib/schedule";

export default async function Dashboard() {
  const s = await requireTeam();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [t, d, rows, accounts, sentToday, replies, lists, secrets, warmupOn] = await Promise.all([
    totals(null, since),
    daily(null, 30),
    campaignRows(),
    db.emailAccount.findMany({ select: { id: true, status: true, dailyLimit: true, warmupEnabled: true } }),
    db.event.count({ where: { type: "SENT", createdAt: { gte: startOfUtcDay() } } }),
    db.thread.findMany({ where: { hasReply: true, archived: false }, orderBy: { lastMessageAt: "desc" }, take: 6, include: { campaign: { select: { name: true } } } }),
    db.leadList.count(),
    getSecrets(),
    db.emailAccount.count({ where: { warmupEnabled: true } }),
  ]);
  const capacity = accounts.filter((a) => a.status === "ACTIVE").reduce((x, a) => x + a.dailyLimit, 0);
  const errors = accounts.filter((a) => a.status === "ERROR").length;
  const checklist = [
    { done: accounts.length > 0, label: "Connect a sending inbox", href: "/accounts" },
    { done: warmupOn >= 2, label: "Turn on warmup for 2+ inboxes", href: "/warmup" },
    { done: lists > 0, label: "Find or import leads", href: "/finder" },
    { done: rows.length > 0, label: "Create a campaign", href: "/campaigns" },
    { done: rows.some((r) => r.status === "ACTIVE" || r.status === "COMPLETED"), label: "Launch it", href: "/campaigns" },
    { done: !!secrets.anthropicKey, label: "Add your Claude API key for AI features", href: "/settings" },
  ];
  const allDone = checklist.every((c) => c.done);
  return (
    <div className="space-y-4">
      <PageHeader title={`Welcome back, ${s.name.split(" ")[0]}`} subtitle={`${sentToday} emails sent today · ${capacity}/day capacity across ${accounts.filter((a) => a.status === "ACTIVE").length} inboxes${errors ? ` · ${errors} inbox${errors > 1 ? "es" : ""} need attention` : ""}`} />
      {!allDone && (
        <Card title="Get set up">
          <div className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((c) => (
              <Link key={c.label} href={c.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                <span className={c.done ? "text-slate-400 line-through" : "text-slate-800"}>{c.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
      <StatGrid t={t} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card title="Last 30 days"><div className="p-3"><DailyChart data={d} /></div></Card>
        <Card title="Latest replies" actions={<Link href="/unibox" className="text-xs text-brand">Open Unibox</Link>}>
          <div className="divide-y divide-slate-100">
            {replies.map((r) => (
              <Link key={r.id} href="/unibox" className="block px-4 py-2.5 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  {r.unread && <span className="h-2 w-2 rounded-full bg-brand" />}
                  <span className="flex-1 truncate text-sm font-medium">{r.contactName || r.contactEmail}</span>
                  <span className="text-[11px] text-slate-400">{formatDistanceToNow(r.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5"><StatusBadge status={r.interest} /><span className="truncate text-xs text-slate-500">{r.campaign?.name}</span></div>
              </Link>
            ))}
            {!replies.length && <div className="px-4 py-10 text-center text-sm text-slate-400">No replies yet</div>}
          </div>
        </Card>
      </div>
      <Card title="Campaigns" actions={<Link href="/campaigns" className="flex items-center gap-1 text-xs text-brand">All campaigns <ArrowRight className="h-3 w-3" /></Link>}>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead><tr><th>Campaign</th><th>Status</th><th>Leads</th><th>Sent</th><th>Open rate</th><th>Reply rate</th><th>Interested</th></tr></thead>
            <tbody>
              {rows.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/campaigns/${r.id}`} className="font-medium hover:text-brand">{r.name}</Link><div className="text-xs text-slate-500">{r.client || "Internal"}</div></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.leads}</td>
                  <td>{r.sent}</td>
                  <td>{r.openRate}%</td>
                  <td>{r.replyRate}%</td>
                  <td className="font-medium text-emerald-600">{r.interested}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No campaigns yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
