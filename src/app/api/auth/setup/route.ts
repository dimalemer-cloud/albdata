import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  if ((await db.user.count()) > 0) return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
  const parsed = z
    .object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8, "Password must be at least 8 characters"), agency: z.string().optional() })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { name, email, password, agency } = parsed.data;
  const user = await db.user.create({ data: { name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role: "OWNER" } });
  await db.workspace.upsert({ where: { id: "default" }, update: { name: agency || "albdata" }, create: { id: "default", name: agency || "albdata" } });
  await createSession(user);
  return NextResponse.json({ ok: true });
}
