"use client";
import { useCallback, useEffect, useState } from "react";
import { Flame, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { api } from "@/lib/client";
import { Card, EmptyState, PageHeader, Progress, Stat, Toggle, useToast } from "@/components/ui";
import { HealthBadge } from "./AccountsClient";
import type { AccountRow } from "./types";

type Stats = { days: { date: string; sent: number; replies: number; inbox: number; spam: number }[]; pool: number };

export function WarmupClient() {
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const toast = useToast();
  const load = useCallback(() => {
    api<AccountRow[]>("/api/accounts").then(setRows).catch((e) => toast(e.message, "error"));
    api<Stats>("/api/warmup").then(setStats).catch(() => {});
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);
  const totals = stats?.days.reduce((a, d) => ({ sent: a.sent + d.sent, replies: a.replies + d.replies, inbox: a.inbox + d.inbox, spam: a.spam + d.spam }), { sent: 0, replies: 0, inbox: 0, spam: 0 });
  const landed = (totals?.inbox ?? 0) + (totals?.spam ?? 0);
  return (
    <div>
      <PageHeader title="Warmup" subtitle="Your inboxes email each other, open, mark important, rescue from spam and reply — building sender reputation before and during campaigns." />
      {stats && stats.pool < 2 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Warmup needs at least 2 active inboxes with warmup on (currently {stats.pool}). Use inboxes on different domains for the best results.
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Warmup emails sent (14d)" value={totals?.sent ?? "—"} />
        <Stat label="Replies (14d)" value={totals?.replies ?? "—"} />
        <Stat label="Landed in inbox" value={landed ? `${Math.round(((totals?.inbox ?? 0) / landed) * 100)}%` : "—"} color="#059669" />
        <Stat label="Saved from spam" value={totals?.spam ?? "—"} color="#d97706" />
      </div>
      <Card title="Last 14 days" className="mb-4">
        <div className="h-64 p-3">
          <ResponsiveContainer>
            <BarChart data={stats?.days || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inbox" stackId="a" name="Inbox" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="spam" stackId="a" name="Spam (rescued)" fill="#f59e0b" />
              <Bar dataKey="replies" name="Replies" fill="rgb(var(--brand))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Inboxes">
        {rows && rows.length === 0 ? (
          <EmptyState icon={<Flame className="h-6 w-6" />} title="No inboxes yet" text="Connect email accounts first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr><th>Account</th><th>Warmup</th><th>Today's target</th><th>Health (14d)</th><th>Sent / received</th><th>Reply rate</th></tr>
              </thead>
              <tbody>
                {(rows || []).map((r) => (
                  <tr key={r.id}>
                    <td><div className="font-medium">{r.email}</div><div className="text-xs text-slate-500">{r.warmupStartedAt ? `Day ${Math.floor((Date.now() - new Date(r.warmupStartedAt).getTime()) / 86_400_000) + 1}` : "Not started"}</div></td>
                    <td>
                      <Toggle checked={r.warmupEnabled} onChange={async (v) => { await api(`/api/accounts/${r.id}`, { method: "PATCH", body: { warmupEnabled: v } }); load(); }} />
                    </td>
                    <td className="w-44">
                      <div className="mb-1 text-xs text-slate-600">{r.warmupTarget} emails/day (max {r.warmupMax})</div>
                      <Progress value={r.warmupTarget} max={r.warmupMax} color="#f97316" />
                    </td>
                    <td><HealthBadge score={r.health.score} /></td>
                    <td className="text-sm">{r.health.sent} / {r.health.received}</td>
                    <td className="text-sm">{r.warmupReplyRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
