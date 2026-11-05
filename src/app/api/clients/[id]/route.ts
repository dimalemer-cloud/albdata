import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = z.object({ name: z.string().min(1).optional(), website: z.string().optional(), notes: z.string().optional() }).parse(await req.json());
  return db.client.update({ where: { id }, data: b });
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.client.delete({ where: { id } });
  return { ok: true };
}, { roles: ["OWNER", "ADMIN"] });
