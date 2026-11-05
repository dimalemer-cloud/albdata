import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getWorkspace, appUrl } from "@/lib/workspace";

export const GET = api(async () => {
  const w = await getWorkspace();
  const { anthropicKeyEnc, placesKeyEnc, ...rest } = w;
  return { ...rest, hasAnthropicKey: !!anthropicKeyEnc || !!process.env.ANTHROPIC_API_KEY, hasPlacesKey: !!placesKeyEnc || !!process.env.GOOGLE_PLACES_API_KEY, appUrl: appUrl() };
});

export const PATCH = api(async (req) => {
  const b = z
    .object({
      name: z.string().min(1).optional(),
      brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      logoUrl: z.string().nullable().optional(),
      trackingDomain: z.string().nullable().optional(),
      defaultTimezone: z.string().optional(),
      aiModel: z.string().optional(),
      anthropicKey: z.string().nullable().optional(),
      placesKey: z.string().nullable().optional(),
    })
    .parse(await req.json());
  const { anthropicKey, placesKey, ...data } = b;
  const update: Record<string, unknown> = { ...data };
  if (anthropicKey !== undefined) update.anthropicKeyEnc = anthropicKey ? encrypt(anthropicKey.trim()) : null;
  if (placesKey !== undefined) update.placesKeyEnc = placesKey ? encrypt(placesKey.trim()) : null;
  if (data.trackingDomain !== undefined) update.trackingDomain = data.trackingDomain ? data.trackingDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim() || null : null;
  await db.workspace.upsert({ where: { id: "default" }, update, create: { id: "default", ...update } });
  return { ok: true };
}, { roles: ["OWNER", "ADMIN"] });
