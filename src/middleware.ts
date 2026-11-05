import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = [/^\/login/, /^\/setup/, /^\/api\/auth\//, /^\/t\//, /^\/u\//, /^\/r\//, /^\/api\/public\//, /^\/_next/, /^\/favicon/, /^\/uploads\//, /^\/logo/, /^\/api\/health/];

// Build redirect URLs from the host the browser used (works behind proxies like Codespaces/Caddy)
function redirectTo(req: NextRequest, pathname: string, search = "") {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")).split(",")[0];
  return NextResponse.redirect(new URL(`${pathname}${search}`, `${proto}://${host}`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return redirectTo(req, "/login", pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`);
  }
  if (session.role === "CLIENT" && !pathname.startsWith("/portal") && !pathname.startsWith("/api/portal") && !pathname.startsWith("/api/auth")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return redirectTo(req, "/portal");
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
