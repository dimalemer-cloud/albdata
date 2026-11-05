"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Mail, Phone, Trash2, KanbanSquare } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Stat, Textarea, useToast } from "@/components/ui";
import { cn, DEAL_STAGES } from "@/lib/utils";

type Deal = {
  id: string; title: string; stage: string; value: number; notes: string; position: number; updatedAt: string;
  lead: { id: string; email: string; firstName: string | null; lastName: string | null; companyName: string | null; phone: string | null; website: string | null; threads: { id: string }[] } | null;
  client: { name: string } | null; campaign: { name: string } | null; owner: { name: string } | null;
};

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function Pipeline({ clients }: { clients: { id: string; name: string }[] }) {
  const toast = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clientId, setClientId] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Deal | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api<Deal[]>(`/api/deals${clientId ? `?clientId=${clientId}` : ""}`).then(setDeals), [clientId]);
  useEffect(() => {
    load();
  }, [load]);
  const move = async (id: string, stage: string) => {
    setDeals((d) => d.map((x) => (x.id === id ? { ...x, stage } : x)));
    await api(`/api/deals/${id}`, { method: "PATCH", body: { stage } }).catch((e) => toast(e.message, "error"));
  };
  const open_ = deals.filter((d) => !["won", "lost"].includes(d.stage));
  const won = deals.filter((d) => d.stage === "won");
  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle="Interested replies become deals automatically. Drag cards between stages."
        actions={
          <>
            <Select className="w-48" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add deal</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open deals" value={open_.length} />
        <Stat label="Pipeline value" value={money(open_.reduce((s, d) => s + d.value, 0))} />
        <Stat label="Won" value={won.length} sub={money(won.reduce((s, d) => s + d.value, 0))} color="#059669" />
        <Stat label="Win rate" value={`${won.length + deals.filter((d) => d.stage === "lost").length ? Math.round((won.length / (won.length + deals.filter((d) => d.stage === "lost").length)) * 100) : 0}%`} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((s) => {
          const items = deals.filter((d) => d.stage === s.id);
          return (
            <div
              key={s.id}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id); }}
              onDragLeave={() => setOver(null)}
              onDrop={() => { if (dragId) move(dragId, s.id); setDragId(null); setOver(null); }}
              className={cn("flex min-w-[230px] flex-1 flex-col rounded-xl border bg-slate-100/70 p-2", over === s.id ? "border-brand bg-brand/5" : "border-transparent")}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}<span className="text-xs font-normal text-slate-500">{items.length}</span></span>
                <span className="text-xs text-slate-500">{money(items.reduce((a, d) => a + d.value, 0))}</span>
              </div>
              <div className="min-h-[120px] flex-1 space-y-2">
                {items.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onClick={() => setOpen(d)}
                    className={cn("cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow", dragId === d.id && "opacity-50")}
                  >
                    <div className="text-sm font-medium">{d.title}</div>
                    {d.lead && <div className="truncate text-xs text-slate-500">{[d.lead.firstName, d.lead.lastName].filter(Boolean).join(" ") || d.lead.email}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {d.value > 0 && <Badge color="green">{money(d.value)}</Badge>}
                      {d.client && <Badge>{d.client.name}</Badge>}
                      {d.campaign && <Badge color="blue">{d.campaign.name.slice(0, 22)}</Badge>}
                    </div>
                  </div>
                ))}
                {!items.length && <div className="px-2 py-6 text-center text-xs text-slate-400">Drop deals here</div>}
              </div>
            </div>
          );
        })}
      </div>
      {!deals.length && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500"><KanbanSquare className="h-4 w-4" /> Deals appear here when a reply is marked Interested or Meeting booked in the Unibox.</div>
      )}
      {open && <DealModal deal={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
      <AddDeal open={adding} clients={clients} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
    </div>
  );
}

function DealModal({ deal, onClose, onSaved }: { deal: Deal; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: deal.title, value: deal.value, stage: deal.stage, notes: deal.notes });
  return (
    <Modal open onClose={onClose} title={deal.title}>
      <div className="space-y-3">
        {deal.lead && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium">{[deal.lead.firstName, deal.lead.lastName].filter(Boolean).join(" ") || deal.lead.companyName}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{deal.lead.email}</span>
              {deal.lead.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{deal.lead.phone}</span>}
            </div>
            {deal.lead.threads[0] && <Link href="/unibox" className="mt-1 inline-block text-xs text-brand underline">Open conversation in Unibox</Link>}
          </div>
        )}
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Value (USD)"><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
          <Field label="Stage"><Select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <Field label="Notes"><Textarea rows={5} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex justify-between">
          <Button variant="ghost" className="text-red-600" onClick={async () => { if (confirm("Delete deal?")) { await api(`/api/deals/${deal.id}`, { method: "DELETE" }); onSaved(); } }}><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button onClick={async () => { await api(`/api/deals/${deal.id}`, { method: "PATCH", body: f }); onSaved(); }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function AddDeal({ open, clients, onClose, onSaved }: { open: boolean; clients: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: "", value: 0, stage: "interested", clientId: "" });
  return (
    <Modal open={open} onClose={onClose} title="Add deal">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await api("/api/deals", { body: { ...f, clientId: f.clientId || null } }); setF({ title: "", value: 0, stage: "interested", clientId: "" }); onSaved(); }}>
        <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Smile Dental – website redesign" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Value (USD)"><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
          <Field label="Stage"><Select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <Field label="Client"><Select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}><option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="flex justify-end"><Button>Add deal</Button></div>
      </form>
    </Modal>
  );
}
