"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, Input, Select, Toggle, useToast } from "@/components/ui";
import { TIMEZONES } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { CampaignFull } from "./types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleTab({ campaign, onSaved }: { campaign: CampaignFull; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ timezone: campaign.timezone, days: campaign.days, startTime: campaign.startTime, endTime: campaign.endTime, dailyLimit: campaign.dailyLimit });
  const [saving, setSaving] = useState(false);
  return (
    <Card title="Sending schedule" className="max-w-2xl">
      <div className="space-y-4 p-4">
        <Field label="Timezone (use your leads' timezone)">
          <Select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">Days</div>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })}
                className={cn("h-9 w-12 rounded-lg border text-sm font-medium", f.days.includes(i) ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-600")}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field label="To"><Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
        </div>
        <Field label="Max emails per day for this campaign" hint="each inbox's own daily limit also applies">
          <Input type="number" min={1} value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: Number(e.target.value) })} />
        </Field>
        <Button loading={saving} onClick={async () => {
          setSaving(true);
          try {
            await api(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: f });
            toast("Schedule saved");
            onSaved();
          } catch (e) {
            toast((e as Error).message, "error");
          } finally {
            setSaving(false);
          }
        }}><Save className="h-4 w-4" /> Save schedule</Button>
      </div>
    </Card>
  );
}

export function OptionsTab({ campaign, accounts, clients, onSaved }: {
  campaign: CampaignFull;
  accounts: { id: string; email: string; fromName: string; status: string; tags: string[]; dailyLimit: number }[];
  clients: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set(campaign.accountIds));
  const [o, setO] = useState({
    stopOnReply: campaign.stopOnReply, stopOnAutoReply: campaign.stopOnAutoReply, stopForCompany: campaign.stopForCompany,
    openTracking: campaign.openTracking, linkTracking: campaign.linkTracking, textOnly: campaign.textOnly,
    unsubscribeLink: campaign.unsubscribeLink, prioritizeNewLeads: campaign.prioritizeNewLeads, clientId: campaign.clientId || "",
  });
  const [saving, setSaving] = useState(false);
  const tags = [...new Set(accounts.flatMap((a) => a.tags))];
  const capacity = accounts.filter((a) => ids.has(a.id)).reduce((s, a) => s + a.dailyLimit, 0);
  const set = (k: keyof typeof o, v: boolean | string) => setO({ ...o, [k]: v });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Sending accounts (${ids.size})`} actions={<span className="text-xs text-slate-500">{capacity}/day capacity</span>}>
        <div className="p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button className="rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50" onClick={() => setIds(new Set(accounts.map((a) => a.id)))}>Select all</button>
            <button className="rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50" onClick={() => setIds(new Set())}>Clear</button>
            {tags.map((t) => (
              <button key={t} className="rounded-full border border-brand/30 px-2.5 py-1 text-xs text-brand hover:bg-brand/5" onClick={() => setIds(new Set([...ids, ...accounts.filter((a) => a.tags.includes(t)).map((a) => a.id)]))}>+ {t}</button>
            ))}
          </div>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {accounts.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={ids.has(a.id)} onChange={() => { const s = new Set(ids); if (s.has(a.id)) s.delete(a.id); else s.add(a.id); setIds(s); }} />
                <span className="flex-1 text-sm">{a.email}<span className="ml-2 text-xs text-slate-500">{a.fromName}</span></span>
                {a.status !== "ACTIVE" && <Badge color={a.status === "ERROR" ? "red" : "yellow"}>{a.status.toLowerCase()}</Badge>}
                <span className="text-xs text-slate-400">{a.dailyLimit}/day</span>
              </label>
            ))}
            {!accounts.length && <p className="text-sm text-slate-500">No email accounts connected yet.</p>}
          </div>
          <p className="mt-2 text-xs text-slate-500">Emails rotate across selected inboxes. Each lead keeps the same inbox for all follow-ups.</p>
        </div>
      </Card>
      <Card title="Options">
        <div className="space-y-1 p-4">
          <Toggle checked={o.stopOnReply} onChange={(v) => set("stopOnReply", v)} label="Stop sending when a lead replies" />
          <Toggle checked={o.stopOnAutoReply} onChange={(v) => set("stopOnAutoReply", v)} label="Stop on auto-replies too" hint="Out-of-office messages" />
          <Toggle checked={o.stopForCompany} onChange={(v) => set("stopForCompany", v)} label="Stop for the whole company on reply" hint="Stops other leads with the same email domain" />
          <Toggle checked={o.openTracking} onChange={(v) => set("openTracking", v)} label="Track opens" hint="Invisible pixel. Turn off for best deliverability." />
          <Toggle checked={o.linkTracking} onChange={(v) => set("linkTracking", v)} label="Track link clicks" hint="Use a custom tracking domain (Settings) when on" />
          <Toggle checked={o.textOnly} onChange={(v) => set("textOnly", v)} label="Send as plain text only" hint="No HTML, no tracking — highest deliverability" />
          <Toggle checked={o.unsubscribeLink} onChange={(v) => set("unsubscribeLink", v)} label="Include unsubscribe link + header" hint="Recommended; required by Gmail/Yahoo bulk sender rules" />
          <Toggle checked={o.prioritizeNewLeads} onChange={(v) => set("prioritizeNewLeads", v)} label="Prioritize new leads over follow-ups" />
          <div className="pt-3">
            <Field label="Client">
              <Select value={o.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">No client (internal)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="pt-3">
            <Button loading={saving} onClick={async () => {
              setSaving(true);
              try {
                await api(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: { ...o, clientId: o.clientId || null, accountIds: [...ids] } });
                toast("Options saved");
                onSaved();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}><Save className="h-4 w-4" /> Save options</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
