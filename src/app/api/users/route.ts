import { z } from "zod";
import { api, hashPassword, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async () =>
  db.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
);

export const POST = api(async (req) => {
  const b = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters"), role: z.enum(["ADMIN", "MEMBER"]) }).parse(await req.json());
  if (await db.user.findUnique({ where: { email: b.email.toLowerCase() } })) throw new HttpError(400, "A user with this email already exists");
  const u = await db.user.create({ data: { name: b.name, email: b.email.toLowerCase(), passwordHash: await hashPassword(b.password), role: b.role } });
  return { id: u.id };
}, { roles: ["OWNER", "ADMIN"] });
