import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { draftReply } from "@/lib/ai";
import { stripQuoted } from "@/lib/engine/classify";

export const POST = api(async (req) => {
  const { threadId, context } = z.object({ threadId: z.string(), context: z.string().optional() }).parse(await req.json());
  const t = await db.thread.findUnique({ where: { id: threadId }, include: { account: true, messages: { orderBy: { sentAt: "asc" }, where: { isBounce: false } } } });
  if (!t) throw new HttpError(404, "Thread not found");
  return draftReply({
    senderName: t.account.fromName,
    context,
    thread: t.messages.map((m) => ({ from: m.direction === "OUTBOUND" ? "us" : "them", text: m.direction === "INBOUND" ? stripQuoted(m.bodyText) : m.bodyText })),
  });
});
