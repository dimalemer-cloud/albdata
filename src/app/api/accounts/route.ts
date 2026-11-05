import { z } from "zod";
import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { accountInput, resolveServer, strip, testConnection } from "@/lib/accounts";
import { startOfUtcDay } from "@/lib/schedule";
import { warmupHealth, warmupTarget } from "@/lib/engine/warmup";

export const GET = api(async () => {
  const accounts = await db.emailAccount.findMany({ orderBy: { createdAt: "asc" } });
  const today = startOfUtcDay();
  const sent = await db.event.groupBy({ by: ["accountId"], where: { type: "SENT", createdAt: { gte: today } }, _count: { _all: true } });
  return Promise.all(
    accounts.map(async (a) => ({
      ...strip(a),
      sentToday: sent.find((s) => s.accountId === a.id)?._count._all ?? 0,
      warmupTarget: warmupTarget(a),
      health: await warmupHealth(a.id),
    })),
  );
});

async function createOne(input: z.infer<typeof accountInput>, skipTest = false) {
  const email = input.email.toLowerCase().trim();
  if (await db.emailAccount.findUnique({ where: { email } })) throw new HttpError(400, `${email} is already connected`);
  const cfg = resolveServer(input);
  if (!skipTest) await testConnection(cfg, input.password);
  return db.emailAccount.create({
    data: {
      email,
      fromName: input.fromName,
      provider: input.provider,
      ...cfg,
      passwordEnc: encrypt(input.password),
      dailyLimit: input.dailyLimit ?? 30,
      minGapMinutes: input.minGapMinutes ?? 9,
      signature: input.signature ?? "",
      tags: input.tags ?? [],
      warmupEnabled: input.warmupEnabled ?? true,
      warmupStartedAt: input.warmupEnabled === false ? null : new Date(),
    },
  });
}

export const POST = api(async (req) => {
  const body = await req.json();
  if (Array.isArray(body.bulk)) {
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const row of body.bulk) {
      try {
        const parsed = accountInput.parse({ provider: "google", ...row });
        await createOne(parsed);
        results.push({ email: parsed.email, ok: true });
      } catch (e) {
        results.push({ email: row.email, ok: false, error: (e as Error).message });
      }
    }
    return { results };
  }
  const input = accountInput.parse(body);
  const acc = await createOne(input, body.skipTest === true && process.env.NODE_ENV !== "production");
  return strip(acc);
});
