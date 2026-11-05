import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { EmailAccount } from "@prisma/client";
import { db } from "../db";
import { decrypt } from "../crypto";
import { htmlToText } from "../utils";
import { applyInterest, classify, isAutoReply, stripQuoted } from "./classify";

export function imapClient(acc: Pick<EmailAccount, "imapHost" | "imapPort" | "imapSecure" | "username">, password: string) {
  return new ImapFlow({
    host: acc.imapHost,
    port: acc.imapPort,
    secure: acc.imapSecure,
    auth: { user: acc.username, pass: password },
    logger: false,
    socketTimeout: 60_000,
  });
}

const WARMUP_FOLDER = "albdata-warmup";

function refsOf(p: ParsedMail) {
  const refs = Array.isArray(p.references) ? p.references : p.references ? p.references.split(/\s+/) : [];
  return [p.inReplyTo, ...refs].filter(Boolean) as string[];
}

function addressOf(p: ParsedMail) {
  const v = p.from?.value?.[0];
  return { email: (v?.address || "").toLowerCase(), name: v?.name || null };
}

type Action = { uid: number; kind: "warmup" | "seen" | "none" };

async function handleWarmup(acc: EmailAccount, p: ParsedMail): Promise<boolean> {
  if (!p.messageId) return false;
  const w = await db.warmupEmail.findUnique({ where: { messageId: p.messageId }, include: { from: true } });
  if (!w || w.toId !== acc.id) return !!w; // a warmup email (maybe ours to another account) — never treat as a lead reply
  if (!w.processedAt) {
    const replyRate = w.from.warmupReplyRate;
    const willReply = !w.isReply && Math.random() * 100 < replyRate;
    await db.warmupEmail.update({
      where: { id: w.id },
      data: {
        landedIn: w.landedIn ?? "INBOX",
        processedAt: new Date(),
        replyDueAt: willReply ? new Date(Date.now() + (10 + Math.random() * 110) * 60_000) : null,
      },
    });
  }
  return true;
}

async function handleBounce(acc: EmailAccount, p: ParsedMail) {
  const from = addressOf(p).email;
  const ctype = String(p.headers.get("content-type") ? (p.headers.get("content-type") as { value?: string }).value ?? "" : "");
  const isDsn = /mailer-daemon|postmaster|mail delivery/i.test(from) || /delivery-status|report/i.test(ctype) || /undeliver|delivery status notification|failure notice|returned mail/i.test(p.subject || "");
  if (!isDsn) return false;
  const raw = `${p.text || ""}\n${p.html ? htmlToText(p.html) : ""}`;
  const ids = raw.match(/<[^<>\s]+@[^<>\s]+>/g) || [];
  let original = ids.length ? await db.message.findFirst({ where: { messageId: { in: ids }, direction: "OUTBOUND" } }) : null;
  if (!original) {
    const failed = String(p.headers.get("x-failed-recipients") || "").toLowerCase() || raw.match(/final-recipient:\s*rfc822;\s*([^\s]+)/i)?.[1]?.toLowerCase();
    if (failed) original = await db.message.findFirst({ where: { accountId: acc.id, toEmail: failed, direction: "OUTBOUND" }, orderBy: { sentAt: "desc" } });
  }
  if (!original) return true;
  const already = await db.message.findFirst({ where: { isBounce: true, inReplyTo: original.messageId } });
  if (already) return true;
  await db.message.create({
    data: {
      direction: "INBOUND",
      accountId: acc.id,
      campaignId: original.campaignId,
      campaignLeadId: original.campaignLeadId,
      leadId: original.leadId,
      messageId: p.messageId || null,
      inReplyTo: original.messageId,
      fromEmail: from,
      toEmail: acc.email,
      subject: p.subject || "Delivery failure",
      bodyHtml: "",
      bodyText: raw.slice(0, 5000),
      isBounce: true,
      sentAt: p.date || new Date(),
    },
  });
  if (original.campaignLeadId) {
    await db.campaignLead.update({ where: { id: original.campaignLeadId }, data: { status: "BOUNCED", nextSendAt: null } });
    await db.event.create({ data: { type: "BOUNCE", campaignId: original.campaignId, campaignLeadId: original.campaignLeadId, accountId: acc.id, stepIndex: original.stepIndex } });
  }
  if (original.leadId) await db.lead.update({ where: { id: original.leadId }, data: { status: "BOUNCED" } });
  return true;
}

async function handleReply(acc: EmailAccount, p: ParsedMail) {
  const refs = refsOf(p);
  const { email: fromEmail, name: fromName } = addressOf(p);
  if (!fromEmail || fromEmail === acc.email) return false;
  let original = refs.length ? await db.message.findFirst({ where: { messageId: { in: refs }, direction: "OUTBOUND" }, orderBy: { sentAt: "desc" } }) : null;
  if (!original) {
    original = await db.message.findFirst({ where: { accountId: acc.id, toEmail: fromEmail, direction: "OUTBOUND" }, orderBy: { sentAt: "desc" } });
  }
  if (!original) return false;

  const auto = isAutoReply(p.headers as unknown as Map<string, unknown>, p.subject || "");
  const text = p.text || (p.html ? htmlToText(p.html) : "");
  const clean = stripQuoted(text) || text.slice(0, 2000);
  let threadId = original.threadId;
  if (!threadId) {
    const t = await db.thread.create({
      data: { accountId: acc.id, leadId: original.leadId, campaignId: original.campaignId, subject: original.subject, contactEmail: fromEmail, contactName: fromName },
    });
    threadId = t.id;
  }
  const inbound = await db.message.create({
    data: {
      direction: "INBOUND",
      accountId: acc.id,
      threadId,
      campaignId: original.campaignId,
      campaignLeadId: original.campaignLeadId,
      leadId: original.leadId,
      messageId: p.messageId || null,
      inReplyTo: p.inReplyTo || null,
      references: refs.join(" ") || null,
      fromEmail,
      fromName,
      toEmail: acc.email,
      subject: p.subject || "(no subject)",
      bodyHtml: typeof p.html === "string" ? p.html : "",
      bodyText: text.slice(0, 50_000),
      isAutoReply: auto,
      sentAt: p.date || new Date(),
    },
  });
  await db.thread.update({ where: { id: threadId }, data: { hasReply: true, unread: true, archived: false, lastMessageAt: new Date(), contactName: fromName || undefined } });

  if (original.campaignLeadId && original.campaignId) {
    const campaign = await db.campaign.findUnique({ where: { id: original.campaignId } });
    const prevReplies = await db.event.count({ where: { campaignLeadId: original.campaignLeadId, type: "REPLY" } });
    await db.event.create({
      data: {
        type: auto ? "AUTO_REPLY" : prevReplies ? "REPLY_AGAIN" : "REPLY",
        campaignId: original.campaignId,
        campaignLeadId: original.campaignLeadId,
        messageId: inbound.id,
        accountId: acc.id,
        stepIndex: original.stepIndex,
        variantId: original.variantId,
      },
    });
    if (campaign && ((!auto && campaign.stopOnReply) || (auto && campaign.stopOnAutoReply))) {
      await db.campaignLead.update({ where: { id: original.campaignLeadId }, data: { status: "REPLIED", nextSendAt: null } });
      if (!auto && campaign.stopForCompany) {
        const domain = fromEmail.split("@")[1];
        await db.campaignLead.updateMany({
          where: { campaignId: campaign.id, status: "ACTIVE", lead: { email: { endsWith: `@${domain}` } } },
          data: { status: "COMPLETED", nextSendAt: null, lastError: "Stopped: a colleague replied" },
        });
      }
    }
  }
  if (original.leadId && !auto) {
    const lead = await db.lead.findUnique({ where: { id: original.leadId } });
    if (lead && ["NEW", "CONTACTED"].includes(lead.status)) await db.lead.update({ where: { id: lead.id }, data: { status: "REPLIED" } });
  }
  const result = await classify(clean, auto, original.bodyText);
  await db.message.update({ where: { id: inbound.id }, data: { category: result.category } });
  await applyInterest(threadId, result.category);
  return true;
}

/** Sync one account: replies, bounces, warmup handling, spam rescue. */
export async function syncAccount(acc: EmailAccount) {
  const client = imapClient(acc, decrypt(acc.passwordEnc));
  await client.connect();
  let processed = 0;
  try {
    const boxes = await client.list();
    const spamBox = boxes.find((b) => b.specialUse === "\\Junk")?.path;
    const hasWarmupFolder = boxes.some((b) => b.path === WARMUP_FOLDER);

    // 1) Spam folder: rescue warmup emails (move to inbox) and catch campaign replies/bounces that landed in spam
    if (spamBox) {
      const lock = await client.getMailboxLock(spamBox);
      try {
        const uids = (await client.search({ since: new Date(Date.now() - 3 * 86_400_000) }, { uid: true })) || [];
        const rescue: number[] = [];
        const inspect: number[] = [];
        if (uids.length) {
          for await (const m of client.fetch(uids.slice(-200), { uid: true, envelope: true }, { uid: true })) {
            const mid = m.envelope?.messageId;
            if (mid) {
              const w = await db.warmupEmail.findUnique({ where: { messageId: mid } });
              if (w && w.toId === acc.id) {
                rescue.push(m.uid);
                if (!w.landedIn) await db.warmupEmail.update({ where: { id: w.id }, data: { landedIn: "SPAM" } });
                continue;
              }
              if (await db.message.findUnique({ where: { messageId: mid } })) continue; // already processed
            }
            const from = (m.envelope?.from?.[0]?.address || "").toLowerCase();
            const irt = m.envelope?.inReplyTo;
            const isOurThread = irt ? !!(await db.message.findFirst({ where: { messageId: irt, direction: "OUTBOUND" }, select: { id: true } })) : false;
            const knownContact = from ? !!(await db.message.findFirst({ where: { accountId: acc.id, toEmail: from, direction: "OUTBOUND" }, select: { id: true } })) : false;
            if (isOurThread || knownContact || /mailer-daemon|postmaster/.test(from)) inspect.push(m.uid);
          }
        }
        for (const uid of inspect) {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          try {
            const parsed = await simpleParser(msg.source);
            if (!(await handleBounce(acc, parsed))) await handleReply(acc, parsed);
            processed++;
          } catch (e) {
            console.error(`[sync ${acc.email}] spam ${uid}:`, (e as Error).message);
          }
        }
        if (rescue.length) await client.messageMove(rescue, "INBOX", { uid: true });
      } finally {
        lock.release();
      }
    }

    // 2) New inbox messages
    const lock = await client.getMailboxLock("INBOX");
    const actions: Action[] = [];
    let maxUid = acc.inboxLastUid;
    try {
      const mb = client.mailbox;
      const validity = mb ? String(mb.uidValidity) : null;
      let lastUid = acc.inboxLastUid;
      if (validity && acc.inboxUidValidity && validity !== acc.inboxUidValidity) lastUid = 0;
      let uids: number[];
      if (lastUid > 0) uids = ((await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })) || []).filter((u) => u > lastUid);
      else uids = (await client.search({ since: new Date(Date.now() - 3 * 86_400_000) }, { uid: true })) || [];
      const batch: { uid: number; source: Buffer }[] = [];
      if (uids.length) {
        for await (const m of client.fetch(uids.slice(0, 300), { uid: true, source: true }, { uid: true })) {
          if (m.source) batch.push({ uid: m.uid, source: m.source });
        }
      }
      for (const m of batch) {
        maxUid = Math.max(maxUid, m.uid);
        try {
          const parsed = await simpleParser(m.source);
          if (parsed.messageId && (await db.message.findUnique({ where: { messageId: parsed.messageId } }))) continue;
          if (await handleWarmup(acc, parsed)) {
            actions.push({ uid: m.uid, kind: "warmup" });
          } else if (await handleBounce(acc, parsed)) {
            actions.push({ uid: m.uid, kind: "none" });
          } else if (await handleReply(acc, parsed)) {
            actions.push({ uid: m.uid, kind: "none" });
          }
          processed++;
        } catch (e) {
          console.error(`[sync ${acc.email}] message ${m.uid}:`, (e as Error).message);
        }
      }
      // Warmup emails: mark read + important, then file them away from the inbox
      const warm = actions.filter((a) => a.kind === "warmup").map((a) => a.uid);
      if (warm.length) {
        await client.messageFlagsAdd(warm, ["\\Seen", "\\Flagged"], { uid: true });
        if (!hasWarmupFolder) {
          try {
            await client.mailboxCreate(WARMUP_FOLDER);
          } catch {}
        }
        try {
          await client.messageMove(warm, WARMUP_FOLDER, { uid: true });
        } catch {}
      }
      await db.emailAccount.update({
        where: { id: acc.id },
        data: { inboxLastUid: maxUid, inboxUidValidity: validity, lastSyncAt: new Date(), ...(acc.status === "ERROR" && acc.lastError?.startsWith("IMAP") ? { status: "ACTIVE", lastError: null } : {}) },
      });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return processed;
}

export async function testImap(cfg: Pick<EmailAccount, "imapHost" | "imapPort" | "imapSecure" | "username">, password: string) {
  const c = imapClient(cfg, password);
  await c.connect();
  const boxes = await c.list();
  await c.logout();
  return boxes.length;
}
