"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPinned, Search, Globe, Phone, Star, Mail, Loader2, Save, ScanSearch, Trash2, UserSearch, ShieldCheck} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, Tabs, Toggle, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type SearchRow = { id: string; query: string; location: string; source: string; status: string; error: string | null; resultCount: number; withEmail: number; createdAt: string };
type Result = {
  id: string; name: string; category: string | null; address: string | null; city: string | null; phone: string | null; website: string | null; domain: string | null;
  rating: number | null; reviews: number | null; emails: string[]; contacts: { name: string; title: string; email: string }[]; socials: Record<string, string>;
  crawlStatus: string; crawlError: string | null; savedAt: string | null;
};
type Detail = { search: SearchRow; results: Result[]; crawling: number; pending: number; jobs: number };

const EXAMPLES = ["dentists", "real estate agents", "law firms", "gyms", "restaurants", "plumbers", "hair salons", "accountants", "hotels", "marketing agency"];

export function Finder({ hasPlaces, aiEnabled, lists, clients }: { hasPlaces: boolean; aiEnabled: boolean; lists: { id: string; name: string }[]; clients: { id: string; name: string }[] }) {
  const [tab, setTab] = useState("businesses");
  return (
    <div>
      <PageHeader title="Lead Finder" subtitle="Find local businesses, crawl their websites for emails and people, verify, and save to a lead list." />
      <Tabs tabs={[{ id: "businesses", label: "Business search" }, { id: "email", label: "Email finder" }, { id: "verify", label: "Email verifier" }]} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "businesses" && <BusinessSearch hasPlaces={hasPlaces} aiEnabled={aiEnabled} lists={lists} clients={clients} />}
        {tab === "email" && <EmailFinderTool />}
        {tab === "verify" && <VerifierTool />}
      </div>
    </div>
  );
}

function BusinessSearch({ hasPlaces, aiEnabled, lists, clients }: { hasPlaces: boolean; aiEnabled: boolean; lists: { id: string; name: string }[]; clients: { id: string; name: string }[] }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState(hasPlaces ? "google" : "osm");
  const [autoCrawl, setAutoCrawl] = useState(true);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSearches = useCallback(() => api<SearchRow[]>("/api/finder/searches").then((s) => { setSearches(s); return s; }), []);
  useEffect(() => {
    loadSearches().then((s) => s[0] && setActiveId((id) => id ?? s[0].id));
  }, [loadSearches]);

  const loadDetail = useCallback(async () => {
    if (!activeId) return;
    const d = await api<Detail>(`/api/finder/searches/${activeId}${onlyEmail ? "?hasEmail=1" : ""}`);
    setDetail(d);
    return d;
  }, [activeId, onlyEmail]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const d = await loadDetail().catch(() => null);
      if (stop) return;
      const busy = d && (d.search.status === "QUEUED" || d.search.status === "RUNNING" || d.crawling > 0 || (d.pending > 0 && d.jobs > 0));
      if (busy) setTimeout(tick, 2500);
      else loadSearches();
    };
    tick();
    return () => { stop = true; };
  }, [loadDetail, loadSearches]);

  const run = async () => {
    if (!query || !location) return toast("Enter a business type and a location", "error");
    setLoading(true);
    try {
      const s = await api<SearchRow>("/api/finder/searches", { body: { query, location, source, autoCrawl } });
      setSel(new Set());
      await loadSearches();
      setActiveId(s.id);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const results = detail?.results || [];
  const withEmail = results.filter((r) => r.emails.length).length;
  const status = detail?.search.status;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
            <Field label="Business type"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. dentists" list="finder-examples" onKeyDown={(e) => e.key === "Enter" && run()} /></Field>
            <datalist id="finder-examples">{EXAMPLES.map((x) => <option key={x} value={x} />)}</datalist>
            <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Austin, TX or Tirana, Albania" onKeyDown={(e) => e.key === "Enter" && run()} /></Field>
            <div className="flex items-end"><Button className="w-full md:w-auto" loading={loading} onClick={run}><Search className="h-4 w-4" /> Search</Button></div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-slate-600">Source</span>
              <Select className="h-8 w-56 text-xs" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="osm">OpenStreetMap (free)</option>
                <option value="google" disabled={!hasPlaces}>Google Maps (Places API){hasPlaces ? "" : " — add key in Settings"}</option>
              </Select>
            </div>
            <Toggle checked={autoCrawl} onChange={setAutoCrawl} label="Find emails automatically" hint={aiEnabled ? "Crawls each website + AI extracts owner/staff names" : "Crawls each website's contact, about and team pages"} />
          </div>
        </Card>

        {detail ? (
          <Card
            title={<span>{detail.search.query} in {detail.search.location} <span className="font-normal text-slate-500">· {results.length} businesses · {withEmail} with email</span></span>}
            actions={<Toggle checked={onlyEmail} onChange={setOnlyEmail} hint="Only with email" />}
          >
            {(status === "QUEUED" || status === "RUNNING") && <div className="flex items-center gap-2 border-b border-slate-100 bg-brand/5 px-4 py-2.5 text-sm"><Loader2 className="h-4 w-4 animate-spin text-brand" /> Searching {detail.search.source === "google" ? "Google Maps" : "OpenStreetMap"}…</div>}
            {status === "ERROR" && <div className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">{detail.search.error}</div>}
            {detail.crawling + (detail.jobs ? detail.pending : 0) > 0 && (
              <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><Loader2 className="h-4 w-4 animate-spin" /> Crawling websites for emails… {results.filter((r) => ["DONE", "FAILED", "NO_WEBSITE"].includes(r.crawlStatus)).length}/{results.length}</div>
            )}
            {sel.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-brand/5 px-4 py-2 text-sm">
                <b>{sel.size}</b> selected <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={async () => { try { await api("/api/finder/crawl", { body: { resultIds: [...sel] } }); toast("Finding emails…"); setTimeout(loadDetail, 1000); loadDetail(); } catch (e) { toast((e as Error).message, "error"); } }}><ScanSearch className="h-3.5 w-3.5" /> Find emails</Button>
                <Button size="sm" onClick={() => setSaving(true)}><Save className="h-3.5 w-3.5" /> Save to list</Button>
              </div>
            )}
            {results.length === 0 && status === "DONE" ? (
              <EmptyState icon={<MapPinned className="h-6 w-6" />} title="No businesses found" text="Try a broader term (e.g. “dentist”) or a smaller/larger area. Google Maps usually finds more than OpenStreetMap." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-8"><input type="checkbox" checked={!!results.length && results.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(results.map((r) => r.id)) : new Set())} /></th>
                      <th>Business</th><th>Contact</th><th>Emails found</th><th>People</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => { const s = new Set(sel); if (s.has(r.id)) s.delete(r.id); else s.add(r.id); setSel(s); }} /></td>
                        <td className="max-w-[280px]">
                          <div className="font-medium">{r.name} {r.savedAt && <Badge color="green">saved</Badge>}</div>
                          <div className="truncate text-xs text-slate-500">{[r.category, r.address || r.city].filter(Boolean).join(" · ")}</div>
                          {r.rating != null && <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600"><Star className="h-3 w-3 fill-current" />{r.rating} <span className="text-slate-400">({r.reviews})</span></div>}
                        </td>
                        <td className="text-xs">
                          {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand hover:underline"><Globe className="h-3 w-3" />{r.domain}</a> : <span className="text-slate-400">No website</span>}
                          {r.phone && <div className="mt-0.5 flex items-center gap-1 text-slate-600"><Phone className="h-3 w-3" />{r.phone}</div>}
                          <div className="mt-1 flex gap-1">
                            {(["facebook", "instagram", "linkedin", "twitter", "youtube", "tiktok"] as const).filter((k) => r.socials?.[k]).map((k) => (
                              <a key={k} href={r.socials[k]} target="_blank" rel="noreferrer" className="rounded bg-slate-100 px-1 text-[10px] font-semibold uppercase text-slate-500 hover:bg-brand/10 hover:text-brand">{({ facebook: "fb", instagram: "ig", linkedin: "in", twitter: "x", youtube: "yt", tiktok: "tt" } as const)[k]}</a>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-[260px]">
                          {r.emails.length ? (
                            <div className="flex flex-wrap gap-1">{r.emails.slice(0, 4).map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-200"><Mail className="h-3 w-3" />{e}</span>)}{r.emails.length > 4 && <span className="text-xs text-slate-400">+{r.emails.length - 4}</span>}</div>
                          ) : r.crawlStatus === "RUNNING" || (r.crawlStatus === "PENDING" && detail.jobs > 0) ? (
                            <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> searching</span>
                          ) : (
                            <span className="text-xs text-slate-400" title={r.crawlError || ""}>{r.crawlStatus === "FAILED" ? "Site unreachable" : r.crawlStatus === "NO_WEBSITE" ? "—" : r.crawlStatus === "DONE" ? "None found" : "Not searched"}</span>
                          )}
                        </td>
                        <td className="max-w-[220px] text-xs">
                          {r.contacts?.slice(0, 3).map((c) => <div key={c.name} className="truncate"><span className="font-medium">{c.name}</span>{c.title && <span className="text-slate-500"> · {c.title}</span>}</div>)}
                          {!r.contacts?.length && <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <Card><EmptyState icon={<MapPinned className="h-6 w-6" />} title="Search for local businesses" text="Example: “dentists” in “Miami, FL”. We'll pull businesses with websites and phones, then crawl each site for emails and owner names." /></Card>
        )}
      </div>

      <Card title="Recent searches">
        <div className="max-h-[70vh] overflow-y-auto">
          {!searches.length && <p className="p-4 text-sm text-slate-500">No searches yet.</p>}
          {searches.map((s) => (
            <div key={s.id} className={cn("group flex cursor-pointer items-start gap-2 border-b border-slate-100 px-4 py-2.5 hover:bg-slate-50", activeId === s.id && "bg-brand/5")} onClick={() => { setActiveId(s.id); setSel(new Set()); }}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.query}</div>
                <div className="truncate text-xs text-slate-500">{s.location}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  {s.status === "DONE" ? <>{s.resultCount} found · {s.withEmail} emails</> : <StatusBadge status={s.status === "ERROR" ? "ERROR" : "ACTIVE"} />}
                  <span>· {formatDistanceToNow(new Date(s.createdAt))}</span>
                </div>
              </div>
              <button className="invisible rounded p-1 text-slate-400 hover:text-red-600 group-hover:visible" onClick={async (e) => { e.stopPropagation(); await api(`/api/finder/searches/${s.id}`, { method: "DELETE" }); if (activeId === s.id) { setActiveId(null); setDetail(null); } loadSearches(); }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </Card>

      <SaveModal open={saving} onClose={() => setSaving(false)} resultIds={[...sel]} lists={lists} clients={clients} defaultName={detail ? `${detail.search.query} – ${detail.search.location}` : ""} onDone={() => { setSaving(false); setSel(new Set()); loadDetail(); }} />
    </div>
  );
}

function SaveModal({ open, onClose, resultIds, lists, clients, defaultName, onDone }: { open: boolean; onClose: () => void; resultIds: string[]; lists: { id: string; name: string }[]; clients: { id: string; name: string }[]; defaultName: string; onDone: () => void }) {
  const toast = useToast();
  const [listId, setListId] = useState("");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState("best");
  const [loading, setLoading] = useState(false);
  useEffect(() => setName(defaultName), [defaultName]);
  return (
    <Modal open={open} onClose={onClose} title={`Save ${resultIds.length} businesses as leads`}>
      <div className="space-y-3">
        <Field label="Lead list">
          <Select value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">+ Create new list</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        {!listId && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="New list name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">None</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          </div>
        )}
        <Field label="Emails per business">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="best">Best email only (recommended)</option>
            <option value="all">Every email found</option>
          </Select>
        </Field>
        <p className="text-xs text-slate-500">Businesses without an email are skipped. Category, address, rating and social links are saved as variables (e.g. {"{{rating}}"}, {"{{category}}"}).</p>
        <div className="flex justify-end">
          <Button loading={loading} onClick={async () => {
            setLoading(true);
            try {
              const r = await api<{ imported: number; duplicates: number; withoutEmail: number; listId: string }>("/api/finder/save", { body: { resultIds, listId: listId || undefined, newListName: name, clientId: clientId || null, mode } });
              toast(`${r.imported} leads saved · ${r.withoutEmail} had no email · ${r.duplicates} duplicates`);
              onDone();
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setLoading(false);
            }
          }}><Save className="h-4 w-4" /> Save leads</Button>
        </div>
      </div>
    </Modal>
  );
}

function EmailFinderTool() {
  const toast = useToast();
  const [f, setF] = useState({ firstName: "", lastName: "", domain: "" });
  const [r, setR] = useState<{ email: string | null; status: string; note: string; checked: { email: string; code: number | null }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <Card className="max-w-2xl">
      <div className="space-y-3 p-4">
        <p className="text-sm text-slate-600">Guess and confirm a person's email from their name and company domain. Works best on a server where outbound port 25 is open.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="First name"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Last name"><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Company domain"><Input value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="smiledental.com" /></Field>
        </div>
        <Button loading={loading} onClick={async () => { setLoading(true); try { setR(await api("/api/finder/email", { body: f })); } catch (e) { toast((e as Error).message, "error"); } finally { setLoading(false); } }}><UserSearch className="h-4 w-4" /> Find email</Button>
        {r && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{r.email || "Not found"}</span>
              <Badge color={r.status === "found" ? "green" : r.status === "not_found" ? "red" : "yellow"}>{r.status.replace("_", " ")}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.note}</p>
            {r.checked.length > 0 && <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-slate-600">{r.checked.map((c) => <div key={c.email}>{c.email} <span className={c.code && c.code < 300 ? "text-emerald-600" : "text-slate-400"}>{c.code ?? "–"}</span></div>)}</div>}
          </div>
        )}
      </div>
    </Card>
  );
}

function VerifierTool() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [r, setR] = useState<{ email: string; status: string; reason: string; role: boolean; free: boolean; disposable: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <Card className="max-w-2xl">
      <div className="space-y-3 p-4">
        <p className="text-sm text-slate-600">Checks syntax, disposable domains, MX records and asks the mail server whether the mailbox exists (SMTP check). To verify a whole list, open it in Leads and click “Verify”.</p>
        <div className="flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          <Button loading={loading} onClick={async () => { setLoading(true); try { setR(await api("/api/finder/verify", { body: { email } })); } catch (e) { toast((e as Error).message, "error"); } finally { setLoading(false); } }}><ShieldCheck className="h-4 w-4" /> Verify</Button>
        </div>
        {r && (
          <div className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex items-center gap-2"><span className="font-semibold">{r.email}</span><StatusBadge status={r.status} /></div>
            <p className="mt-1 text-xs text-slate-500">{r.reason}</p>
            <div className="mt-2 flex gap-1.5">{r.role && <Badge color="yellow">Role address</Badge>}{r.free && <Badge>Free provider</Badge>}{r.disposable && <Badge color="red">Disposable</Badge>}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
