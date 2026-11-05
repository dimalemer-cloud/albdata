"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Plus, ShieldCheck, Send, Trash2, Download, Search } from "lucide-react";
import Papa from "papaparse";
import { api } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, useToast } from "@/components/ui";
import { JobProgress } from "@/components/JobProgress";
import { CsvImport } from "./CsvImport";
import { LEAD_STATUSES } from "@/lib/utils";

type Lead = {
  id: string; email: string; firstName: string | null; lastName: string | null; companyName: string | null; title: string | null;
  website: string | null; phone: string | null; city: string | null; country: string | null; status: string; verifyStatus: string | null;
  customFields: Record<string, string>; source: string | null; createdAt: string;
};
type Resp = { total: number; page: number; size: number; leads: Lead[]; list: { id: string; name: string; client: { name: string } | null } };

export function ListDetail({ listId, campaigns }: { listId: string; campaigns: { id: string; name: string; status: string }[] }) {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<Resp | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [verify, setVerify] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(params.get("import") === "1");
  const [adding, setAdding] = useState(false);
  const [toCampaign, setToCampaign] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);

  const load = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(status ? { status } : {}), ...(verify ? { verify } : {}) });
    api<Resp>(`/api/lists/${listId}/leads?${sp}`).then(setData);
  }, [listId, page, q, status, verify]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const allSelected = !!data?.leads.length && data.leads.every((l) => sel.has(l.id));
  const selectAllMatching = async () => {
    const sp = new URLSearchParams({ ids: "1", ...(q ? { q } : {}), ...(status ? { status } : {}), ...(verify ? { verify } : {}) });
    const r = await api<{ ids: string[] }>(`/api/lists/${listId}/leads?${sp}`);
    setSel(new Set(r.ids));
  };
  const ids = [...sel];

  return (
    <div>
      <Link href="/leads" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Lists</Link>
      <PageHeader
        title={data?.list.name || "…"}
        subtitle={data ? `${data.total.toLocaleString()} leads${data.list.client ? ` · ${data.list.client.name}` : ""}` : undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add lead</Button>
            <Button variant="outline" onClick={async () => {
              const r = await api<{ jobId: string }>("/api/leads/verify", { body: { listId, onlyUnverified: true } }).catch((e) => { toast(e.message, "error"); return null; });
              if (r) setJobId(r.jobId);
            }}><ShieldCheck className="h-4 w-4" /> Verify unverified</Button>
            <Button onClick={() => setImporting(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
          </>
        }
      />
      {jobId && <div className="mb-3"><JobProgress jobId={jobId} label="Verifying emails" onDone={(j) => { toast(j.status === "DONE" ? `Verification done: ${Object.entries(j.result || {}).map(([k, v]) => `${v} ${k}`).join(", ")}` : `Verification failed`); load(); }} /></div>}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-8" placeholder="Search email, name, company, city" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
          </Select>
          <Select className="w-40" value={verify} onChange={(e) => { setVerify(e.target.value); setPage(1); }}>
            <option value="">Any verification</option>
            <option value="valid">Valid</option><option value="invalid">Invalid</option><option value="catch_all">Catch-all</option><option value="risky">Risky</option><option value="unknown">Unknown</option><option value="none">Not verified</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => {
            if (!data) return;
            const csv = Papa.unparse(data.leads.map((l) => ({ email: l.email, firstName: l.firstName, lastName: l.lastName, company: l.companyName, title: l.title, website: l.website, phone: l.phone, city: l.city, country: l.country, status: l.status, verification: l.verifyStatus, ...l.customFields })));
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            a.download = `${data.list.name}.csv`;
            a.click();
          }}><Download className="h-4 w-4" /> Export page</Button>
        </div>
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-brand/5 px-3 py-2 text-sm">
            <b>{sel.size}</b> selected
            {data && sel.size < data.total && <button className="text-brand underline" onClick={selectAllMatching}>Select all {data.total}</button>}
            <div className="flex-1" />
            <Button size="sm" onClick={() => setToCampaign(true)}><Send className="h-3.5 w-3.5" /> Add to campaign</Button>
            <Button size="sm" variant="outline" onClick={async () => { const r = await api<{ jobId: string }>("/api/leads/verify", { body: { leadIds: ids } }); setJobId(r.jobId); }}><ShieldCheck className="h-3.5 w-3.5" /> Verify</Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (!confirm(`Delete ${sel.size} leads?`)) return; await api("/api/leads", { body: { action: "delete", leadIds: ids } }); setSel(new Set()); load(); }}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          </div>
        )}
        {data && data.total === 0 && !q && !status && !verify ? (
          <EmptyState icon={<Upload className="h-6 w-6" />} title="This list is empty" text="Import a CSV or save businesses from the Lead Finder." action={<Button onClick={() => setImporting(true)}>Import CSV</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="w-8"><input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(data?.leads.map((l) => l.id)))} /></th>
                  <th>Email</th><th>Name</th><th>Company</th><th>City</th><th>Status</th><th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {(data?.leads || []).map((l) => (
                  <tr key={l.id} className="cursor-pointer" onClick={() => setLead(l)}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(l.id)} onChange={() => { const s = new Set(sel); if (s.has(l.id)) s.delete(l.id); else s.add(l.id); setSel(s); }} /></td>
                    <td className="font-medium">{l.email}</td>
                    <td>{[l.firstName, l.lastName].filter(Boolean).join(" ") || <span className="text-slate-400">—</span>}{l.title && <div className="text-xs text-slate-500">{l.title}</div>}</td>
                    <td>{l.companyName || "—"}</td>
                    <td className="text-slate-500">{l.city || "—"}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td><StatusBadge status={l.verifyStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.size && (
          <div className="flex items-center justify-between p-3 text-sm text-slate-500">
            <span>Page {data.page} of {Math.ceil(data.total / data.size)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= Math.ceil(data.total / data.size)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={importing} onClose={() => { setImporting(false); router.replace(`/leads/${listId}`); }} title="Import leads from CSV" wide>
        <CsvImport listId={listId} onDone={() => { setImporting(false); load(); }} />
      </Modal>
      <AddLeadModal open={adding} onClose={() => setAdding(false)} listId={listId} onDone={() => { setAdding(false); load(); }} />
      <Modal open={toCampaign} onClose={() => setToCampaign(false)} title={`Add ${sel.size} leads to campaign`}>
        <AddToCampaign campaigns={campaigns} leadIds={ids} onDone={() => { setToCampaign(false); setSel(new Set()); }} />
      </Modal>
      {lead && (
        <Modal open onClose={() => setLead(null)} title={lead.email}>
          <LeadEditor lead={lead} onSaved={() => { setLead(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}

export function AddToCampaign({ campaigns, leadIds, listId, onDone }: { campaigns: { id: string; name: string; status: string }[]; leadIds?: string[]; listId?: string; onDone: () => void }) {
  const toast = useToast();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || "");
  const [loading, setLoading] = useState(false);
  if (!campaigns.length) return <p className="text-sm text-slate-600">Create a campaign first.</p>;
  return (
    <div className="space-y-3">
      <Field label="Campaign">
        <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status.toLowerCase()})</option>)}
        </Select>
      </Field>
      <p className="text-xs text-slate-500">Unsubscribed, bounced and invalid leads are skipped automatically.</p>
      <div className="flex justify-end">
        <Button loading={loading} onClick={async () => {
          setLoading(true);
          try {
            const r = await api<{ added: number; skipped: number }>("/api/leads/to-campaign", { body: { campaignId, leadIds, listId } });
            toast(`${r.added} added · ${r.skipped} skipped`);
            onDone();
          } catch (e) {
            toast((e as Error).message, "error");
          } finally {
            setLoading(false);
          }
        }}>Add leads</Button>
      </div>
    </div>
  );
}

function AddLeadModal({ open, onClose, listId, onDone }: { open: boolean; onClose: () => void; listId: string; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ email: "", firstName: "", lastName: "", companyName: "", title: "", website: "", city: "" });
  return (
    <Modal open={open} onClose={onClose} title="Add lead">
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault();
        const r = await api<{ imported: number }>(`/api/lists/${listId}/leads`, { body: { leads: [{ ...f, source: "manual" }] } });
        toast(r.imported ? "Lead added" : "Lead already exists or email invalid", r.imported ? "ok" : "error");
        if (r.imported) { setF({ email: "", firstName: "", lastName: "", companyName: "", title: "", website: "", city: "" }); onDone(); }
      }}>
        <Field label="Email" className="col-span-2"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        {(["firstName", "lastName", "companyName", "title", "website", "city"] as const).map((k) => (
          <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
        ))}
        <div className="col-span-2 flex justify-end"><Button>Add</Button></div>
      </form>
    </Modal>
  );
}

function LeadEditor({ lead, onSaved }: { lead: Lead; onSaved: () => void }) {
  const [f, setF] = useState(lead);
  const toast = useToast();
  const fields = ["firstName", "lastName", "companyName", "title", "website", "phone", "city", "country"] as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><StatusBadge status={lead.status} /><StatusBadge status={lead.verifyStatus} />{lead.source && <Badge>{lead.source}</Badge>}</div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((k) => (
          <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}><Input value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
        ))}
        <Field label="Status" className="col-span-2">
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
          </Select>
        </Field>
      </div>
      {Object.keys(lead.customFields || {}).length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">Custom variables</div>
          <div className="space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
            {Object.entries(lead.customFields).map(([k, v]) => <div key={k}><code className="text-brand">{`{{${k}}}`}</code> = {String(v)}</div>)}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={async () => {
          const { id, firstName, lastName, companyName, title, website, phone, city, country, status } = f;
          await api(`/api/leads/${id}`, { method: "PATCH", body: { firstName, lastName, companyName, title, website, phone, city, country, status } });
          toast("Lead saved");
          onSaved();
        }}>Save</Button>
      </div>
    </div>
  );
}
