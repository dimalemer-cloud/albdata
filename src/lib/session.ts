// Edge-safe session helpers (used by middleware and server code)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "albdata_session";
export type SessionClaims = { sub: string; role: "OWNER" | "ADMIN" | "MEMBER" | "CLIENT"; clientId?: string | null; name: string };

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret-change-me");
}

export async function signSession(claims: SessionClaims) {
  return new SignJWT({ ...claims }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function verifySession(token?: string): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}
