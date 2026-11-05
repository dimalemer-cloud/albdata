import { z } from "zod";
import { api, hashPassword, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const b = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters") }).parse(await req.json());
  if (await db.user.findUnique({ where: { email: b.email.toLowerCase() } })) throw new HttpError(400, "A user with this email already exists");
  const u = await db.user.create({ data: { name: b.name, email: b.email.toLowerCase(), passwordHash: await hashPassword(b.password), role: "CLIENT", clientId: id } });
  return { id: u.id, name: u.name, email: u.email };
});

export const DELETE = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { userId } = z.object({ userId: z.string() }).parse(await req.json());
  await db.user.deleteMany({ where: { id: userId, clientId: id, role: "CLIENT" } });
  return { ok: true };
});
