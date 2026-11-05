"use client";
import { useCallback, useEffect, useState } from "react";
import { AtSign, Plus, Upload, Settings2, RefreshCw, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Progress, Select, StatusBadge, Textarea, Toggle, useToast } from "@/components/ui";
import type { AccountRow } from "./types";

export function HealthBadge({ score }: { score: number | null }) {
  if (score == null) return <Badge color="gray">No data</Badge>;
  return <Badge color={score >= 90 ? "green" : score >= 75 ? "yellow" : "red"}>{score}% inbox</Badge>;
}

export function AccountsClient() {
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const toast = useToast();
  const load = useCallback(() => api<AccountRow[]>("/api/accounts").then(setRows).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const totalCapacity = rows?.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.dailyLimit, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Email Accounts"
        subtitle={rows ? `${rows.length} connected · ${totalCapacity} emails/day sending capacity` : "Loading…"}
        actions={
          <>
            <Button variant="outline" onClick={() => setBulk(true)}>
              <Upload className="h-4 w-4" /> Bulk import
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          </>
        }
      />
      <Card>
        {rows && rows.length === 0 ? (
          <EmptyState
            icon={<AtSign className="h-6 w-6" />}
            title="Connect your first sending inbox"
            text="Add Google Workspace inboxes with an App Password. Warmup starts automatically once you have two or more accounts."
            action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add account</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Sent today</th>
                  <th>Warmup</th>
                  <th>Health</th>
                  <th>Last sync</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(rows || []).map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setEditing(r)}>
                    <td>
                      <div className="font-medium">{r.email}</div>
                      <div className="text-xs text-slate-500">{r.fromName}{r.tags.length ? ` · ${r.tags.join(", ")}` : ""}</div>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                      {r.lastError && <div className="mt-1 max-w-[220px] truncate text-[11px] text-red-600" title={r.lastError}>{r.lastError}</div>}
                    </td>
                    <td className="w-40">
                      <div className="mb-1 text-xs text-slate-600">{r.sentToday} / {r.dailyLimit}</div>
                      <Progress value={r.sentToday} max={r.dailyLimit} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Toggle
                        checked={r.warmupEnabled}
                        onChange={async (v) => {
                          await api(`/api/accounts/${r.id}`, { method: "PATCH", body: { warmupEnabled: v } });
                          load();
                        }}
                        hint={r.warmupEnabled ? `${r.warmupTarget}/day` : "Off"}
                      />
                    </td>
                    <td><HealthBadge score={r.health.score} /></td>
                    <td className="text-xs text-slate-500">{r.lastSyncAt ? formatDistanceToNow(new Date(r.lastSyncAt), { addSuffix: true }) : "Never"}</td>
                    <td><Settings2 className="h-4 w-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AddAccountModal open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />
      <BulkModal open={bulk} onClose={() => setBulk(false)} onDone={load} />
      {editing && <AccountModal account={editing} onClose={() => setEditing(null)} onSaved={() => { load(); }} />}
    </div>
  );
}

function AddAccountModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ provider: "google", email: "", fromName: "", password: "", dailyLimit: 30, warmupEnabled: true, smtpHost: "", smtpPort: 465, imapHost: "", imapPort: 993 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title="Connect email account">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError("");
          try {
            const body: Record<string, unknown> = { ...f, password: f.password.replace(/\s/g, "") };
            if (f.provider !== "custom") for (const k of ["smtpHost", "smtpPort", "imapHost", "imapPort"]) delete body[k];
            await api("/api/accounts", { body });
            toast(`${f.email} connected`);
            setF((p) => ({ ...p, email: "", password: "" }));
            onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field label="Provider">
          <Select value={f.provider} onChange={(e) => set("provider", e.target.value)}>
            <option value="google">Google Workspace / Gmail</option>
            <option value="microsoft">Microsoft 365 / Outlook</option>
            <option value="custom">Other (SMTP / IMAP)</option>
          </Select>
        </Field>
        {f.provider === "google" && (
          <div className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
            <b>Gmail setup (2 minutes):</b>
            <ol className="ml-4 mt-1 list-decimal space-y-0.5">
              <li>Turn on 2-Step Verification for the Google account.</li>
              <li>Open <a className="underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a>, create a password named “albdata”.</li>
              <li>Paste the 16-character password below. IMAP is on by default in Workspace.</li>
            </ol>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email address"><Input type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Sender name"><Input required value={f.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="John Smith" /></Field>
        </div>
        <Field label={f.provider === "google" ? "App password" : "Password"}>
          <Input type="password" required value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
        </Field>
        {f.provider === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP host"><Input value={f.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} required /></Field>
            <Field label="SMTP port"><Input type="number" value={f.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value))} /></Field>
            <Field label="IMAP host"><Input value={f.imapHost} onChange={(e) => set("imapHost", e.target.value)} required /></Field>
            <Field label="IMAP port"><Input type="number" value={f.imapPort} onChange={(e) => set("imapPort", Number(e.target.value))} /></Field>
          </div>
        )}
        <Field label="Daily campaign limit" hint="30–50 recommended per inbox">
          <Input type="number" min={1} max={500} value={f.dailyLimit} onChange={(e) => set("dailyLimit", Number(e.target.value))} />
        </Field>
        <Toggle checked={f.warmupEnabled} onChange={(v) => set("warmupEnabled", v)} label="Enable warmup" hint="Sends and replies to emails between your inboxes to build reputation" />
        {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={loading}>Test & connect</Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ email: string; ok: boolean; error?: string }[] | null>(null);
  return (
    <Modal open={open} onClose={() => { setResults(null); onClose(); }} title="Bulk import Gmail accounts" wide>
      <p className="mb-2 text-sm text-slate-600">One account per line: <code className="rounded bg-slate-100 px-1">email, sender name, app password[, daily limit]</code></p>
      <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"john@agency-mail.com, John Smith, abcd efgh ijkl mnop, 30\nanna@agency-mail.com, Anna Lee, qrst uvwx yzab cdef"} className="font-mono text-xs" />
      {results && (
        <div className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
          {results.map((r) => (
            <div key={r.email} className={r.ok ? "text-emerald-700" : "text-red-600"}>
              {r.ok ? "✓" : "✗"} {r.email} {r.error && `— ${r.error}`}
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            const bulk = text.split("\n").map((l) => l.split(",").map((x) => x.trim())).filter((p) => p[0]).map(([email, fromName, password, limit]) => ({ email, fromName, password: (password || "").replace(/\s/g, ""), dailyLimit: limit ? Number(limit) : undefined }));
            try {
              const r = await api<{ results: { email: string; ok: boolean; error?: string }[] }>("/api/accounts", { body: { bulk } });
              setResults(r.results);
              onDone();
            } finally {
              setLoading(false);
            }
          }}
        >
          Import {text.split("\n").filter((l) => l.trim()).length || ""} accounts
        </Button>
      </div>
    </Modal>
  );
}

type DnsResult = Record<"mx" | "spf" | "dkim" | "dmarc", { ok: boolean; value: string | null; hint?: string }> & { domain: string };

function AccountModal({ account, onClose, onSaved }: { account: AccountRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ ...account, password: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dns, setDns] = useState<DnsResult | null>(null);
  useEffect(() => {
    api<DnsResult>(`/api/accounts/${account.id}/dns`).then(setDns).catch(() => {});
  }, [account.id]);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fromName: f.fromName, dailyLimit: f.dailyLimit, minGapMinutes: f.minGapMinutes, signature: f.signature, tags: f.tags,
        warmupEnabled: f.warmupEnabled, warmupStart: f.warmupStart, warmupIncrement: f.warmupIncrement, warmupMax: f.warmupMax, warmupReplyRate: f.warmupReplyRate,
      };
      if (f.password) body.password = f.password.replace(/\s/g, "");
      await api(`/api/accounts/${account.id}`, { method: "PATCH", body });
      toast("Saved");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={account.email} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sending</h4>
          <Field label="Sender name"><Input value={f.fromName} onChange={(e) => set("fromName", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily limit"><Input type="number" value={f.dailyLimit} onChange={(e) => set("dailyLimit", Number(e.target.value))} /></Field>
            <Field label="Min. gap (minutes)"><Input type="number" value={f.minGapMinutes} onChange={(e) => set("minGapMinutes", Number(e.target.value))} /></Field>
          </div>
          <Field label="Tags" hint="comma separated"><Input value={f.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} /></Field>
          <Field label="Signature"><Textarea rows={4} value={f.signature} onChange={(e) => set("signature", e.target.value)} placeholder={"John Smith\nGrowth Lead, Agency Name"} /></Field>
          <Field label="Update app password" hint="optional"><Input type="password" value={f.password} onChange={(e) => set("password", e.target.value)} /></Field>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warmup</h4>
          <Toggle checked={f.warmupEnabled} onChange={(v) => set("warmupEnabled", v)} label="Warmup enabled" hint={`Health: ${account.health.score ?? "—"}% inbox · ${account.health.sent} sent / ${account.health.received} received (14d)`} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start per day"><Input type="number" value={f.warmupStart} onChange={(e) => set("warmupStart", Number(e.target.value))} /></Field>
            <Field label="Increase per day"><Input type="number" value={f.warmupIncrement} onChange={(e) => set("warmupIncrement", Number(e.target.value))} /></Field>
            <Field label="Max per day"><Input type="number" value={f.warmupMax} onChange={(e) => set("warmupMax", Number(e.target.value))} /></Field>
            <Field label="Reply rate %"><Input type="number" value={f.warmupReplyRate} onChange={(e) => set("warmupReplyRate", Number(e.target.value))} /></Field>
          </div>
          <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Domain DNS ({dns?.domain || "…"})</h4>
          <div className="space-y-1.5">
            {dns ? (
              (["mx", "spf", "dkim", "dmarc"] as const).map((k) => (
                <div key={k} className="flex items-start gap-2 text-sm">
                  {dns[k].ok ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                  <div className="min-w-0">
                    <span className="font-medium uppercase">{k}</span>
                    <div className="truncate text-xs text-slate-500" title={dns[k].value || dns[k].hint}>{dns[k].ok ? dns[k].value : dns[k].hint || "Missing"}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">Checking…</div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={testing}
            onClick={async () => {
              setTesting(true);
              try {
                await api(`/api/accounts/${account.id}/test`, { method: "POST" });
                toast("Connection OK");
                onSaved();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setTesting(false);
              }
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Test connection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await api(`/api/accounts/${account.id}`, { method: "PATCH", body: { status: account.status === "PAUSED" ? "ACTIVE" : "PAUSED" } });
              onSaved();
              onClose();
            }}
          >
            {account.status === "PAUSED" ? "Resume sending" : "Pause sending"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600"
            onClick={async () => {
              if (!confirm(`Remove ${account.email}? Its sent history stays in campaigns.`)) return;
              await api(`/api/accounts/${account.id}`, { method: "DELETE" });
              onSaved();
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
        <Button loading={saving} onClick={save}>Save changes</Button>
      </div>
    </Modal>
  );
}
