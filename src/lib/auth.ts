import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, signSession, verifySession, type SessionClaims } from "./session";

export async function hashPassword(p: string) {
  return bcrypt.hash(p, 10);
}
export async function checkPassword(p: string, hash: string) {
  return bcrypt.compare(p, hash);
}

export async function createSession(user: { id: string; role: SessionClaims["role"]; clientId: string | null; name: string }) {
  const token = await signSession({ sub: user.id, role: user.role, clientId: user.clientId, name: user.name });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL || "").startsWith("https"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** For server components: team members only (not client users). */
export async function requireTeam() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "CLIENT") redirect("/portal");
  return s;
}

export async function requireAnyUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C, session: SessionClaims) => Promise<Response | unknown>;

/** Wrap an API route: enforces auth + role, converts thrown errors to JSON. */
export function api<C = { params: Promise<Record<string, string>> }>(
  handler: Handler<C>,
  opts: { roles?: SessionClaims["role"][] } = {},
) {
  return async (req: Request, ctx: C) => {
    try {
      const s = await getSession();
      if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      const roles = opts.roles ?? ["OWNER", "ADMIN", "MEMBER"];
      if (!roles.includes(s.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const out = await handler(req, ctx, s);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e: unknown) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      const err = e as { name?: string; issues?: { path: (string | number)[]; message: string }[]; message?: string };
      if (err?.name === "ZodError" && err.issues) {
        const i = err.issues[0];
        return NextResponse.json({ error: `${i.path.join(".") || "input"}: ${i.message}` }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
    }
  };
}

export async function currentUser() {
  const s = await getSession();
  if (!s) return null;
  return db.user.findUnique({ where: { id: s.sub } });
}
