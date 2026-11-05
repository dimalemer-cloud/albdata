"use client";
import { useState } from "react";
import Papa from "papaparse";
import { FileUp } from "lucide-react";
import { api } from "@/lib/client";
import { Button, useToast } from "@/components/ui";

const KNOWN: Record<string, RegExp> = {
  email: /^e-?mail|email address/i, firstName: /^first|fname/i, lastName: /^last|lname|surname/i, companyName: /company|organi[sz]ation|business/i,
  title: /title|position|role/i, website: /website|url|domain/i, phone: /phone|mobile/i, city: /city|town/i, country: /country/i, linkedin: /linkedin/i,
};
const camel = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");

/** Quick CSV upload for campaigns: auto-maps columns, extra columns become variables. */
export function CsvImportInline({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-brand hover:bg-brand/5">
      <FileUp className="mb-2 h-8 w-8 text-slate-400" />
      <span className="text-sm font-medium">{loading ? "Importing…" : "Choose a CSV file"}</span>
      <span className="mt-1 text-xs text-slate-500">Saved as a new lead list and added to this campaign.</span>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLoading(true);
          Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (res) => {
              const headers = res.meta.fields || [];
              const mapping: Record<string, string> = {};
              const used = new Set<string>();
              for (const h of headers) {
                const k = Object.entries(KNOWN).find(([key, re]) => !used.has(key) && re.test(h))?.[0];
                if (k) { mapping[h] = k; used.add(k); } else mapping[h] = `custom:${camel(h)}`;
              }
              if (!used.has("email")) { toast("No email column found", "error"); setLoading(false); return; }
              const leads = res.data.map((r) => {
                const l: Record<string, unknown> = { customFields: {} };
                for (const h of headers) {
                  const v = r[h]?.trim();
                  if (!v) continue;
                  if (mapping[h].startsWith("custom:")) (l.customFields as Record<string, string>)[mapping[h].slice(7)] = v;
                  else l[mapping[h]] = v;
                }
                return l;
              });
              try {
                const out = await api<{ imported: number; added: number; invalid: number }>(`/api/campaigns/${campaignId}/leads`, { body: { action: "add_csv", leads } });
                toast(`${out.added} leads added · ${out.invalid} invalid rows`);
                onDone();
              } catch (err) {
                toast((err as Error).message, "error");
              } finally {
                setLoading(false);
              }
            },
          });
        }}
      />
      {loading && <Button className="mt-3" loading size="sm">Importing</Button>}
    </label>
  );
}
