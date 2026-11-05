import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { newMessageId, sendMail } from "@/lib/mailer";
import { render, textToHtml } from "@/lib/template";
import { htmlToText } from "@/lib/utils";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const b = z.object({ to: z.string().email(), subject: z.string(), body: z.string(), accountId: z.string().optional() }).parse(await req.json());
  const c = await db.campaign.findUniqueOrThrow({ where: { id }, include: { accounts: true } });
  const accountId = b.accountId || c.accounts[0]?.accountId;
  const acc = accountId ? await db.emailAccount.findUnique({ where: { id: accountId } }) : null;
  if (!acc) throw new HttpError(400, "Select a sending account in the Options tab first");
  const cl = await db.campaignLead.findFirst({ where: { campaignId: id }, include: { lead: true } });
  const lead = cl?.lead ?? { email: b.to, firstName: "Jane", companyName: "Example Co", customFields: {} };
  const sender = { fromName: acc.fromName, email: acc.email };
  const html = textToHtml(render(b.body, lead, sender, { html: true, tz: c.timezone })) + (acc.signature ? `<br><br>${textToHtml(acc.signature)}` : "");
  await sendMail(acc, { to: b.to, subject: `[TEST] ${render(b.subject || "Follow-up", lead, sender)}`, html, text: htmlToText(html), messageId: newMessageId(acc.email) });
  return { ok: true, from: acc.email };
});
