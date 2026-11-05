"use client";
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Pause, Play, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Card, EmptyState, Field, Input, Modal, Select, StatusBadge, Tabs, useToast } from "@/components/ui";
import { CsvImportInline } from "./CsvImportInline";
import type { CampaignFull } from "./types";

type Row = {
  id: string; status: string; currentStep: number; nextSendAt: string | null; interest: string | null; lastError: string | null; accountEmail: string | null;
  lead: { email: string; firstName: string | null; lastName: string | null; companyName: string | null };
};

export function CampaignLeads({ campaign, lists, onChange }: { campaign: CampaignFull; lists: { id: string; name: string; count: number }[]; onChange: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<{ total: number; rows: Row[]; page: number; size: number } | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(q ? { q } : {}) });
    api<{ total: number; rows: Row[]; page: number; size: number }>(`/api/campaigns/${campaign.id}/leads?${sp}`).then(setData);
  }, [campaign.id, page, status, q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  const act = async (action: "remove" | "pause" | "resume") => {
    const r = await api<{ count: number }>(`/api/campaigns/${campaign.id}/leads`, { body: { action, ids: [...sel] } });
    toast(`${r.count} leads updated`);
    setSel(new Set());
    load();
    onChange();
  };
  const steps = campaign.steps.length;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search leads" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {["ACTIVE", "COMPLETED", "REPLIED", "BOUNCED", "UNSUBSCRIBED", "PAUSED", "ERROR"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </Select>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add leads</Button>
      </div>
      {sel.size > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-brand/5 px-3 py-2 text-sm">
          <b>{sel.size}</b> selected <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => act("pause")}><Pause className="h-3.5 w-3.5" /> Pause</Button>
          <Button size="sm" variant="outline" onClick={() => act("resume")}><Play className="h-3.5 w-3.5" /> Resume</Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act("remove")}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
        </div>
      )}
      {data && data.total === 0 && !status && !q ? (
        <EmptyState icon={<Plus className="h-6 w-6" />} title="No leads in this campaign" text="Add a lead list or upload a CSV." action={<Button onClick={() => setAdding(true)}>Add leads</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-8"><input type="checkbox" checked={!!data?.rows.length && data.rows.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(data?.rows.map((r) => r.id)) : new Set())} /></th>
                <th>Lead</th><th>Status</th><th>Progress</th><th>Next email</th><th>Interest</th><th>Sending from</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => { const s = new Set(sel); if (s.has(r.id)) s.delete(r.id); else s.add(r.id); setSel(s); }} /></td>
                  <td><div className="font-medium">{r.lead.email}</div><div className="text-xs text-slate-500">{[r.lead.firstName, r.lead.lastName].filter(Boolean).join(" ")}{r.lead.companyName ? ` · ${r.lead.companyName}` : ""}</div></td>
                  <td><StatusBadge status={r.status} />{r.lastError && <div className="mt-0.5 max-w-[200px] truncate text-[11px] text-red-600" title={r.lastError}>{r.lastError}</div>}</td>
                  <td className="text-sm">{Math.min(r.currentStep, steps)}/{steps} sent</td>
                  <td className="text-xs text-slate-500">{r.status === "ACTIVE" && r.nextSendAt ? (new Date(r.nextSendAt) <= new Date() ? "Due now" : formatDistanceToNow(new Date(r.nextSendAt), { addSuffix: true })) : "—"}</td>
                  <td><StatusBadge status={r.interest} /></td>
                  <td className="text-xs text-slate-500">{r.accountEmail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.size && (
        <div className="flex items-center justify-between p-3 text-sm text-slate-500">
          <span>{data.total} leads · page {data.page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page * data.size >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
      <AddLeadsModal open={adding} onClose={() => setAdding(false)} campaignId={campaign.id} lists={lists} onDone={() => { setAdding(false); load(); onChange(); }} />
    </Card>
  );
}

function AddLeadsModal({ open, onClose, campaignId, lists, onDone }: { open: boolean; onClose: () => void; campaignId: string; lists: { id: string; name: string; count: number }[]; onDone: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState(lists.length ? "list" : "csv");
  const [listId, setListId] = useState(lists[0]?.id || "");
  const [loading, setLoading] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Add leads to campaign" wide>
      <Tabs tabs={[{ id: "list", label: "From a lead list" }, { id: "csv", label: "Upload CSV" }]} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "list" ? (
          lists.length ? (
            <div className="space-y-3">
              <Field label="Lead list">
                <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.count})</option>)}
                </Select>
              </Field>
              <p className="text-xs text-slate-500">Leads already in this campaign, unsubscribed, bounced or invalid emails are skipped.</p>
              <div className="flex justify-end">
                <Button loading={loading} onClick={async () => {
                  setLoading(true);
                  const r = await api<{ added: number; skipped: number }>(`/api/campaigns/${campaignId}/leads`, { body: { action: "add_list", listId } });
                  toast(`${r.added} leads added · ${r.skipped} skipped`);
                  setLoading(false);
                  onDone();
                }}>Add leads</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No lead lists yet.</p>
          )
        ) : (
          <CsvImportInline campaignId={campaignId} onDone={onDone} />
        )}
      </div>
    </Modal>
  );
}
