import { z } from "zod";
import { api, hashPassword, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, { params }, s) => {
  const { id } = await params;
  const b = z.object({ name: z.string().optional(), role: z.enum(["ADMIN", "MEMBER"]).optional(), password: z.string().min(8).optional() }).parse(await req.json());
  if (id !== s.sub && !["OWNER", "ADMIN"].includes(s.role)) throw new HttpError(403, "Forbidden");
  const target = await db.user.findUniqueOrThrow({ where: { id } });
  if (target.role === "OWNER" && b.role) throw new HttpError(400, "The owner's role can't be changed");
  await db.user.update({ where: { id }, data: { name: b.name, role: b.role, ...(b.password ? { passwordHash: await hashPassword(b.password) } : {}) } });
  return { ok: true };
});

export const DELETE = api<Ctx>(async (_req, { params }, s) => {
  const { id } = await params;
  const target = await db.user.findUniqueOrThrow({ where: { id } });
  if (target.role === "OWNER") throw new HttpError(400, "The owner can't be removed");
  if (id === s.sub) throw new HttpError(400, "You can't remove yourself");
  await db.user.delete({ where: { id } });
  return { ok: true };
}, { roles: ["OWNER", "ADMIN"] });
