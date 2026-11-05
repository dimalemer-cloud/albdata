import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async () => db.blockedEntry.findMany({ orderBy: { createdAt: "desc" }, take: 2000 }));

export const POST = api(async (req) => {
  const { values } = z.object({ values: z.array(z.string()) }).parse(await req.json());
  const clean = [...new Set(values.map((v) => v.trim().toLowerCase().replace(/^@/, "")).filter((v) => v.includes(".")))];
  await db.blockedEntry.createMany({ data: clean.map((value) => ({ value, reason: "Added manually" })), skipDuplicates: true });
  // stop active sequences for blocked emails/domains
  for (const v of clean) {
    await db.campaignLead.updateMany({
      where: { status: "ACTIVE", lead: v.includes("@") ? { email: v } : { email: { endsWith: `@${v}` } } },
      data: { status: "UNSUBSCRIBED", nextSendAt: null, lastError: "Blocklisted" },
    });
  }
  return { added: clean.length };
});

export const DELETE = api(async (req) => {
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await db.blockedEntry.delete({ where: { id } });
  return { ok: true };
});
