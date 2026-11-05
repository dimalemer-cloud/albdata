import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const data = z.object({ name: z.string().min(1).optional(), clientId: z.string().nullish() }).parse(await req.json());
  return db.leadList.update({ where: { id }, data });
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.leadList.delete({ where: { id } });
  return { ok: true };
});
