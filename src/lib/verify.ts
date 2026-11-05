import net from "node:net";
import { mxRecords } from "./dns";

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com",
  "getnada.com", "dispostable.com", "sharklasers.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com",
  "mohmal.com", "emailondeck.com", "tempr.email", "spamgourmet.com", "mailnesia.com", "burnermail.io",
]);
export const ROLE = new Set([
  "info", "contact", "hello", "admin", "office", "sales", "support", "team", "enquiries", "inquiries", "mail", "billing",
  "help", "service", "marketing", "reception", "booking", "bookings", "careers", "jobs", "hr", "noreply", "no-reply",
]);
const FREE = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "live.com", "msn.com", "gmx.com", "proton.me", "protonmail.com", "yandex.com", "mail.com"]);

export type VerifyStatus = "valid" | "invalid" | "catch_all" | "risky" | "unknown";
export type VerifyResult = { email: string; status: VerifyStatus; reason: string; role: boolean; free: boolean; disposable: boolean };

const SYNTAX = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

type SmtpOutcome = { code: number; text: string } | null;

/** Talk SMTP to the MX and run RCPT TO for each address. Requires outbound port 25. */
export function smtpProbe(mx: string, addresses: string[], opts: { helo: string; from: string; timeoutMs?: number }) {
  return new Promise<Map<string, SmtpOutcome>>((resolve) => {
    const results = new Map<string, SmtpOutcome>();
    const sock = net.createConnection({ host: mx, port: 25 });
    const timeout = opts.timeoutMs ?? 12000;
    sock.setTimeout(timeout);
    let buf = "";
    const queue: string[] = [`EHLO ${opts.helo}`, `MAIL FROM:<${opts.from}>`, ...addresses.map((a) => `RCPT TO:<${a}>`), "QUIT"];
    let stage = -1; // -1 = waiting for banner
    const finish = () => {
      sock.destroy();
      for (const a of addresses) if (!results.has(a)) results.set(a, null);
      resolve(results);
    };
    sock.on("data", (d) => {
      buf += d.toString();
      // wait for final line of a (possibly multiline) response
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || !/^\d{3} /.test(last)) return;
      const code = Number(last.slice(0, 3));
      buf = "";
      if (stage >= 2 && stage < 2 + addresses.length) results.set(addresses[stage - 2], { code, text: last });
      if ((stage === -1 && code !== 220) || (stage === 0 && code !== 250) || (stage === 1 && code !== 250)) return finish();
      stage++;
      if (stage >= queue.length) return finish();
      sock.write(queue[stage] + "\r\n");
    });
    sock.on("timeout", finish);
    sock.on("error", finish);
    sock.on("close", finish);
  });
}

const catchAllCache = new Map<string, boolean | null>();

export async function verifyEmail(email: string): Promise<VerifyResult> {
  const e = email.trim().toLowerCase();
  const [local, domain] = e.split("@");
  const base = { email: e, role: ROLE.has(local), free: FREE.has(domain || ""), disposable: DISPOSABLE.has(domain || "") };
  if (!SYNTAX.test(e)) return { ...base, status: "invalid", reason: "Bad syntax" };
  if (base.disposable) return { ...base, status: "invalid", reason: "Disposable domain" };
  const mx = await mxRecords(domain);
  if (!mx.length) return { ...base, status: "invalid", reason: "Domain has no mail server (MX)" };

  const helo = process.env.VERIFY_HELO || "localhost";
  const from = process.env.VERIFY_FROM || `verify@${helo}`;
  const probeAddr = `zz${Math.random().toString(36).slice(2, 10)}q@${domain}`;
  const known = catchAllCache.get(domain);
  const addrs = known === undefined ? [e, probeAddr] : [e];
  const res = await smtpProbe(mx[0], addrs, { helo, from });
  const r = res.get(e);
  if (known === undefined) {
    const p = res.get(probeAddr);
    catchAllCache.set(domain, p ? p.code >= 250 && p.code < 260 : null);
  }
  const catchAll = catchAllCache.get(domain);
  if (!r) return { ...base, status: base.free ? "risky" : "unknown", reason: "Mail server did not answer (port 25 blocked or greylisting)" };
  if (r.code >= 250 && r.code < 260) {
    if (catchAll) return { ...base, status: "catch_all", reason: "Domain accepts all addresses" };
    return { ...base, status: base.role ? "risky" : "valid", reason: base.role ? "Valid but role-based address" : "Mailbox exists" };
  }
  if (r.code >= 550 && r.code < 560) return { ...base, status: "invalid", reason: r.text.slice(0, 140) };
  return { ...base, status: "unknown", reason: r.text.slice(0, 140) };
}
