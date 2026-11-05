export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

export function domainOf(email: string) {
  return email.split("@")[1]?.toLowerCase().trim() || "";
}

export function normalizeDomain(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "REPLIED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "WON", "LOST", "UNSUBSCRIBED", "BOUNCED",
] as const;

export const INTEREST_LABELS: Record<string, { label: string; color: string }> = {
  INTERESTED: { label: "Interested", color: "green" },
  MEETING_BOOKED: { label: "Meeting booked", color: "blue" },
  NOT_INTERESTED: { label: "Not interested", color: "red" },
  OUT_OF_OFFICE: { label: "Out of office", color: "yellow" },
  WRONG_PERSON: { label: "Wrong person", color: "gray" },
  UNSUBSCRIBE: { label: "Unsubscribe", color: "red" },
  NEUTRAL: { label: "Neutral", color: "gray" },
};

export const DEAL_STAGES = [
  { id: "interested", name: "Interested", color: "#22c55e" },
  { id: "meeting", name: "Meeting booked", color: "#3b82f6" },
  { id: "proposal", name: "Proposal sent", color: "#a855f7" },
  { id: "won", name: "Won", color: "#16a34a" },
  { id: "lost", name: "Lost", color: "#ef4444" },
];

/** Remove quoted history and signatures for cleaner classification/snippets. */
export function stripQuoted(text: string) {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^On .{5,200}wrote:\s*$/i.test(line.trim())) break;
    if (/^-{2,}\s*Original Message/i.test(line.trim())) break;
    if (/^From:\s.+/i.test(line.trim()) && out.length > 0) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

