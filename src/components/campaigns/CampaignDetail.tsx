"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Pause, Pencil } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Input, PageHeader, StatusBadge, Tabs, useToast } from "@/components/ui";
import type { CampaignFull } from "./types";
import { CampaignAnalytics } from "./CampaignAnalytics";
import { SequenceEditor } from "./SequenceEditor";
import { CampaignLeads } from "./CampaignLeads";
import { ScheduleTab, OptionsTab } from "./CampaignSettings";

export type Ctx = {
  accounts: { id: string; email: string; fromName: string; status: string; tags: string[]; dailyLimit: number }[];
  lists: { id: string; name: string; count: number }[];
  clients: { id: string; name: string }[];
  aiEnabled: boolean;
};

export function CampaignDetail({ id, ctx }: { id: string; ctx: Ctx }) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState(params.get("tab") || "analytics");
  const [c, setC] = useState<CampaignFull | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<CampaignFull>(`/api/campaigns/${id}`).then(setC), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const changeTab = (t: string) => {
    setTab(t);
    router.replace(`/campaigns/${id}?tab=${t}`, { scroll: false });
  };
  const setStatus = async (action: "launch" | "pause" | "resume") => {
    setBusy(true);
    try {
      await api(`/api/campaigns/${id}/status`, { body: { action } });
      toast(action === "pause" ? "Campaign paused" : "Campaign is live — sending within the schedule window");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (!c) return <div className="p-10 text-center text-sm text-slate-400">Loading…</div>;
  return (
    <div>
      <Link href="/campaigns" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Campaigns</Link>
      <PageHeader
        title={
          editingName ? (
            <Input
              autoFocus
              defaultValue={c.name}
              className="h-9 w-80 text-lg"
              onBlur={async (e) => { await api(`/api/campaigns/${id}`, { method: "PATCH", body: { name: e.target.value } }); setEditingName(false); load(); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <span className="flex items-center gap-2">
              {c.name}
              <button onClick={() => setEditingName(true)} className="text-slate-400 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
              <StatusBadge status={c.status} />
            </span>
          )
        }
        subtitle={`${c.client?.name || "Internal"} · ${c._count.leads} leads · ${c.steps.length} steps · ${c.accountIds.length} sending accounts`}
        actions={
          c.status === "ACTIVE" ? (
            <Button variant="outline" loading={busy} onClick={() => setStatus("pause")}><Pause className="h-4 w-4" /> Pause</Button>
          ) : c.status === "COMPLETED" ? null : (
            <Button loading={busy} onClick={() => setStatus(c.status === "PAUSED" ? "resume" : "launch")}><Play className="h-4 w-4" /> {c.status === "PAUSED" ? "Resume" : "Launch"}</Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={changeTab}
        tabs={[
          { id: "analytics", label: "Analytics" },
          { id: "leads", label: `Leads (${c._count.leads})` },
          { id: "sequence", label: "Sequence" },
          { id: "schedule", label: "Schedule" },
          { id: "options", label: "Options" },
        ]}
      />
      <div className="mt-5">
        {tab === "analytics" && <CampaignAnalytics campaign={c} />}
        {tab === "leads" && <CampaignLeads campaign={c} lists={ctx.lists} onChange={load} />}
        {tab === "sequence" && <SequenceEditor campaign={c} aiEnabled={ctx.aiEnabled} accounts={ctx.accounts} onSaved={load} />}
        {tab === "schedule" && <ScheduleTab campaign={c} onSaved={load} />}
        {tab === "options" && <OptionsTab campaign={c} accounts={ctx.accounts} clients={ctx.clients} onSaved={load} />}
      </div>
    </div>
  );
}
