import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { missingVars, render, spamCheck, textToHtml } from "@/lib/template";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const b = z.object({ subject: z.string(), body: z.string(), leadIndex: z.number().int().min(0).default(0) }).parse(await req.json());
  const c = await db.campaign.findUniqueOrThrow({ where: { id }, include: { accounts: { include: { account: true }, take: 1 } } });
  const total = await db.campaignLead.count({ where: { campaignId: id } });
  const cl = total ? await db.campaignLead.findFirst({ where: { campaignId: id }, include: { lead: true }, orderBy: { createdAt: "asc" }, skip: b.leadIndex % total }) : null;
  const lead = cl?.lead ?? { email: "jane@example.com", firstName: "Jane", lastName: "Doe", companyName: "Example Dental", city: "Austin", website: "exampledental.com", customFields: {} };
  const acc = c.accounts[0]?.account;
  const sender = { fromName: acc?.fromName || "Your Name", email: acc?.email || "you@agency.com" };
  const subject = render(b.subject, lead, sender, { tz: c.timezone });
  const html = textToHtml(render(b.body, lead, sender, { html: true, tz: c.timezone })) + (acc?.signature ? `<br><br>${textToHtml(acc.signature)}` : "");
  return {
    lead: { email: lead.email, name: [lead.firstName, lead.lastName].filter(Boolean).join(" "), company: lead.companyName },
    leadIndex: b.leadIndex,
    totalLeads: total,
    subject,
    html,
    missing: [...new Set([...missingVars(b.subject, lead), ...missingVars(b.body, lead)])],
    spam: spamCheck(`${b.subject}\n${b.body}`),
  };
});
