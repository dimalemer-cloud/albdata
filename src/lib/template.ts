import { escapeHtml } from "./utils";

export type TemplateLead = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  title?: string | null;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  linkedin?: string | null;
  customFields?: unknown;
};

export const BUILTIN_VARS = [
  "firstName", "lastName", "companyName", "title", "website", "phone", "city", "country", "email",
  "senderName", "senderFirstName", "dayOfWeek", "timeOfDay",
];

function varsFor(lead: TemplateLead, sender: { fromName: string; email: string }, tz = "UTC") {
  const custom = (lead.customFields && typeof lead.customFields === "object" ? lead.customFields : {}) as Record<string, unknown>;
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(now));
  const vars: Record<string, string> = {
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    companyName: lead.companyName || "",
    title: lead.title || "",
    website: lead.website || "",
    phone: lead.phone || "",
    city: lead.city || "",
    country: lead.country || "",
    email: lead.email,
    senderName: sender.fromName,
    senderFirstName: sender.fromName.split(" ")[0],
    dayOfWeek: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(now),
    timeOfDay: hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening",
  };
  for (const [k, v] of Object.entries(custom)) if (v != null) vars[k] = String(v);
  return vars;
}

function spin(input: string) {
  // {{RANDOM | a | b | c}}
  let out = input.replace(/\{\{\s*RANDOM\s*\|([^}]*)\}\}/gi, (_, opts: string) => {
    const choices = opts.split("|").map((s) => s.trim());
    return choices[Math.floor(Math.random() * choices.length)] ?? "";
  });
  // {a|b|c} (single braces only — never the inside of a {{variable|fallback}})
  out = out.replace(/(?<!\{)\{([^{}]*\|[^{}]*)\}(?!\})/g, (_, opts: string) => {
    const choices = opts.split("|");
    return choices[Math.floor(Math.random() * choices.length)] ?? "";
  });
  return out;
}

/** Render {{var}}, {{var|fallback}} and spintax. html=true escapes inserted values. */
export function render(
  tpl: string,
  lead: TemplateLead,
  sender: { fromName: string; email: string },
  opts: { html?: boolean; tz?: string } = {},
) {
  const vars = varsFor(lead, sender, opts.tz);
  const spun = spin(tpl);
  return spun.replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_, name: string, fallback?: string) => {
    const key = Object.keys(vars).find((k) => k.toLowerCase() === name.toLowerCase());
    const val = (key ? vars[key] : "") || (fallback ?? "").trim();
    return opts.html ? escapeHtml(val) : val;
  });
}

/** Missing variables for a lead (for preview warnings). */
export function missingVars(tpl: string, lead: TemplateLead) {
  const vars = varsFor(lead, { fromName: "x", email: "x" });
  const missing = new Set<string>();
  for (const m of tpl.matchAll(/\{\{\s*([\w.]+)\s*(\|[^}]*)?\}\}/g)) {
    if (m[1].toUpperCase() === "RANDOM" || m[2]) continue;
    const key = Object.keys(vars).find((k) => k.toLowerCase() === m[1].toLowerCase());
    if (!key || !vars[key]) missing.add(m[1]);
  }
  return [...missing];
}

/** Convert the editor's text (plain text with optional inline HTML) into email HTML. */
export function textToHtml(text: string) {
  const hasBlockHtml = /<(p|div|br|table|ul|ol)\b/i.test(text);
  let html = text;
  if (!hasBlockHtml) {
    html = text
      .split(/\n/)
      .map((line) => line)
      .join("<br>\n");
  }
  // auto-link bare URLs not already inside an href or tag
  html = html.replace(/(^|[\s>(])((https?:\/\/)[^\s<)]+)/g, (_, pre: string, url: string) => `${pre}<a href="${url}">${url}</a>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">${html}</div>`;
}

const SPAM_WORDS = [
  "100% free", "act now", "apply now", "as seen on", "best price", "buy now", "call now", "cash", "cheap", "click here",
  "congratulations", "dear friend", "double your", "earn money", "extra income", "free trial", "get paid", "guarantee",
  "increase sales", "limited time", "make money", "no cost", "no obligation", "offer expires", "once in a lifetime",
  "order now", "risk free", "special promotion", "this isn't spam", "urgent", "winner", "you have been selected", "$$$",
  "100%", "amazing", "incredible deal", "lowest price", "miracle", "unsubscribe", "viagra", "work from home",
];

export function spamCheck(text: string) {
  const lower = text.toLowerCase();
  const words = SPAM_WORDS.filter((w) => lower.includes(w));
  const links = (text.match(/https?:\/\//g) || []).length;
  const caps = (text.match(/\b[A-Z]{4,}\b/g) || []).length;
  const exclaim = (text.match(/!/g) || []).length;
  const issues: string[] = [];
  if (words.length) issues.push(`Spam-trigger words: ${words.join(", ")}`);
  if (links > 2) issues.push(`${links} links (keep to 0–1 in cold emails)`);
  if (caps > 2) issues.push(`${caps} ALL-CAPS words`);
  if (exclaim > 2) issues.push(`${exclaim} exclamation marks`);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 180) issues.push(`${wordCount} words (aim for under 120)`);
  return { score: Math.max(0, 100 - issues.length * 20 - words.length * 5), issues, wordCount };
}
