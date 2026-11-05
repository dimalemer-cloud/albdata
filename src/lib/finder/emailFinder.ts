import { mxRecords } from "../dns";
import { smtpProbe } from "../verify";

function clean(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

export function emailPatterns(first: string, last: string, domain: string) {
  const f = clean(first);
  const l = clean(last);
  const p = new Set<string>();
  if (f && l) {
    [`${f}.${l}`, `${f}`, `${f}${l}`, `${f[0]}${l}`, `${f[0]}.${l}`, `${f}${l[0]}`, `${f}_${l}`, `${l}.${f}`, `${l}${f[0]}`, `${l}`, `${f}-${l}`]
      .forEach((x) => p.add(`${x}@${domain}`));
  } else if (f) p.add(`${f}@${domain}`);
  return [...p];
}

export type FinderOutcome = {
  email: string | null;
  status: "found" | "catch_all" | "not_found" | "unverifiable";
  checked: { email: string; code: number | null }[];
  note: string;
};

/** Guess an address from name + domain and confirm it via SMTP RCPT checks. */
export async function findEmail(first: string, last: string, domain: string): Promise<FinderOutcome> {
  const d = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  const patterns = emailPatterns(first, last, d);
  const mx = await mxRecords(d);
  if (!mx.length) return { email: null, status: "not_found", checked: [], note: "Domain has no mail server" };
  const helo = process.env.VERIFY_HELO || "localhost";
  const from = process.env.VERIFY_FROM || `verify@${helo}`;
  const probe = `zz${Math.random().toString(36).slice(2, 10)}q@${d}`;
  const res = await smtpProbe(mx[0], [probe, ...patterns], { helo, from });
  const checked = patterns.map((e) => ({ email: e, code: res.get(e)?.code ?? null }));
  const probeRes = res.get(probe);
  if (!probeRes) {
    return { email: patterns[0], status: "unverifiable", checked, note: "Mail server unreachable on port 25 — showing most common pattern" };
  }
  if (probeRes.code >= 250 && probeRes.code < 260) {
    return { email: patterns[0], status: "catch_all", checked, note: "Domain accepts every address — most common pattern shown" };
  }
  const hit = checked.find((c) => c.code && c.code >= 250 && c.code < 260);
  if (hit) return { email: hit.email, status: "found", checked, note: "Mailbox confirmed by the mail server" };
  return { email: null, status: "not_found", checked, note: "No pattern was accepted" };
}
