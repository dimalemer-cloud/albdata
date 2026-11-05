import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async () => {
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { users: { select: { id: true, name: true, email: true } }, _count: { select: { campaigns: true, lists: true, deals: true } } },
  });
  return clients;
});

export const POST = api(async (req) => {
  const b = z.object({ name: z.string().min(1), website: z.string().optional(), notes: z.string().optional() }).parse(await req.json());
  return db.client.create({ data: b });
});
