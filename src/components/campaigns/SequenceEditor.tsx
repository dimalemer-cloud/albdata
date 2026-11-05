"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Sparkles, Eye, Send, Clock, Wand2, ChevronLeft, ChevronRight, AlertTriangle, Save } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CampaignFull, Step } from "./types";

const VARS = ["firstName", "lastName", "companyName", "city", "website", "title", "senderFirstName", "dayOfWeek", "timeOfDay"];
const LABELS = "ABCDEFGH".split("");

type Preview = { subject: string; html: string; missing: string[]; spam: { score: number; issues: string[]; wordCount: number }; lead: { email: string; name: string; company: string | null }; leadIndex: number; totalLeads: number };

export function SequenceEditor({ campaign, aiEnabled, accounts, onSaved }: { campaign: CampaignFull; aiEnabled: boolean; accounts: { id: string; email: string }[]; onSaved: () => void }) {
  const toast = useToast();
  const [steps, setSteps] = useState<Step[]>(() => structuredClone(campaign.steps));
  const [si, setSi] = useState(0);
  const [vi, setVi] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [leadIndex, setLeadIndex] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<"subject" | "body">("body");

  const step = steps[si];
  const variant = step?.variants[vi];

  const update = (fn: (s: Step[]) => void) => {
    setSteps((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  useEffect(() => {
    if (!variant) return;
    const t = setTimeout(() => {
      api<Preview>(`/api/campaigns/${campaign.id}/preview`, { body: { subject: variant.subject || (si > 0 ? "Re: (previous subject)" : ""), body: variant.body, leadIndex } })
        .then(setPreview)
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [variant?.subject, variant?.body, leadIndex, campaign.id, si, variant]);

  const insertVar = (v: string) => {
    const token = `{{${v}}}`;
    const el = focus === "subject" ? subjectRef.current : bodyRef.current;
    const key = focus === "subject" ? "subject" : "body";
    const cur = variant?.[key] || "";
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    update((s) => {
      s[si].variants[vi][key] = cur.slice(0, start) + token + cur.slice(end);
    });
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api<Step[]>(`/api/campaigns/${campaign.id}/sequence`, { method: "PUT", body: { steps } });
      setSteps(saved);
      setDirty(false);
      toast("Sequence saved");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Steps rail */}
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.id || i}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1 pl-4 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" /> Wait
                <Input
                  type="number"
                  min={0}
                  className="h-7 w-14 px-2 text-xs"
                  value={s.delayDays}
                  onChange={(e) => update((st) => { st[i].delayDays = Number(e.target.value); })}
                />
                days
              </div>
            )}
            <button
              onClick={() => { setSi(i); setVi(0); }}
              className={cn("w-full rounded-xl border bg-white p-3 text-left shadow-sm transition", si === i ? "border-brand ring-2 ring-brand/15" : "border-slate-200 hover:border-slate-300")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Step {i + 1}</span>
                <span className="flex gap-1">{s.variants.map((v) => <Badge key={v.label} color={v.enabled ? "brand" : "gray"}>{v.label}</Badge>)}</span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{s.variants[0]?.subject || (i > 0 ? "↳ Reply in same thread" : "No subject yet")}</div>
            </button>
          </div>
        ))}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => { update((s) => { s.push({ delayDays: 3, variants: [{ label: "A", subject: "", body: "", enabled: true }] }); }); setSi(steps.length); setVi(0); }}
        >
          <Plus className="h-4 w-4" /> Add step
        </Button>
        {aiEnabled && (
          <Button variant="secondary" className="w-full" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" /> Write sequence with AI</Button>
        )}
      </div>

      {/* Editor */}
      {step && variant && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title={
              <div className="flex items-center gap-1">
                {step.variants.map((v, j) => (
                  <button key={j} onClick={() => setVi(j)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", vi === j ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                    Variant {v.label}
                  </button>
                ))}
                {step.variants.length < 8 && (
                  <button
                    title="Add A/B variant"
                    className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                    onClick={() => { update((s) => { const src = s[si].variants[vi]; s[si].variants.push({ label: LABELS[s[si].variants.length], subject: src.subject, body: src.body, enabled: true }); }); setVi(step.variants.length); }}
                  >
                    <Plus className="inline h-3.5 w-3.5" /> A/B
                  </button>
                )}
              </div>
            }
            actions={
              <>
                {step.variants.length > 1 && (
                  <Toggle checked={variant.enabled} onChange={(v) => update((s) => { s[si].variants[vi].enabled = v; })} />
                )}
                <button
                  title={step.variants.length > 1 ? "Delete variant" : "Delete step"}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  disabled={steps.length === 1 && step.variants.length === 1}
                  onClick={() => {
                    if (step.variants.length > 1) {
                      update((s) => { s[si].variants.splice(vi, 1); s[si].variants.forEach((v, k) => (v.label = LABELS[k])); });
                      setVi(0);
                    } else {
                      update((s) => { s.splice(si, 1); });
                      setSi(Math.max(0, si - 1));
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            }
          >
            <div className="space-y-3 p-4">
              <Field label="Subject" hint={si > 0 ? "leave empty to reply in the same thread" : undefined}>
                <Input
                  ref={subjectRef}
                  value={variant.subject}
                  onFocus={() => setFocus("subject")}
                  onChange={(e) => update((s) => { s[si].variants[vi].subject = e.target.value; })}
                  placeholder={si > 0 ? "(empty = Re: previous subject)" : "Quick question about {{companyName}}"}
                />
              </Field>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs font-medium text-slate-600">Insert:</span>
                  {VARS.map((v) => (
                    <button key={v} onClick={() => insertVar(v)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-brand/10 hover:text-brand">{v}</button>
                  ))}
                </div>
                <Textarea
                  ref={bodyRef}
                  rows={14}
                  className="font-[inherit] leading-relaxed"
                  value={variant.body}
                  onFocus={() => setFocus("body")}
                  onChange={(e) => update((s) => { s[si].variants[vi].body = e.target.value; })}
                  placeholder={"Hi {{firstName|there}},\n\n{Noticed|Saw} {{companyName}} ...\n\nWorth a quick chat?\n\n{{senderFirstName}}"}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Variables: <code>{"{{firstName|there}}"}</code> adds a fallback. Spintax: <code>{"{Hi|Hello|Hey}"}</code> picks one at random. Any CSV column works as <code>{"{{columnName}}"}</code>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button onClick={save} loading={saving} disabled={!dirty}><Save className="h-4 w-4" /> {dirty ? "Save sequence" : "Saved"}</Button>
                {aiEnabled && <Button variant="outline" onClick={() => setRewriteOpen(true)}><Wand2 className="h-4 w-4" /> Improve with AI</Button>}
                <Button variant="outline" onClick={() => setTestOpen(true)}><Send className="h-4 w-4" /> Send test</Button>
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> Preview</span>}
            actions={
              preview && preview.totalLeads > 1 ? (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <button className="rounded p-1 hover:bg-slate-100" onClick={() => setLeadIndex((i) => Math.max(0, i - 1))}><ChevronLeft className="h-4 w-4" /></button>
                  Lead {(preview.leadIndex % preview.totalLeads) + 1}/{preview.totalLeads}
                  <button className="rounded p-1 hover:bg-slate-100" onClick={() => setLeadIndex((i) => i + 1)}><ChevronRight className="h-4 w-4" /></button>
                </div>
              ) : null
            }
          >
            {preview ? (
              <div className="p-4">
                <div className="mb-1 text-xs text-slate-500">To: {preview.lead.name ? `${preview.lead.name} <${preview.lead.email}>` : preview.lead.email}{preview.totalLeads === 0 && " (sample lead)"}</div>
                <div className="mb-3 text-sm font-semibold">{preview.subject || <span className="text-slate-400">(no subject)</span>}</div>
                <div className="prose-email rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
                {preview.missing.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    This lead has no value for: {preview.missing.map((m) => `{{${m}}}`).join(", ")}. Add a fallback like {"{{firstName|there}}"}.
                  </div>
                )}
                <div className="mt-3 rounded-lg border border-slate-100 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Deliverability check</span>
                    <Badge color={preview.spam.score >= 80 ? "green" : preview.spam.score >= 60 ? "yellow" : "red"}>{preview.spam.score}/100 · {preview.spam.wordCount} words</Badge>
                  </div>
                  {preview.spam.issues.length > 0 ? (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-slate-600">{preview.spam.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                  ) : (
                    <p className="mt-1 text-xs text-emerald-700">Looks clean.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-400">Start typing to see a preview.</div>
            )}
          </Card>
        </div>
      )}

      <AiSequenceModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onResult={(gen) => {
          setSteps(gen.map((g, i) => ({ id: steps[i]?.id, delayDays: i === 0 ? 0 : g.delayDays, variants: [{ id: steps[i]?.variants[0]?.id, label: "A", subject: g.subject, body: g.body, enabled: true }, ...(g.variantBBody ? [{ id: steps[i]?.variants[1]?.id, label: "B", subject: g.variantBSubject, body: g.variantBBody, enabled: true }] : [])] })));
          setSi(0);
          setVi(0);
          setDirty(true);
          setAiOpen(false);
          toast("Sequence drafted — review and save");
        }}
      />
      <RewriteModal
        open={rewriteOpen}
        onClose={() => setRewriteOpen(false)}
        subject={variant?.subject || ""}
        body={variant?.body || ""}
        onResult={(r) => { update((s) => { if (si === 0 || s[si].variants[vi].subject) s[si].variants[vi].subject = r.subject; s[si].variants[vi].body = r.body; }); setRewriteOpen(false); }}
      />
      <TestModal open={testOpen} onClose={() => setTestOpen(false)} campaignId={campaign.id} accounts={accounts.filter((a) => campaign.accountIds.includes(a.id))} subject={variant?.subject || ""} body={variant?.body || ""} />
    </div>
  );
}

type GenStep = { delayDays: number; subject: string; body: string; variantBSubject: string; variantBBody: string };

function AiSequenceModal({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (s: GenStep[]) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ offer: "", audience: "", tone: "friendly, direct, no fluff", steps: 3 });
  const [loading, setLoading] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Write a sequence with AI" wide>
      <div className="space-y-3">
        <Field label="What are you offering?"><Textarea rows={3} value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} placeholder="We build high-converting websites for dental clinics, with online booking. Typical result: +30% new patient bookings in 90 days." /></Field>
        <Field label="Who are you writing to?"><Input value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="Owners of independent dental clinics in the US" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tone"><Input value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} /></Field>
          <Field label="Number of steps"><Select value={f.steps} onChange={(e) => setF({ ...f, steps: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
        </div>
        <p className="text-xs text-slate-500">Replaces the current sequence in the editor (not saved until you click Save). Includes an A/B variant for each step.</p>
        <div className="flex justify-end">
          <Button loading={loading} onClick={async () => {
            setLoading(true);
            try {
              const r = await api<{ steps: GenStep[] }>("/api/ai/sequence", { body: f });
              onResult(r.steps);
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setLoading(false);
            }
          }}><Sparkles className="h-4 w-4" /> Generate</Button>
        </div>
      </div>
    </Modal>
  );
}

function RewriteModal({ open, onClose, subject, body, onResult }: { open: boolean; onClose: () => void; subject: string; body: string; onResult: (r: { subject: string; body: string }) => void }) {
  const toast = useToast();
  const [instruction, setInstruction] = useState("Make it shorter and more personal");
  const [loading, setLoading] = useState(false);
  const presets = ["Make it shorter and more personal", "Make the call-to-action softer", "Write a more curious subject line", "Remove anything that sounds salesy", "Translate to Albanian", "Make it more casual"];
  return (
    <Modal open={open} onClose={onClose} title="Improve with AI">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{presets.map((p) => <button key={p} onClick={() => setInstruction(p)} className={cn("rounded-full border px-2.5 py-1 text-xs", instruction === p ? "border-brand bg-brand/10 text-brand" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>{p}</button>)}</div>
        <Field label="Instruction"><Input value={instruction} onChange={(e) => setInstruction(e.target.value)} /></Field>
        <div className="flex justify-end">
          <Button loading={loading} onClick={async () => {
            setLoading(true);
            try {
              onResult(await api<{ subject: string; body: string }>("/api/ai/rewrite", { body: { subject, body, instruction } }));
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setLoading(false);
            }
          }}><Wand2 className="h-4 w-4" /> Rewrite</Button>
        </div>
      </div>
    </Modal>
  );
}

function TestModal({ open, onClose, campaignId, accounts, subject, body }: { open: boolean; onClose: () => void; campaignId: string; accounts: { id: string; email: string }[]; subject: string; body: string }) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Send a test email">
      <div className="space-y-3">
        <Field label="Send to"><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@yourdomain.com" /></Field>
        <Field label="From account">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">First campaign account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-slate-500">Variables are filled with the campaign's first lead.</p>
        <div className="flex justify-end">
          <Button loading={loading} onClick={async () => {
            setLoading(true);
            try {
              const r = await api<{ from: string }>(`/api/campaigns/${campaignId}/test`, { body: { to, subject, body, accountId: accountId || undefined } });
              toast(`Test sent from ${r.from}`);
              onClose();
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setLoading(false);
            }
          }}><Send className="h-4 w-4" /> Send test</Button>
        </div>
      </div>
    </Modal>
  );
}
