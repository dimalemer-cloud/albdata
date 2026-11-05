import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = [/^\/login/, /^\/setup/, /^\/api\/auth\//, /^\/t\//, /^\/u\//, /^\/r\//, /^\/api\/public\//, /^\/_next/, /^\/favicon/, /^\/uploads\//, /^\/logo/, /^\/api\/health/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (session.role === "CLIENT" && !pathname.startsWith("/portal") && !pathname.startsWith("/api/portal") && !pathname.startsWith("/api/auth")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/portal";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
