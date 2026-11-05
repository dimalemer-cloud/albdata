import { db } from "./db";
import { decrypt } from "./crypto";

export async function getWorkspace() {
  return (await db.workspace.findUnique({ where: { id: "default" } })) ?? (await db.workspace.create({ data: { id: "default" } }));
}

export async function getSecrets() {
  const w = await getWorkspace();
  const safe = (v?: string | null) => {
    if (!v) return null;
    try {
      return decrypt(v);
    } catch {
      return null;
    }
  };
  return {
    anthropicKey: safe(w.anthropicKeyEnc) || process.env.ANTHROPIC_API_KEY || null,
    placesKey: safe(w.placesKeyEnc) || process.env.GOOGLE_PLACES_API_KEY || null,
    aiModel: w.aiModel,
    trackingDomain: w.trackingDomain,
    verifyFromEmail: w.verifyFromEmail,
  };
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function trackingBase() {
  const w = await getWorkspace();
  if (w.trackingDomain) return `https://${w.trackingDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return appUrl();
}
