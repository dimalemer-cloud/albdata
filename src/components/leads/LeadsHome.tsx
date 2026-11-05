"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, ShieldBan, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, useToast } from "@/components/ui";

type ListRow = { id: string; name: string; client: string | null; count: number; valid: number; createdAt: string };
type Blocked = { id: string; value: string; reason: string | null; createdAt: string };

export function LeadsHome({ clients }: { clients: { id: string; name: string }[] }) {
  const [tab, setTab] = useState("lists");
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [creating, setCreating] = useState(false);
  const [blockText, setBlockText] = useState("");
  const toast = useToast();
  const router = useRouter();
  const load = useCallback(() => {
    api<ListRow[]>("/api/lists").then(setLists);
    api<Blocked[]>("/api/blocklist").then(setBlocked);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div>
      <PageHeader title="Leads" subtitle="Lead lists you can verify and add to campaigns." actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New list</Button>} />
      <Tabs tabs={[{ id: "lists", label: "Lists" }, { id: "blocklist", label: `Blocklist (${blocked.length})` }]} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "lists" ? (
          <Card>
            {lists && !lists.length ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="No lead lists yet" text="Create a list and import a CSV, or save leads from the Lead Finder." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New list</Button>} />
            ) : (
              <table className="table w-full">
                <thead><tr><th>List</th><th>Client</th><th>Leads</th><th>Verified valid</th><th>Created</th></tr></thead>
                <tbody>
                  {(lists || []).map((l) => (
                    <tr key={l.id} className="cursor-pointer" onClick={() => router.push(`/leads/${l.id}`)}>
                      <td className="font-medium"><Link href={`/leads/${l.id}`}>{l.name}</Link></td>
                      <td className="text-slate-500">{l.client || "—"}</td>
                      <td>{l.count.toLocaleString()}</td>
                      <td>{l.valid.toLocaleString()}</td>
                      <td className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_320px]">
            <Card>
              {!blocked.length ? (
                <EmptyState icon={<ShieldBan className="h-6 w-6" />} title="Blocklist is empty" text="Unsubscribes are added automatically. Add emails or whole domains you never want to contact." />
              ) : (
                <table className="table w-full">
                  <thead><tr><th>Email / domain</th><th>Reason</th><th>Added</th><th /></tr></thead>
                  <tbody>
                    {blocked.map((b) => (
                      <tr key={b.id}>
                        <td className="font-medium">{b.value}</td>
                        <td className="text-slate-500">{b.reason}</td>
                        <td className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                        <td><button className="text-slate-400 hover:text-red-600" onClick={async () => { await api("/api/blocklist", { method: "DELETE", body: { id: b.id } }); load(); }}><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="Add to blocklist">
              <div className="space-y-3 p-4">
                <Textarea rows={6} value={blockText} onChange={(e) => setBlockText(e.target.value)} placeholder={"john@competitor.com\ncompetitor.com"} />
                <Button className="w-full" onClick={async () => {
                  const r = await api<{ added: number }>("/api/blocklist", { body: { values: blockText.split(/[\n,;]/) } });
                  toast(`${r.added} entries blocked`);
                  setBlockText("");
                  load();
                }}>Block</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
      <NewListModal open={creating} onClose={() => setCreating(false)} clients={clients} onCreated={(id) => router.push(`/leads/${id}?import=1`)} />
    </div>
  );
}

export function NewListModal({ open, onClose, clients, onCreated }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="New lead list">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const l = await api<{ id: string }>("/api/lists", { body: { name, clientId: clientId || null } }); onCreated(l.id); }}>
        <Field label="List name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Dentists – Austin TX" /></Field>
        <Field label="Client" hint="optional">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client (internal)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end"><Button>Create list</Button></div>
      </form>
    </Modal>
  );
}
