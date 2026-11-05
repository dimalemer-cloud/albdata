import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAccount } from "@/lib/engine/inbox";

export const POST = api(async () => {
  const accounts = await db.emailAccount.findMany({ where: { status: { not: "PAUSED" } } });
  const results = await Promise.allSettled(accounts.map((a) => syncAccount(a)));
  return { synced: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length };
});
