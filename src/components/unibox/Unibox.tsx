"use client";
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Inbox, RefreshCw, Search, Sparkles, Send, Archive, ArchiveRestore, Mail, ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Badge, Button, EmptyState, Input, Select, StatusBadge, Textarea, useToast } from "@/components/ui";
import { cn, INTEREST_LABELS, stripQuoted } from "@/lib/utils";

type ThreadRow = { id: string; subject: string; contactEmail: string; contactName: string | null; company: string | null; interest: string | null; unread: boolean; lastMessageAt: string; campaign: string | null; account: string; snippet: string };
type ListResp = { threads: ThreadRow[]; counts: Record<string, number>; unread: number };
type Msg = { id: string; direction: string; fromEmail: string; fromName: string | null; toEmail: string; subject: string; bodyHtml: string; bodyText: string; sentAt: string; isAutoReply: boolean; category: string | null; openCount: number };
type ThreadFull = {
  id: string; subject: string; contactEmail: string; contactName: string | null; interest: string | null; archived: boolean;
  account: { email: string; fromName: string }; campaign: { id: string; name: string } | null;
  lead: { id: string; companyName: string | null; website: string | null; phone: string | null; city: string | null; title: string | null; status: string } | null;
  messages: Msg[]; deal: { id: string; stage: string; value: number } | null;
};

const FILTERS = [
  { id: "all", label: "All replies" },
  { id: "unread", label: "Unread" },
  { id: "INTERESTED", label: "Interested", dot: "#10b981" },
  { id: "MEETING_BOOKED", label: "Meeting booked", dot: "#3b82f6" },
  { id: "NEUTRAL", label: "Neutral", dot: "#94a3b8" },
  { id: "NOT_INTERESTED", label: "Not interested", dot: "#ef4444" },
  { id: "OUT_OF_OFFICE", label: "Out of office", dot: "#f59e0b" },
  { id: "WRONG_PERSON", label: "Wrong person", dot: "#64748b" },
  { id: "UNSUBSCRIBE", label: "Unsubscribed", dot: "#dc2626" },
  { id: "archived", label: "Archived" },
];

export function Unibox({ accounts, campaigns, aiEnabled }: { accounts: { id: string; email: string }[]; campaigns: { id: string; name: string }[]; aiEnabled: boolean }) {
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [list, setList] = useState<ListResp | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadFull | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadList = useCallback(() => {
    const sp = new URLSearchParams({ filter, ...(q ? { q } : {}), ...(accountId ? { accountId } : {}), ...(campaignId ? { campaignId } : {}) });
    api<ListResp>(`/api/unibox?${sp}`).then(setList);
  }, [filter, q, accountId, campaignId]);
  useEffect(() => {
    const t = setTimeout(loadList, 200);
    const iv = setInterval(loadList, 30_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [loadList]);
  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    const t = await api<ThreadFull>(`/api/unibox/${id}`);
    setThread(t);
    setList((l) => (l ? { ...l, threads: l.threads.map((x) => (x.id === id ? { ...x, unread: false } : x)) } : l));
  }, []);

  const label = async (interest: string) => {
    if (!thread) return;
    await api(`/api/unibox/${thread.id}`, { method: "PATCH", body: { interest } });
    toast(`Marked as ${INTEREST_LABELS[interest]?.label || interest}${interest === "INTERESTED" || interest === "MEETING_BOOKED" ? " · deal added to CRM" : ""}`);
    openThread(thread.id);
    loadList();
  };

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-57px)] sm:-mx-6 lg:-mx-8 lg:h-screen">
      {/* Filters */}
      <div className="hidden w-52 shrink-0 flex-col border-r border-slate-200 bg-white p-3 xl:flex">
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-base font-semibold">Unibox</h1>
          <button title="Sync now" disabled={syncing} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={async () => {
            setSyncing(true);
            try { const r = await api<{ synced: number; failed: number }>("/api/unibox/sync", { method: "POST" }); toast(`Synced ${r.synced} inboxes${r.failed ? `, ${r.failed} failed` : ""}`); loadList(); } catch (e) { toast((e as Error).message, "error"); } finally { setSyncing(false); }
          }}><RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} /></button>
        </div>
        {FILTERS.map((f) => {
          const n = f.id === "unread" ? list?.unread : f.id.toUpperCase() === f.id ? list?.counts[f.id] : undefined;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm", filter === f.id ? "bg-brand/10 font-medium text-brand" : "text-slate-600 hover:bg-slate-100")}>
              {f.dot ? <span className="h-2 w-2 rounded-full" style={{ background: f.dot }} /> : f.id === "archived" ? <Archive className="h-3.5 w-3.5" /> : <Inbox className="h-3.5 w-3.5" />}
              <span className="flex-1">{f.label}</span>
              {!!n && <span className="text-xs text-slate-400">{n}</span>}
            </button>
          );
        })}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="text-xs"><option value="">All inboxes</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}</Select>
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="text-xs"><option value="">All campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </div>
      </div>

      {/* Thread list */}
      <div className={cn("w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-80 lg:w-96", activeId ? "hidden md:flex" : "flex")}>
        <div className="space-y-2 border-b border-slate-100 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-8" placeholder="Search replies" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="xl:hidden" value={filter} onChange={(e) => setFilter(e.target.value)}>{FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list && !list.threads.length && <EmptyState icon={<Mail className="h-6 w-6" />} title="No replies here" text="Replies to your campaigns from every inbox show up here automatically." />}
          {(list?.threads || []).map((t) => (
            <button key={t.id} onClick={() => openThread(t.id)} className={cn("block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50", activeId === t.id && "bg-brand/5")}>
              <div className="flex items-center gap-2">
                {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                <span className={cn("flex-1 truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.contactName || t.contactEmail}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatDistanceToNow(new Date(t.lastMessageAt))}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-700">{t.subject}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.snippet}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {t.interest && <StatusBadge status={t.interest} />}
                {t.campaign && <Badge>{t.campaign}</Badge>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className={cn("min-w-0 flex-1 flex-col bg-slate-50", activeId ? "flex" : "hidden md:flex")}>
        {thread ? <Conversation key={thread.id} thread={thread} aiEnabled={aiEnabled} onBack={() => { setActiveId(null); setThread(null); }} onLabel={label} onChanged={() => { openThread(thread.id); loadList(); }} /> : <EmptyState icon={<Inbox className="h-6 w-6" />} title="Select a conversation" />}
      </div>
    </div>
  );
}

function InboundBody({ text }: { text: string }) {
  const [full, setFull] = useState(false);
  const clean = stripQuoted(text);
  const hasMore = clean.length < text.trim().length - 5;
  return (
    <div className="whitespace-pre-wrap break-words text-sm text-slate-800">
      {full || !clean ? text : clean}
      {hasMore && (
        <button onClick={() => setFull(!full)} className="mt-1 block rounded bg-slate-100 px-1.5 text-xs text-slate-500 hover:bg-slate-200">{full ? "Hide quoted text" : "•••"}</button>
      )}
    </div>
  );
}

function Conversation({ thread, aiEnabled, onBack, onLabel, onChanged }: { thread: ThreadFull; aiEnabled: boolean; onBack: () => void; onLabel: (i: string) => void; onChanged: () => void }) {
  const toast = useToast();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button className="rounded p-1 hover:bg-slate-100 md:hidden" onClick={onBack}><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{thread.subject}</div>
          <div className="truncate text-xs text-slate-500">{thread.contactName ? `${thread.contactName} · ` : ""}{thread.contactEmail} → {thread.account.email}</div>
        </div>
        <Select className="w-44" value={thread.interest || ""} onChange={(e) => e.target.value && onLabel(e.target.value)}>
          <option value="">Set status…</option>
          {Object.entries(INTEREST_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Button variant="outline" size="sm" onClick={async () => { await api(`/api/unibox/${thread.id}`, { method: "PATCH", body: { archived: !thread.archived } }); onChanged(); }}>
          {thread.archived ? <><ArchiveRestore className="h-3.5 w-3.5" /> Unarchive</> : <><Archive className="h-3.5 w-3.5" /> Archive</>}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {thread.messages.map((m) => (
              <div key={m.id} className={cn("max-w-3xl rounded-xl border bg-white p-4 shadow-sm", m.direction === "OUTBOUND" ? "ml-auto border-brand/20" : "border-slate-200")}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{m.direction === "OUTBOUND" ? `You (${m.fromEmail})` : m.fromName || m.fromEmail}</span>
                  <span>{format(new Date(m.sentAt), "MMM d, HH:mm")}</span>
                  {m.isAutoReply && <Badge color="yellow">Auto-reply</Badge>}
                  {m.category && m.direction === "INBOUND" && <StatusBadge status={m.category} />}
                  {m.direction === "OUTBOUND" && m.openCount > 0 && <Badge color="green">Opened {m.openCount}×</Badge>}
                </div>
                {m.direction === "INBOUND" ? (
                  <InboundBody text={m.bodyText} />
                ) : (
                  <div className="prose-email break-words text-sm" dangerouslySetInnerHTML={{ __html: m.bodyHtml.replace(/<img[^>]+\/t\/o\/[^>]+>/g, "") }} />
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${thread.contactName || thread.contactEmail}…`} />
            <div className="mt-2 flex items-center justify-between gap-2">
              {aiEnabled ? (
                <Button variant="outline" size="sm" loading={drafting} onClick={async () => {
                  setDrafting(true);
                  try { const r = await api<{ body: string }>("/api/ai/draft-reply", { body: { threadId: thread.id } }); setReply(r.body); } catch (e) { toast((e as Error).message, "error"); } finally { setDrafting(false); }
                }}><Sparkles className="h-3.5 w-3.5" /> Draft with AI</Button>
              ) : <span className="text-xs text-slate-400">Sent from {thread.account.email}</span>}
              <Button size="sm" loading={sending} disabled={!reply.trim()} onClick={async () => {
                setSending(true);
                try { await api(`/api/unibox/${thread.id}/reply`, { body: { body: reply } }); setReply(""); toast("Reply sent"); onChanged(); } catch (e) { toast((e as Error).message, "error"); } finally { setSending(false); }
              }}><Send className="h-3.5 w-3.5" /> Send</Button>
            </div>
          </div>
        </div>
        <aside className="hidden w-64 shrink-0 space-y-4 overflow-y-auto border-l border-slate-200 bg-white p-4 text-sm 2xl:block">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Lead</div>
            <div className="mt-1 font-medium">{thread.contactName || thread.contactEmail}</div>
            {thread.lead?.title && <div className="text-xs text-slate-500">{thread.lead.title}</div>}
            {thread.lead?.companyName && <div className="mt-1 flex items-center gap-1 text-slate-600"><Building2 className="h-3.5 w-3.5" /> {thread.lead.companyName}</div>}
            {thread.lead?.website && <a className="block truncate text-xs text-brand underline" href={thread.lead.website.startsWith("http") ? thread.lead.website : `https://${thread.lead.website}`} target="_blank" rel="noreferrer">{thread.lead.website}</a>}
            {thread.lead?.phone && <div className="text-xs text-slate-600">{thread.lead.phone}</div>}
            {thread.lead?.city && <div className="text-xs text-slate-500">{thread.lead.city}</div>}
          </div>
          {thread.campaign && <div><div className="text-xs font-semibold uppercase text-slate-500">Campaign</div><Link className="text-brand underline" href={`/campaigns/${thread.campaign.id}`}>{thread.campaign.name}</Link></div>}
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">CRM</div>
            {thread.deal ? <div className="mt-1"><Badge color="green">{thread.deal.stage}</Badge> <Link href="/crm" className="text-xs text-brand underline">Open pipeline</Link></div> : <div className="mt-1 text-xs text-slate-500">Mark as Interested to create a deal.</div>}
          </div>
        </aside>
      </div>
    </>
  );
}
