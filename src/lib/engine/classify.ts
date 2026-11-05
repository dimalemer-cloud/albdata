import { db } from "../db";
import { aiEnabled, categorizeReply } from "../ai";
import { domainOf, stripQuoted } from "../utils";
export { stripQuoted };
import type { LeadStatus } from "@prisma/client";

const AUTO_SUBJECT = /out of (the )?office|automatic reply|auto(matic)?[- ]?reply|autoreply|away from (the )?office|on vacation|on leave|abwesenheit|absence/i;

export function isAutoReply(headers: Map<string, unknown>, subject: string) {
  const h = (k: string) => String(headers.get(k) ?? "").toLowerCase();
  if (h("auto-submitted") && h("auto-submitted") !== "no") return true;
  if (headers.has("x-autoreply") || headers.has("x-autorespond") || headers.has("x-autoreply-from")) return true;
  if (["auto_reply", "auto-reply"].includes(h("precedence"))) return true;
  return AUTO_SUBJECT.test(subject);
}

export function ruleCategory(text: string, auto: boolean) {
  const t = text.toLowerCase();
  if (auto) return "OUT_OF_OFFICE";
  if (/unsubscribe|remove me|stop (emailing|contacting)|take me off|do not (email|contact)|don't (email|contact)/.test(t)) return "UNSUBSCRIBE";
  if (/wrong person|not the right (person|contact)|no longer (with|at|work)|left the company|isn't my area|not my department/.test(t)) return "WRONG_PERSON";
  if (/not interested|no thanks|no thank you|not a (good )?fit|we('re| are) (good|all set)|not at this time|not right now|pass on this/.test(t)) return "NOT_INTERESTED";
  if (/(booked|scheduled|confirmed).{0,30}(call|meeting|time)|see you (on|at|then)/.test(t)) return "MEETING_BOOKED";
  if (/interested|sounds (good|great|interesting)|tell me more|let'?s (talk|chat|connect)|call|meeting|schedule|pricing|price|how much|cost|send (me )?(more|info|details)|available|curious/.test(t)) return "INTERESTED";
  return "NEUTRAL";
}

export async function classify(text: string, auto: boolean, original?: string) {
  if (auto) return { category: "OUT_OF_OFFICE", summary: "Automatic reply" };
  if (await aiEnabled()) {
    try {
      return await categorizeReply(text, original);
    } catch (e) {
      console.warn("[ai] categorize failed, using rules:", (e as Error).message);
    }
  }
  return { category: ruleCategory(text, auto), summary: "" };
}

const STATUS_FOR: Record<string, LeadStatus | undefined> = {
  INTERESTED: "INTERESTED",
  MEETING_BOOKED: "MEETING_BOOKED",
  NOT_INTERESTED: "NOT_INTERESTED",
  UNSUBSCRIBE: "UNSUBSCRIBED",
};

/** Apply a label to a thread and propagate to lead status, CRM and blocklist. */
export async function applyInterest(threadId: string, category: string) {
  const thread = await db.thread.update({ where: { id: threadId }, data: { interest: category }, include: { lead: true } });
  if (!thread.leadId || !thread.lead) return;
  const status = STATUS_FOR[category];
  if (status) await db.lead.update({ where: { id: thread.leadId }, data: { status } });
  if (thread.campaignId) {
    await db.campaignLead.updateMany({ where: { campaignId: thread.campaignId, leadId: thread.leadId }, data: { interest: category } });
  }
  if (category === "UNSUBSCRIBE") {
    await db.blockedEntry.upsert({ where: { value: thread.lead.email.toLowerCase() }, update: {}, create: { value: thread.lead.email.toLowerCase(), reason: "Asked to unsubscribe" } });
    await db.campaignLead.updateMany({ where: { leadId: thread.leadId, status: "ACTIVE" }, data: { status: "UNSUBSCRIBED", nextSendAt: null } });
  }
  if (category === "INTERESTED" || category === "MEETING_BOOKED") {
    const existing = await db.deal.findFirst({ where: { leadId: thread.leadId } });
    const campaign = thread.campaignId ? await db.campaign.findUnique({ where: { id: thread.campaignId } }) : null;
    if (!existing) {
      const l = thread.lead;
      await db.deal.create({
        data: {
          title: l.companyName || [l.firstName, l.lastName].filter(Boolean).join(" ") || l.email,
          stage: category === "MEETING_BOOKED" ? "meeting" : "interested",
          leadId: l.id,
          campaignId: thread.campaignId,
          clientId: campaign?.clientId ?? null,
        },
      });
    } else if (category === "MEETING_BOOKED" && existing.stage === "interested") {
      await db.deal.update({ where: { id: existing.id }, data: { stage: "meeting" } });
    }
    const already = await db.event.count({ where: { type: "INTERESTED", campaignId: thread.campaignId ?? undefined, campaignLead: { leadId: thread.leadId } } });
    if (!already && thread.campaignId) {
      const cl = await db.campaignLead.findFirst({ where: { campaignId: thread.campaignId, leadId: thread.leadId } });
      await db.event.create({ data: { type: "INTERESTED", campaignId: thread.campaignId, campaignLeadId: cl?.id, accountId: thread.accountId } });
    }
  }
}

export async function isBlocked(email: string) {
  const e = email.toLowerCase();
  const hit = await db.blockedEntry.findFirst({ where: { value: { in: [e, domainOf(e)] } } });
  return !!hit;
}
