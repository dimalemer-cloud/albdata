import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export const leadInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  companyName: z.string().nullish(),
  title: z.string().nullish(),
  website: z.string().nullish(),
  phone: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  linkedin: z.string().nullish(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  source: z.string().optional(),
});

export type LeadInput = z.infer<typeof leadInput>;

/** Import leads into a list. dedupe: "list" skips emails already in this list, "all" skips emails in any list. */
export async function importLeads(listId: string, raw: unknown[], dedupe: "list" | "all" = "list") {
  const valid: LeadInput[] = [];
  let invalid = 0;
  for (const r of raw) {
    const p = leadInput.safeParse(r);
    if (p.success) valid.push(p.data);
    else invalid++;
  }
  const unique = new Map<string, LeadInput>();
  for (const l of valid) if (!unique.has(l.email)) unique.set(l.email, l);
  const emails = [...unique.keys()];
  const existing = await db.lead.findMany({
    where: { email: { in: emails }, ...(dedupe === "list" ? { listId } : {}) },
    select: { email: true },
  });
  const skip = new Set(existing.map((e) => e.email));
  const blocked = await db.blockedEntry.findMany({ where: { value: { in: [...emails, ...emails.map((e) => e.split("@")[1])] } } });
  const blockedSet = new Set(blocked.map((b) => b.value));
  const rows: Prisma.LeadCreateManyInput[] = [];
  let blockedCount = 0;
  for (const [email, l] of unique) {
    if (skip.has(email)) continue;
    const isBlocked = blockedSet.has(email) || blockedSet.has(email.split("@")[1]);
    if (isBlocked) blockedCount++;
    rows.push({
      listId,
      email,
      firstName: l.firstName || null,
      lastName: l.lastName || null,
      companyName: l.companyName || null,
      title: l.title || null,
      website: l.website || null,
      phone: l.phone || null,
      city: l.city || null,
      country: l.country || null,
      linkedin: l.linkedin || null,
      customFields: (l.customFields || {}) as Prisma.InputJsonValue,
      source: l.source || "csv",
      status: isBlocked ? "UNSUBSCRIBED" : "NEW",
    });
  }
  for (let i = 0; i < rows.length; i += 1000) await db.lead.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
  return { imported: rows.length, duplicates: valid.length - rows.length, invalid, blocked: blockedCount };
}

/** Add leads to a campaign (skips leads already in it and blocked/bounced leads). */
export async function addLeadsToCampaign(campaignId: string, leadIds: string[]) {
  const leads = await db.lead.findMany({ where: { id: { in: leadIds }, status: { notIn: ["UNSUBSCRIBED", "BOUNCED"] }, OR: [{ verifyStatus: null }, { verifyStatus: { not: "invalid" } }] }, select: { id: true } });
  const res = await db.campaignLead.createMany({
    data: leads.map((l) => ({ campaignId, leadId: l.id })),
    skipDuplicates: true,
  });
  return { added: res.count, skipped: leadIds.length - res.count };
}
