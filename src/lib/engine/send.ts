import type { Campaign, CampaignLead, EmailAccount, Lead, SequenceStep, StepVariant } from "@prisma/client";
import { db } from "../db";
import { render, textToHtml } from "../template";
import { applyTracking, unsubscribeHeaders } from "../tracking";
import { classifySmtpError, newMessageId, sendMail } from "../mailer";
import { htmlToText, pick } from "../utils";
import { isBlocked } from "./classify";

type FullCampaign = Campaign & { steps: (SequenceStep & { variants: StepVariant[] })[] };

export async function sendCampaignStep(c: FullCampaign, cl: CampaignLead & { lead: Lead }, acc: EmailAccount) {
  const step = c.steps[cl.currentStep];
  if (!step) {
    await db.campaignLead.update({ where: { id: cl.id }, data: { status: "COMPLETED", nextSendAt: null } });
    return "completed";
  }
  if (await isBlocked(cl.lead.email)) {
    await db.campaignLead.update({ where: { id: cl.id }, data: { status: "UNSUBSCRIBED", nextSendAt: null, lastError: "On blocklist" } });
    return "blocked";
  }
  const variants = step.variants.filter((v) => v.enabled && (v.body.trim() || v.subject.trim()));
  if (!variants.length) {
    await db.campaignLead.update({ where: { id: cl.id }, data: { status: "ERROR", nextSendAt: null, lastError: `Step ${cl.currentStep + 1} has no content` } });
    return "error";
  }
  const variant = pick(variants);
  const lead = cl.lead;
  const sender = { fromName: acc.fromName, email: acc.email };
  const tz = c.timezone;

  let subject = render(variant.subject, lead, sender, { tz }).trim();
  const isFollowUp = cl.currentStep > 0 && !!cl.lastMessageId;
  if (!subject) subject = cl.lastSubject ? (/^re:/i.test(cl.lastSubject) ? cl.lastSubject : `Re: ${cl.lastSubject}`) : "Quick question";

  const bodyHtmlRaw = render(variant.body, lead, sender, { html: true, tz });
  const sigHtml = acc.signature ? `<br><br>${textToHtml(acc.signature)}` : "";
  const baseHtml = textToHtml(bodyHtmlRaw) + sigHtml;

  const msg = await db.message.create({
    data: {
      direction: "OUTBOUND",
      accountId: acc.id,
      campaignId: c.id,
      campaignLeadId: cl.id,
      leadId: lead.id,
      stepIndex: cl.currentStep,
      variantId: variant.id,
      fromEmail: acc.email,
      fromName: acc.fromName,
      toEmail: lead.email,
      subject,
      bodyHtml: baseHtml,
      bodyText: htmlToText(baseHtml),
      inReplyTo: isFollowUp ? cl.lastMessageId : null,
      references: isFollowUp ? [cl.rootMessageId, cl.lastMessageId].filter((v, i, a) => v && a.indexOf(v) === i).join(" ") : null,
    },
  });

  const html = c.textOnly
    ? undefined
    : await applyTracking(baseHtml, msg.id, { open: c.openTracking, click: c.linkTracking, unsubscribe: c.unsubscribeLink });
  let text = htmlToText(baseHtml);
  if (c.textOnly && c.unsubscribeLink) text += `\n\nNot interested? Reply "unsubscribe" and I won't email again.`;
  const messageId = newMessageId(acc.email);

  try {
    await sendMail(acc, {
      to: lead.email,
      subject,
      html,
      text,
      messageId,
      inReplyTo: msg.inReplyTo,
      references: msg.references,
      headers: c.unsubscribeLink ? unsubscribeHeaders(msg.id, acc.email) : undefined,
    });
  } catch (e) {
    await db.message.delete({ where: { id: msg.id } });
    const kind = classifySmtpError(e);
    const errText = (e as Error).message.slice(0, 300);
    if (kind === "recipient") {
      await db.campaignLead.update({ where: { id: cl.id }, data: { status: "BOUNCED", nextSendAt: null, lastError: errText } });
      await db.lead.update({ where: { id: lead.id }, data: { status: "BOUNCED" } });
      await db.event.create({ data: { type: "BOUNCE", campaignId: c.id, campaignLeadId: cl.id, accountId: acc.id, stepIndex: cl.currentStep } });
      return "bounced";
    }
    if (kind === "auth") {
      await db.emailAccount.update({ where: { id: acc.id }, data: { status: "ERROR", lastError: `SMTP login failed: ${errText}` } });
      await db.campaignLead.update({ where: { id: cl.id }, data: { nextSendAt: new Date() } });
      return "account_error";
    }
    await db.campaignLead.update({ where: { id: cl.id }, data: { nextSendAt: new Date(Date.now() + 30 * 60_000), lastError: errText } });
    return "retry";
  }

  // Thread for Unibox
  let threadId: string;
  const existing = await db.thread.findFirst({ where: { accountId: acc.id, leadId: lead.id, campaignId: c.id } });
  if (existing) {
    threadId = existing.id;
    await db.thread.update({ where: { id: existing.id }, data: { lastMessageAt: new Date() } });
  } else {
    const t = await db.thread.create({
      data: {
        accountId: acc.id,
        leadId: lead.id,
        campaignId: c.id,
        subject,
        contactEmail: lead.email,
        contactName: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null,
        unread: false,
      },
    });
    threadId = t.id;
  }
  await db.message.update({ where: { id: msg.id }, data: { messageId, threadId, sentAt: new Date() } });
  await db.event.create({
    data: { type: "SENT", campaignId: c.id, campaignLeadId: cl.id, messageId: msg.id, accountId: acc.id, stepIndex: cl.currentStep, variantId: variant.id },
  });
  const next = c.steps[cl.currentStep + 1];
  await db.campaignLead.update({
    where: { id: cl.id },
    data: {
      currentStep: cl.currentStep + 1,
      accountId: acc.id,
      rootMessageId: cl.rootMessageId ?? messageId,
      lastMessageId: messageId,
      lastSubject: cl.currentStep === 0 || !cl.lastSubject ? subject : cl.lastSubject,
      nextSendAt: next ? new Date(Date.now() + next.delayDays * 86_400_000) : null,
      status: next ? "ACTIVE" : "COMPLETED",
      lastError: null,
    },
  });
  if (lead.status === "NEW") await db.lead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } });
  await db.emailAccount.update({ where: { id: acc.id }, data: { lastSentAt: new Date() } });
  return "sent";
}

/** Send a manual reply from the Unibox inside an existing thread. */
export async function sendThreadReply(threadId: string, bodyText: string) {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    include: { account: true, messages: { orderBy: { sentAt: "desc" }, take: 1 } },
  });
  if (!thread) throw new Error("Thread not found");
  const last = thread.messages[0];
  const acc = thread.account;
  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
  const html = textToHtml(bodyText.replace(/</g, "&lt;")) + (acc.signature ? `<br><br>${textToHtml(acc.signature)}` : "");
  const quoted = last
    ? `<br><br><div style="color:#666">On ${last.sentAt.toUTCString()}, ${last.fromName || last.fromEmail} wrote:<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${last.bodyHtml}</blockquote></div>`
    : "";
  const messageId = newMessageId(acc.email);
  const refs = [last?.references, last?.messageId].filter(Boolean).join(" ") || null;
  await sendMail(acc, {
    to: thread.contactEmail,
    subject,
    html: html + quoted,
    text: bodyText,
    messageId,
    inReplyTo: last?.messageId,
    references: refs,
  });
  const m = await db.message.create({
    data: {
      direction: "OUTBOUND",
      accountId: acc.id,
      threadId: thread.id,
      campaignId: thread.campaignId,
      leadId: thread.leadId,
      messageId,
      inReplyTo: last?.messageId,
      references: refs,
      fromEmail: acc.email,
      fromName: acc.fromName,
      toEmail: thread.contactEmail,
      subject,
      bodyHtml: html,
      bodyText,
    },
  });
  await db.thread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(), unread: false } });
  return m;
}
