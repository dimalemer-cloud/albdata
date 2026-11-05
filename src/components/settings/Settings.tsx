"use client";
import { useCallback, useEffect, useState } from "react";
import { Upload, Save, KeyRound, CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, useToast } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { TIMEZONES } from "@/lib/schedule";

type Settings = { name: string; logoUrl: string | null; brandColor: string; trackingDomain: string | null; defaultTimezone: string; aiModel: string; hasAnthropicKey: boolean; hasPlacesKey: boolean; appUrl: string };
type User = { id: string; name: string; email: string; role: string; createdAt: string };

const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 — best quality (default)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — balanced" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — fastest, lowest cost" },
];

export function SettingsPage({ role }: { role: string }) {
  const [tab, setTab] = useState("general");
  const [s, setS] = useState<Settings | null>(null);
  const load = useCallback(() => api<Settings>("/api/settings").then(setS), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!s) return null;
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs tabs={[{ id: "general", label: "Branding" }, { id: "integrations", label: "Integrations" }, { id: "deliverability", label: "Deliverability" }, { id: "team", label: "Team" }]} value={tab} onChange={setTab} />
      <div className="mt-4 max-w-3xl">
        {tab === "general" && <General s={s} reload={load} />}
        {tab === "integrations" && <Integrations s={s} reload={load} />}
        {tab === "deliverability" && <Deliverability s={s} reload={load} />}
        {tab === "team" && <Team canManage={role === "OWNER" || role === "ADMIN"} />}
      </div>
    </div>
  );
}

function General({ s, reload }: { s: Settings; reload: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({ name: s.name, brandColor: s.brandColor, defaultTimezone: s.defaultTimezone });
  const save = async (body: Record<string, unknown>) => {
    try { await api("/api/settings", { method: "PATCH", body }); toast("Saved"); reload(); router.refresh(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
          <Logo name={f.name} logoUrl={s.logoUrl} />
          <div className="flex-1" />
          <label className="cursor-pointer">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"><Upload className="h-3.5 w-3.5" /> Upload logo</span>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              try { await api("/api/settings/logo", { body: fd }); toast("Logo updated"); reload(); router.refresh(); } catch (err) { toast((err as Error).message, "error"); }
            }} />
          </label>
          {s.logoUrl && <Button size="sm" variant="ghost" onClick={() => save({ logoUrl: null })}>Remove</Button>}
        </div>
        <p className="-mt-2 text-xs text-slate-500">Shown in the app, login page and client reports. PNG or SVG with transparent background works best.</p>
        <Field label="Workspace name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Brand color">
          <div className="flex items-center gap-2">
            <input type="color" value={f.brandColor} onChange={(e) => setF({ ...f, brandColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
            <Input value={f.brandColor} onChange={(e) => setF({ ...f, brandColor: e.target.value })} className="w-32" />
          </div>
        </Field>
        <Field label="Default timezone for new campaigns">
          <Select value={f.defaultTimezone} onChange={(e) => setF({ ...f, defaultTimezone: e.target.value })}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Button onClick={() => save(f)}><Save className="h-4 w-4" /> Save</Button>
      </div>
    </Card>
  );
}

function Integrations({ s, reload }: { s: Settings; reload: () => void }) {
  const toast = useToast();
  const [anthropicKey, setAnthropicKey] = useState("");
  const [placesKey, setPlacesKey] = useState("");
  const [model, setModel] = useState(s.aiModel);
  const [testing, setTesting] = useState(false);
  const save = async (body: Record<string, unknown>, msg = "Saved") => {
    try { await api("/api/settings", { method: "PATCH", body }); toast(msg); reload(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <div className="space-y-4">
      <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Claude AI {s.hasAnthropicKey && <Badge color="green">Connected</Badge>}</span>}>
        <div className="space-y-3 p-4">
          <p className="text-sm text-slate-600">Powers sequence writing, copy rewriting, reply classification (Interested / Not interested / Out of office…), reply drafting and owner-name extraction in the Lead Finder. Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-brand underline">console.anthropic.com</a>.</p>
          <Field label={s.hasAnthropicKey ? "Replace API key" : "API key"}><Input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." /></Field>
          <Field label="Model"><Select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { save({ ...(anthropicKey ? { anthropicKey } : {}), aiModel: model }); setAnthropicKey(""); }}><Save className="h-4 w-4" /> Save</Button>
            {s.hasAnthropicKey && (
              <>
                <Button variant="outline" loading={testing} onClick={async () => {
                  setTesting(true);
                  try { const r = await api<{ result: { category: string } }>("/api/settings/test-ai", { method: "POST" }); toast(`AI works — test reply classified as ${r.result.category}`); } catch (e) { toast((e as Error).message, "error"); } finally { setTesting(false); }
                }}><CheckCircle2 className="h-4 w-4" /> Test</Button>
                <Button variant="ghost" className="text-red-600" onClick={() => save({ anthropicKey: null }, "AI key removed")}>Remove key</Button>
              </>
            )}
          </div>
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Google Maps (Places API) {s.hasPlacesKey && <Badge color="green">Connected</Badge>}</span>}>
        <div className="space-y-3 p-4">
          <p className="text-sm text-slate-600">Optional. Gives the Lead Finder Google Maps data (more businesses, ratings, reviews). Without it the Lead Finder uses free OpenStreetMap data. Create a key in Google Cloud Console → APIs → enable “Places API (New)”.</p>
          <Field label={s.hasPlacesKey ? "Replace API key" : "API key"}><Input type="password" value={placesKey} onChange={(e) => setPlacesKey(e.target.value)} placeholder="AIza..." /></Field>
          <div className="flex gap-2">
            <Button onClick={() => { save({ placesKey }); setPlacesKey(""); }} disabled={!placesKey}><Save className="h-4 w-4" /> Save</Button>
            {s.hasPlacesKey && <Button variant="ghost" className="text-red-600" onClick={() => save({ placesKey: null }, "Key removed")}>Remove key</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Deliverability({ s, reload }: { s: Settings; reload: () => void }) {
  const toast = useToast();
  const [domain, setDomain] = useState(s.trackingDomain || "");
  const host = s.appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return (
    <Card title="Custom tracking domain">
      <div className="space-y-3 p-4 text-sm">
        <p className="text-slate-600">Open pixels, click links and unsubscribe links use this domain instead of the app's domain, so your emails don't share a tracking domain with anyone else.</p>
        <ol className="ml-4 list-decimal space-y-1 text-slate-600">
          <li>On one of your sending domains, add a <b>CNAME</b> record: <code className="rounded bg-slate-100 px-1">track</code> → <code className="rounded bg-slate-100 px-1">{host}</code></li>
          <li>Add the same hostname to your server's HTTPS config (the Docker install's Caddyfile handles it: add it to <code className="rounded bg-slate-100 px-1">TRACKING_DOMAINS</code>).</li>
          <li>Enter it below.</li>
        </ol>
        <Field label="Tracking domain"><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="track.yourdomain.com" /></Field>
        <Button onClick={async () => { await api("/api/settings", { method: "PATCH", body: { trackingDomain: domain || null } }); toast("Saved"); reload(); }}><Save className="h-4 w-4" /> Save</Button>
      </div>
    </Card>
  );
}

function Team({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "MEMBER" });
  const load = useCallback(() => api<User[]>("/api/users").then(setUsers), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Card title="Team members" actions={canManage && <Button size="sm" onClick={() => setAdding(true)}><UserPlus className="h-3.5 w-3.5" /> Add member</Button>}>
      <table className="table w-full">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.name}</td>
              <td>{u.email}</td>
              <td><Badge color={u.role === "OWNER" ? "brand" : "gray"}>{u.role.toLowerCase()}</Badge></td>
              <td>{canManage && u.role !== "OWNER" && <button className="text-slate-400 hover:text-red-600" onClick={async () => { if (!confirm(`Remove ${u.name}?`)) return; try { await api(`/api/users/${u.id}`, { method: "DELETE" }); load(); } catch (e) { toast((e as Error).message, "error"); } }}><Trash2 className="h-4 w-4" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add team member">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api("/api/users", { body: f }); toast("Member added"); setAdding(false); setF({ name: "", email: "", password: "", role: "MEMBER" }); load(); } catch (err) { toast((err as Error).message, "error"); }
        }}>
          <Field label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Temporary password"><Input required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="MEMBER">Member — everything except settings and team</option><option value="ADMIN">Admin — full access</option></Select></Field>
          <div className="flex justify-end"><Button>Add</Button></div>
        </form>
      </Modal>
    </Card>
  );
}
