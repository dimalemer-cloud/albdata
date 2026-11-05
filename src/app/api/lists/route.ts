import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async () => {
  const lists = await db.leadList.findMany({ orderBy: { createdAt: "desc" }, include: { client: true, _count: { select: { leads: true } } } });
  const verified = await db.lead.groupBy({ by: ["listId", "verifyStatus"], _count: { _all: true } });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    client: l.client?.name ?? null,
    clientId: l.clientId,
    count: l._count.leads,
    valid: verified.filter((v) => v.listId === l.id && v.verifyStatus === "valid").reduce((s, v) => s + v._count._all, 0),
    createdAt: l.createdAt,
  }));
});

export const POST = api(async (req) => {
  const { name, clientId } = z.object({ name: z.string().min(1), clientId: z.string().nullish() }).parse(await req.json());
  return db.leadList.create({ data: { name, clientId: clientId || null } });
});
