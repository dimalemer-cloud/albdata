import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";

// Simple in-memory brute-force protection: 10 failed attempts per IP+email per 15 minutes
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  const key = `${ip}|${body.data.email.toLowerCase()}`;
  const a = attempts.get(key);
  if (a && a.n >= 10 && a.until > Date.now()) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  const user = await db.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
  if (!user || !(await checkPassword(body.data.password, user.passwordHash))) {
    const cur = a && a.until > Date.now() ? a : { n: 0, until: Date.now() + 15 * 60_000 };
    attempts.set(key, { n: cur.n + 1, until: cur.until });
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  attempts.delete(key);
  await createSession(user);
  return NextResponse.json({ ok: true, redirect: user.role === "CLIENT" ? "/portal" : "/dashboard" });
}
