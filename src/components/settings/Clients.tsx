"use client";
import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, Link2, Copy, UserPlus, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea, useToast } from "@/components/ui";

type Client = { id: string; name: string; website: string | null; notes: string | null; shareToken: string; users: { id: string; name: string; email: string }[]; _count: { campaigns: number; lists: number; deals: number } };

export function Clients({ appUrl }: { appUrl: string }) {
  const toast = useToast();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [userFor, setUserFor] = useState<Client | null>(null);
  const load = useCallback(() => api<Client[]>("/api/clients").then(setClients), []);
  useEffect(() => {
    load();
  }, [load]);
  const link = (c: Client) => `${appUrl}/r/${c.shareToken}`;
  return (
    <div>
      <PageHeader title="Clients" subtitle="Assign campaigns and lead lists to clients. Clients get a read-only report via login or a private link." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add client</Button>} />
      {clients && !clients.length ? (
        <Card><EmptyState icon={<Building2 className="h-6 w-6" />} title="No clients yet" text="Add a client, then pick it when creating campaigns. Their report updates live." action={<Button onClick={() => setAdding(true)}>Add client</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(clients || []).map((c) => (
            <Card key={c.id}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">{c.name}</div>
                    {c.website && <div className="text-xs text-slate-500">{c.website}</div>}
                  </div>
                  <button className="rounded p-1 text-slate-400 hover:text-red-600" onClick={async () => { if (!confirm(`Delete ${c.name}? Campaigns stay, unassigned.`)) return; await api(`/api/clients/${c.id}`, { method: "DELETE" }); load(); }}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[["Campaigns", c._count.campaigns], ["Lists", c._count.lists], ["Deals", c._count.deals]].map(([l, n]) => (
                    <div key={l as string} className="rounded-lg bg-slate-50 py-2"><div className="text-lg font-semibold">{n}</div><div className="text-[11px] text-slate-500">{l}</div></div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600"><Link2 className="h-3.5 w-3.5" /> Private report link</div>
                  <div className="flex gap-1">
                    <Input readOnly value={link(c)} className="h-8 text-xs" onFocus={(e) => e.target.select()} />
                    <Button size="sm" variant="outline" title="Copy" onClick={() => { navigator.clipboard.writeText(link(c)); toast("Link copied"); }}><Copy className="h-3.5 w-3.5" /></Button>
                    <a href={link(c)} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" title="Open"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
                    <Button size="sm" variant="ghost" title="New link (old one stops working)" onClick={async () => { await api(`/api/clients/${c.id}/token`, { method: "POST" }); load(); toast("New link generated"); }}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium text-slate-600">Client logins</div>
                  {c.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-0.5 text-sm">
                      <span>{u.name} <span className="text-xs text-slate-500">{u.email}</span></span>
                      <button className="text-slate-400 hover:text-red-600" onClick={async () => { await api(`/api/clients/${c.id}/users`, { method: "DELETE", body: { userId: u.id } }); load(); }}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => setUserFor(c)}><UserPlus className="h-3.5 w-3.5" /> Invite client user</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <AddClient open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
      {userFor && <AddClientUser client={userFor} onClose={() => setUserFor(null)} onDone={() => { setUserFor(null); load(); }} />}
    </div>
  );
}

function AddClient({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", website: "", notes: "" });
  return (
    <Modal open={open} onClose={onClose} title="Add client">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await api("/api/clients", { body: f }); setF({ name: "", website: "", notes: "" }); onDone(); }}>
        <Field label="Client name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
        <Field label="Notes"><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="flex justify-end"><Button>Add client</Button></div>
      </form>
    </Modal>
  );
}

function AddClientUser({ client, onClose, onDone }: { client: Client; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  return (
    <Modal open onClose={onClose} title={`Invite a user for ${client.name}`}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        try { await api(`/api/clients/${client.id}/users`, { body: f }); toast("Client user created — share the email and password with them"); onDone(); } catch (err) { toast((err as Error).message, "error"); }
      }}>
        <Field label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="min 8 characters"><Input required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">They sign in at the same login page and only see {client.name}'s read-only report.</p>
        <div className="flex justify-end"><Button>Create login</Button></div>
      </form>
    </Modal>
  );
}
