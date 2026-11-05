"use client";
import { useState } from "react";
import Papa from "papaparse";
import { FileUp } from "lucide-react";
import { api } from "@/lib/client";
import { Button, Select, Toggle, useToast } from "@/components/ui";

const TARGETS = [
  { id: "email", label: "Email", match: /^e-?mail|email address|work email/i },
  { id: "firstName", label: "First name", match: /^first|fname|given/i },
  { id: "lastName", label: "Last name", match: /^last|lname|surname|family/i },
  { id: "fullName", label: "Full name (split)", match: /^(full )?name$|contact name/i },
  { id: "companyName", label: "Company", match: /company|organi[sz]ation|business|account name/i },
  { id: "title", label: "Job title", match: /title|position|role/i },
  { id: "website", label: "Website", match: /website|url|domain|site/i },
  { id: "phone", label: "Phone", match: /phone|mobile|tel/i },
  { id: "city", label: "City", match: /city|town|location/i },
  { id: "country", label: "Country", match: /country/i },
  { id: "linkedin", label: "LinkedIn", match: /linkedin/i },
];

function camel(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "") || "field";
}

export function CsvImport({ listId, onDone }: { listId: string; onDone: (r: { imported: number }) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [dedupeAll, setDedupeAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const onFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setRows(res.data);
        const m: Record<string, string> = {};
        const used = new Set<string>();
        for (const h of hs) {
          const t = TARGETS.find((t) => !used.has(t.id) && t.match.test(h));
          if (t) {
            m[h] = t.id;
            used.add(t.id);
          } else m[h] = "custom";
        }
        setMap(m);
      },
    });
  };

  const doImport = async () => {
    if (!rows) return;
    if (!Object.values(map).includes("email")) return toast("Map one column to Email", "error");
    setLoading(true);
    const leads = rows.map((r) => {
      const lead: Record<string, unknown> = { customFields: {} as Record<string, string> };
      for (const h of headers) {
        const target = map[h];
        const v = (r[h] ?? "").toString().trim();
        if (!v || target === "skip") continue;
        if (target === "custom") (lead.customFields as Record<string, string>)[camel(h)] = v;
        else if (target === "fullName") {
          const [first, ...rest] = v.split(/\s+/);
          lead.firstName ??= first;
          lead.lastName ??= rest.join(" ");
        } else lead[target] = v;
      }
      return lead;
    });
    try {
      let imported = 0, duplicates = 0, invalid = 0;
      for (let i = 0; i < leads.length; i += 5000) {
        const r = await api<{ imported: number; duplicates: number; invalid: number }>(`/api/lists/${listId}/leads`, { body: { leads: leads.slice(i, i + 5000), dedupe: dedupeAll ? "all" : "list" } });
        imported += r.imported; duplicates += r.duplicates; invalid += r.invalid;
      }
      toast(`Imported ${imported} leads · ${duplicates} duplicates · ${invalid} invalid`);
      setRows(null);
      onDone({ imported });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!rows) {
    return (
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-brand hover:bg-brand/5">
        <FileUp className="mb-2 h-8 w-8 text-slate-400" />
        <span className="text-sm font-medium">Choose a CSV file</span>
        <span className="mt-1 text-xs text-slate-500">Columns are matched automatically. Any extra column becomes a {"{{variable}}"}.</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
    );
  }
  return (
    <div>
      <div className="mb-3 text-sm text-slate-600"><b>{fileName}</b> · {rows.length} rows</div>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        <table className="table w-full">
          <thead><tr><th>CSV column</th><th>Sample</th><th>Import as</th></tr></thead>
          <tbody>
            {headers.map((h) => (
              <tr key={h}>
                <td className="font-medium">{h}</td>
                <td className="max-w-[180px] truncate text-xs text-slate-500">{rows[0]?.[h]}</td>
                <td className="w-48">
                  <Select value={map[h]} onChange={(e) => setMap({ ...map, [h]: e.target.value })}>
                    {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    <option value="custom">Custom variable {"{{" + camel(h) + "}}"}</option>
                    <option value="skip">Don't import</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3"><Toggle checked={dedupeAll} onChange={setDedupeAll} label="Skip leads that exist in any other list" hint="Otherwise only duplicates within this list are skipped" /></div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setRows(null)}>Back</Button>
        <Button loading={loading} onClick={doImport}>Import {rows.length} leads</Button>
      </div>
    </div>
  );
}
