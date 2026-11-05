"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Copy, Trash2, Search } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Progress, Select, StatusBadge, useToast } from "@/components/ui";

type Row = { id: string; name: string; status: string; client: string | null; leads: number; completedLeads: number; sent: number; opened: number; replied: number; interested: number; bounced: number; openRate: number; replyRate: number; createdAt: string };

export function CampaignsList({ clients }: { clients: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();
  const toast = useToast();
  const load = useCallback(() => api<Row[]>("/api/campaigns").then(setRows), []);
  useEffect(() => {
    load();
  }, [load]);
  const filtered = (rows || []).filter((r) => (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (!status || r.status === status));
  return (
    <div>
      <PageHeader title="Campaigns" subtitle="Multi-step cold email sequences." actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New campaign</Button>} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-8" placeholder="Search campaigns" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="DRAFT">Draft</option><option value="COMPLETED">Completed</option>
          </Select>
        </div>
        {rows && !rows.length ? (
          <EmptyState icon={<Send className="h-6 w-6" />} title="No campaigns yet" text="Create a campaign, write your sequence, add leads and launch." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New campaign</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead><tr><th>Campaign</th><th>Status</th><th>Progress</th><th>Sent</th><th>Opened</th><th>Replied</th><th>Interested</th><th /></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => router.push(`/campaigns/${r.id}`)}>
                    <td><div className="font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.client || "Internal"} · {r.leads} leads</div></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="w-36"><div className="mb-1 text-xs text-slate-500">{r.leads ? Math.round((r.completedLeads / r.leads) * 100) : 0}%</div><Progress value={r.completedLeads} max={r.leads} /></td>
                    <td>{r.sent}</td>
                    <td>{r.opened} <span className="text-xs text-slate-400">{r.openRate}%</span></td>
                    <td>{r.replied} <span className="text-xs text-slate-400">{r.replyRate}%</span></td>
                    <td className="font-medium text-emerald-600">{r.interested}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button title="Duplicate" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={async () => { await api(`/api/campaigns/${r.id}/duplicate`, { method: "POST" }); toast("Campaign duplicated"); load(); }}><Copy className="h-4 w-4" /></button>
                        <button title="Delete" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={async () => { if (!confirm(`Delete "${r.name}" and its stats?`)) return; await api(`/api/campaigns/${r.id}`, { method: "DELETE" }); load(); }}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <NewCampaign open={creating} onClose={() => setCreating(false)} clients={clients} onCreated={(id) => router.push(`/campaigns/${id}?tab=sequence`)} />
    </div>
  );
}

function NewCampaign({ open, onClose, clients, onCreated }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="New campaign">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setLoading(true); const c = await api<{ id: string }>("/api/campaigns", { body: { name, clientId: clientId || null } }); onCreated(c.id); }}>
        <Field label="Campaign name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Dentists Austin – Website offer" /></Field>
        <Field label="Client" hint="clients see this campaign's report">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client (internal)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end"><Button loading={loading}>Create</Button></div>
      </form>
    </Modal>
  );
}
