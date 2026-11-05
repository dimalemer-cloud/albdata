import type { Prisma } from "@prisma/client";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async (req) => {
  const sp = new URL(req.url).searchParams;
  const filter = sp.get("filter") || "all";
  const q = sp.get("q")?.trim();
  const where: Prisma.ThreadWhereInput = {
    hasReply: true,
    archived: filter === "archived",
    ...(filter === "unread" ? { unread: true } : {}),
    ...(["INTERESTED", "MEETING_BOOKED", "NOT_INTERESTED", "OUT_OF_OFFICE", "WRONG_PERSON", "NEUTRAL", "UNSUBSCRIBE"].includes(filter) ? { interest: filter } : {}),
    ...(sp.get("accountId") ? { accountId: sp.get("accountId")! } : {}),
    ...(sp.get("campaignId") ? { campaignId: sp.get("campaignId")! } : {}),
    ...(q ? { OR: [{ contactEmail: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const threads = await db.thread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      campaign: { select: { name: true } },
      account: { select: { email: true } },
      lead: { select: { companyName: true } },
      messages: { orderBy: { sentAt: "desc" }, take: 1, where: { direction: "INBOUND" }, select: { bodyText: true, sentAt: true, isAutoReply: true } },
    },
  });
  const counts = await db.thread.groupBy({ by: ["interest"], where: { hasReply: true, archived: false }, _count: { _all: true } });
  const unread = await db.thread.count({ where: { hasReply: true, archived: false, unread: true } });
  return {
    threads: threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      contactEmail: t.contactEmail,
      contactName: t.contactName,
      company: t.lead?.companyName ?? null,
      interest: t.interest,
      unread: t.unread,
      lastMessageAt: t.lastMessageAt,
      campaign: t.campaign?.name ?? null,
      account: t.account.email,
      snippet: (t.messages[0]?.bodyText || "").replace(/\s+/g, " ").slice(0, 140),
    })),
    counts: Object.fromEntries(counts.map((c) => [c.interest || "NONE", c._count._all])),
    unread,
  };
});
