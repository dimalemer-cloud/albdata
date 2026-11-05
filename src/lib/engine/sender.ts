import { db } from "../db";
import { inSendWindow, startOfDayInTz, startOfUtcDay } from "../schedule";
import { shuffle } from "../utils";
import { sendCampaignStep } from "./send";

async function accountCanSend(accountId: string) {
  const acc = await db.emailAccount.findUnique({ where: { id: accountId } });
  if (!acc || acc.status !== "ACTIVE") return null;
  const sentToday = await db.event.count({ where: { accountId, type: "SENT", createdAt: { gte: startOfUtcDay() } } });
  if (sentToday >= acc.dailyLimit) return null;
  if (acc.lastSentAt) {
    const gapMs = acc.minGapMinutes * 60_000 * (1 + Math.random() * 0.4);
    if (Date.now() - acc.lastSentAt.getTime() < gapMs) return null;
  }
  return acc;
}

export async function senderTick() {
  const campaigns = await db.campaign.findMany({
    where: { status: "ACTIVE" },
    include: { steps: { include: { variants: true }, orderBy: { order: "asc" } }, accounts: true },
  });
  let sent = 0;
  for (const c of campaigns) {
    const total = await db.campaignLead.count({ where: { campaignId: c.id } });
    const remaining = await db.campaignLead.count({ where: { campaignId: c.id, status: "ACTIVE" } });
    if (total > 0 && remaining === 0) {
      await db.campaign.update({ where: { id: c.id }, data: { status: "COMPLETED" } });
      continue;
    }
    if (!inSendWindow(c)) continue;
    const sentToday = await db.event.count({ where: { campaignId: c.id, type: "SENT", createdAt: { gte: startOfDayInTz(c.timezone) } } });
    let budget = c.dailyLimit - sentToday;
    for (const { accountId } of shuffle(c.accounts)) {
      if (budget <= 0) break;
      const acc = await accountCanSend(accountId);
      if (!acc) continue;
      const now = new Date();
      const cl = await db.campaignLead.findFirst({
        where: { campaignId: c.id, status: "ACTIVE", nextSendAt: { lte: now }, OR: [{ accountId: acc.id }, { accountId: null }] },
        orderBy: c.prioritizeNewLeads ? [{ currentStep: "asc" }, { nextSendAt: "asc" }] : [{ nextSendAt: "asc" }],
        include: { lead: true },
      });
      if (!cl) continue;
      // claim (prevents double sends if two workers run)
      const claimed = await db.campaignLead.updateMany({
        where: { id: cl.id, status: "ACTIVE", nextSendAt: cl.nextSendAt },
        data: { nextSendAt: new Date(Date.now() + 15 * 60_000) },
      });
      if (claimed.count !== 1) continue;
      const result = await sendCampaignStep(c, cl, acc);
      if (result === "sent") {
        sent++;
        budget--;
      }
    }
  }
  return sent;
}
