import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { strip, testConnection } from "@/lib/accounts";

type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({
  fromName: z.string().min(1).optional(),
  dailyLimit: z.coerce.number().int().min(1).max(500).optional(),
  minGapMinutes: z.coerce.number().int().min(1).max(240).optional(),
  signature: z.string().optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  tags: z.array(z.string()).optional(),
  warmupEnabled: z.boolean().optional(),
  warmupStart: z.coerce.number().int().min(1).max(50).optional(),
  warmupIncrement: z.coerce.number().int().min(0).max(20).optional(),
  warmupMax: z.coerce.number().int().min(1).max(100).optional(),
  warmupReplyRate: z.coerce.number().int().min(0).max(100).optional(),
  password: z.string().min(1).optional(),
});

export const PATCH = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const acc = await db.emailAccount.findUnique({ where: { id } });
  if (!acc) throw new HttpError(404, "Account not found");
  const { password, ...data } = patch.parse(await req.json());
  const update: Record<string, unknown> = { ...data };
  if (password) {
    await testConnection(acc, password);
    update.passwordEnc = encrypt(password);
    update.status = "ACTIVE";
    update.lastError = null;
  }
  if (data.warmupEnabled && !acc.warmupStartedAt) update.warmupStartedAt = new Date();
  if (data.status === "ACTIVE") update.lastError = null;
  return strip(await db.emailAccount.update({ where: { id }, data: update }));
});

export const DELETE = api<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.emailAccount.delete({ where: { id } });
  return { ok: true };
});
