// End-to-end test against a running app + worker + test/mailserver.mjs.
// BASE=http://127.0.0.1:3000 OUTBOX=/path/outbox.jsonl DATABASE_URL=... node test/e2e.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");
const { simpleParser } = require("mailparser");
const { PrismaClient } = require("@prisma/client");

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const OUTBOX = process.env.OUTBOX || "./outbox.jsonl";
const db = new PrismaClient();
let cookie = "";
let failures = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}
async function call(path, { method, body, raw } = {}) {
  const res = await fetch(BASE + path, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method || (body ? "POST" : "GET")} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}
const outbox = () => (fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
async function decode(m) {
  const p = await simpleParser(m.raw);
  return { ...m, text: p.text || "", html: typeof p.html === "string" ? p.html : "", subject: p.subject || "", messageId: p.messageId, inReplyTo: p.inReplyTo, headers: p.headers };
}
async function waitFor(name, fn, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for: ${name}`);
}
const smtp = nodemailer.createTransport({ host: "127.0.0.1", port: 2525, secure: false, ignoreTLS: true });

async function main() {
  // 1. Setup owner
  await call("/api/auth/setup", { body: { agency: "albdata", name: "Dima Owner", email: "owner@albdata.test", password: "supersecret1" } });
  check("owner account created + signed in", !!cookie);

  // 2. Connect two inboxes (real SMTP + IMAP login test)
  for (const [email, port] of [["sender1@agency.test", 3143], ["sender2@agency.test", 3144]]) {
    await call("/api/accounts", {
      body: { provider: "custom", email, fromName: email.startsWith("sender1") ? "Alex Morina" : "Sara Hoxha", password: "testpass", smtpHost: "127.0.0.1", smtpPort: 2525, smtpSecure: false, imapHost: "127.0.0.1", imapPort: port, imapSecure: false, dailyLimit: 50, warmupEnabled: true, signature: "Alex\nalbdata agency" },
    });
  }
  const accounts = await call("/api/accounts");
  check("2 inboxes connected after live SMTP/IMAP test", accounts.length === 2);
  let badLogin = false;
  try {
    await call("/api/accounts", { body: { provider: "custom", email: "sender1b@agency.test", fromName: "X", password: "wrong", smtpHost: "127.0.0.1", smtpPort: 2525, smtpSecure: false, imapHost: "127.0.0.1", imapPort: 3143, imapSecure: false } });
  } catch (e) {
    badLogin = /IMAP login failed/.test(e.message);
  }
  check("wrong password is rejected with a clear error", badLogin);
  await db.emailAccount.updateMany({ data: { minGapMinutes: 0 } });

  // 3. Lead list + CSV-style import with custom variable
  const list = await call("/api/lists", { body: { name: "Dentists – Test City" } });
  const imp = await call(`/api/lists/${list.id}/leads`, {
    body: {
      leads: [
        { email: "lead1@prospect.test", firstName: "Ana", companyName: "Smile Dental", city: "Tirana", customFields: { painPoint: "no online booking" } },
        { email: "lead2@prospect.test", firstName: "Ben", companyName: "Bright Teeth", city: "Durres", customFields: { painPoint: "slow website" } },
        { email: "bounce@prospect.test", firstName: "", companyName: "Ghost Clinic", city: "Vlore", customFields: {} },
        { email: "LEAD1@prospect.test", firstName: "Dup" },
        { email: "not-an-email" },
      ],
    },
  });
  check("import dedupes + rejects invalid", imp.imported === 3 && imp.invalid === 1 && imp.duplicates === 1, JSON.stringify(imp));

  // 4. Campaign with 2 steps, A/B variants, spintax, fallbacks, link tracking
  const camp = await call("/api/campaigns", { body: { name: "E2E Dentists" } });
  await call(`/api/campaigns/${camp.id}`, { method: "PATCH", body: { timezone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], startTime: "00:00", endTime: "23:59", linkTracking: true, openTracking: true } });
  await call(`/api/campaigns/${camp.id}/sequence`, {
    method: "PUT",
    body: {
      steps: [
        { delayDays: 0, variants: [
          { label: "A", subject: "{Quick|Short} question about {{companyName}}", body: "Hi {{firstName|there}},\n\nNoticed {{companyName}} in {{city}} has {{painPoint|room to grow online}}.\nWe fix that: https://example.com/case-study\n\nWorth a chat?", enabled: true },
          { label: "B", subject: "{{companyName}} + more patients", body: "Hey {{firstName|there}}, quick idea for {{companyName}}: https://example.com/case-study", enabled: true },
        ] },
        { delayDays: 0, variants: [{ label: "A", subject: "", body: "Hi {{firstName|there}}, just bumping this up.", enabled: true }] },
      ],
    },
  });
  let launchBlocked = false;
  try { await call(`/api/campaigns/${camp.id}/status`, { body: { action: "launch" } }); } catch (e) { launchBlocked = /add leads/.test(e.message); }
  check("launch blocked without leads (validation)", launchBlocked);
  const added = await call(`/api/campaigns/${camp.id}/leads`, { body: { action: "add_list", listId: list.id } });
  check("3 leads added to campaign", added.added === 3, JSON.stringify(added));
  const preview = await call(`/api/campaigns/${camp.id}/preview`, { body: { subject: "Hi {{firstName}}", body: "{{firstName}} at {{companyName}}", leadIndex: 2 } });
  check("preview warns about missing {{firstName}}", preview.missing.includes("firstName"), JSON.stringify(preview.missing));
  await call(`/api/campaigns/${camp.id}/status`, { body: { action: "launch" } });

  // 5. Worker sends step 1 to all 3 leads
  const step1 = await waitFor("3 campaign emails in outbox", () => { const o = outbox().filter((m) => m.to.endsWith("@prospect.test")); return o.length >= 3 ? o : null; });
  const ana = await decode(step1.find((m) => m.to === "lead1@prospect.test"));
  const ghost = await decode(step1.find((m) => m.to === "bounce@prospect.test"));
  const all1 = await Promise.all(step1.map(decode));
  check("variables rendered", /(Hi|Hey) Ana,/.test(ana.text) && /Smile Dental/.test(ana.text + ana.subject), ana.text.split("\n")[0]);
  check("fallback used when firstName empty", /(Hi|Hey) there,/.test(ghost.text), ghost.text.split("\n")[0]);
  check("no raw spintax/variables leaked", all1.every((m) => !/[{}]/.test(m.text + m.subject)));
  check("open pixel + click tracking + unsubscribe header", /\/t\/o\/[a-z0-9]+\.gif/.test(ana.html) && /\/t\/c\/[a-z0-9]+\?u=/.test(ana.html) && /List-Unsubscribe=One-Click/.test(ana.raw));
  check("signature appended", /albdata agency/.test(ana.text));
  const variantA = all1.filter((m) => /no online booking|slow website|room to grow online/.test(m.text));
  check("A/B variants both used or custom field rendered in A", variantA.length === 0 || variantA.some((m) => /no online booking|slow website/.test(m.text)));
  const accountsUsed = new Set(step1.map((m) => m.from));
  check("inbox rotation used both accounts", accountsUsed.size === 2, [...accountsUsed].join(", "));

  // 6. Open + click tracking
  const msgAna = await db.message.findFirst({ where: { toEmail: "lead1@prospect.test", direction: "OUTBOUND" }, orderBy: { sentAt: "asc" } });
  await db.message.update({ where: { id: msgAna.id }, data: { sentAt: new Date(Date.now() - 60_000) } });
  const pix = await call(`/t/o/${msgAna.id}.gif`, { raw: true });
  const clickUrl = ana.html.match(/\/t\/c\/([a-z0-9]+)\?u=([A-Za-z0-9_-]+)/);
  const click = await call(`/t/c/${clickUrl[1]}?u=${clickUrl[2]}`, { raw: true });
  check("pixel returns GIF", pix.headers.get("content-type") === "image/gif");
  check("click redirects to original URL", click.status === 302 && click.headers.get("location") === "https://example.com/case-study");
  const evil = await call(`/t/c/${clickUrl[1]}?u=${Buffer.from("https://evil.example/phish").toString("base64url")}`, { raw: true });
  check("click tracker refuses links not in the email (no open redirect)", evil.status === 302 && !String(evil.headers.get("location")).includes("evil.example"));

  // 7. Step 2 threads as a reply (same account, In-Reply-To)
  const step2 = await waitFor("follow-ups sent", () => { const o = outbox().filter((m) => m.to.endsWith("@prospect.test") && /just bumping/.test(m.raw)); return o.length >= 2 ? o : null; }, 60000);
  const f = await decode(step2[0]);
  const firstToSame = await decode(step1.find((m) => m.to === f.to));
  check("follow-up is threaded (In-Reply-To + Re: subject + same inbox)", f.inReplyTo === firstToSame.messageId && f.subject === `Re: ${firstToSame.subject}` && f.from === firstToSame.from, `${f.subject} | ${f.inReplyTo}`);

  // 8. Lead 2 replies (interested) → Unibox, AI/rules label, CRM deal, sequence stopped
  const ben = await decode(step1.find((m) => m.to === "lead2@prospect.test"));
  const benId = ben.messageId;
  await smtp.sendMail({ from: "Ben Doe <lead2@prospect.test>", to: ben.from, subject: "Re: hello", inReplyTo: benId, references: benId, text: "Sounds interesting. Can you send me pricing and a few times for a call?\n\nOn Mon, Alex wrote:\n> Hi Ben" });
  const thread = await waitFor("reply in Unibox", async () => (await call("/api/unibox")).threads.find((t) => t.contactEmail === "lead2@prospect.test"));
  check("reply appears in Unibox", !!thread);
  check("reply classified as Interested", thread.interest === "INTERESTED", thread.interest);
  const deal = await db.deal.findFirst({ where: { lead: { email: "lead2@prospect.test" } } });
  check("CRM deal auto-created", !!deal && deal.stage === "interested");
  const clBen = await db.campaignLead.findFirst({ where: { campaignId: camp.id, lead: { email: "lead2@prospect.test" } } });
  check("sequence stopped for replied lead", clBen.status === "REPLIED" || clBen.status === "COMPLETED", clBen.status);

  // 9. Bounce (DSN) → lead marked bounced
  const ghostId = ghost.messageId;
  await smtp.sendMail({ from: "Mail Delivery Subsystem <mailer-daemon@prospect.test>", to: ghost.from, subject: "Delivery Status Notification (Failure)", text: `Address not found\nFinal-Recipient: rfc822; bounce@prospect.test\nStatus: 5.1.1\n\n----- Original message -----\nMessage-ID: ${ghostId}\nTo: bounce@prospect.test` });
  await waitFor("bounce processed", async () => (await db.lead.findFirst({ where: { email: "bounce@prospect.test" } })).status === "BOUNCED");
  check("bounce detected from DSN", true);

  // 10. Reply from Unibox
  await call(`/api/unibox/${thread.id}/reply`, { body: { body: "Thanks Ben! Pricing starts at $990. Does Thursday 3pm work?" } });
  const ourReplyRaw = await waitFor("unibox reply delivered", () => outbox().find((m) => m.to === "lead2@prospect.test" && /Thursday 3pm/.test(m.raw)));
  const ourReply = await decode(ourReplyRaw);
  check("Unibox reply threaded to prospect", !!ourReply.inReplyTo && /^Re: /.test(ourReply.subject), `${ourReply.subject} | ${ourReply.inReplyTo}`);

  // 11. Unsubscribe link (one-click POST)
  const unsub = await call(`/u/${msgAna.id}`, { method: "POST", raw: true });
  const blocked = await db.blockedEntry.findUnique({ where: { value: "lead1@prospect.test" } });
  check("unsubscribe → blocklist + lead stopped", unsub.ok && !!blocked);

  // 12. Analytics
  const an = await call(`/api/campaigns/${camp.id}/analytics`);
  check("analytics counts", an.totals.sent >= 5 && an.totals.opened >= 1 && an.totals.clicked === 1 && an.totals.replied === 1 && an.totals.bounced === 1 && an.totals.interested === 1 && an.totals.unsubscribed === 1, JSON.stringify(an.totals));

  // 13. Warmup between the two inboxes (sends, receives, files away, replies)
  await db.emailAccount.updateMany({ data: { warmupStart: 6 } });
  await waitFor("warmup emails exchanged + processed", async () => (await db.warmupEmail.count({ where: { processedAt: { not: null } } })) >= 2, 90000);
  const wTotal = await db.warmupEmail.count();
  const landed = await db.warmupEmail.groupBy({ by: ["landedIn"], _count: { _all: true } });
  check("warmup sends + inbox placement tracked", wTotal >= 2, JSON.stringify(landed.map((l) => [l.landedIn, l._count._all])));
  const warmLeak = (await call("/api/unibox")).threads.some((t) => t.contactEmail.endsWith("@agency.test"));
  check("warmup emails never appear in Unibox", !warmLeak);

  // 14. Client portal + share link
  const client = await call("/api/clients", { body: { name: "Smile Group" } });
  await call(`/api/campaigns/${camp.id}`, { method: "PATCH", body: { clientId: client.id } });
  const share = await call(`/r/${client.shareToken}`, { raw: true });
  const shareHtml = await share.text();
  check("public share report renders", share.status === 200 && shareHtml.includes("Smile Group") && shareHtml.includes("E2E Dentists"));
  await call(`/api/clients/${client.id}/users`, { body: { name: "Client User", email: "client@smile.test", password: "clientpass1" } });
  const ownerCookie = cookie;
  cookie = "";
  await call("/api/auth/login", { body: { email: "client@smile.test", password: "clientpass1" } });
  const portal = await call("/portal", { raw: true });
  const forbidden = await call("/api/campaigns", { raw: true });
  const redirected = await call("/dashboard", { raw: true });
  check("client login sees portal", portal.status === 200 && (await portal.text()).includes("Smile Group"));
  check("client is blocked from team API + pages", forbidden.status === 403 && redirected.status === 307);
  cookie = ownerCookie;

  console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
  await db.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await db.$disconnect();
  process.exit(1);
});
