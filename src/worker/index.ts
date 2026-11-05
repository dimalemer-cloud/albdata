import pLimit from "p-limit";
import { db } from "../lib/db";
import { senderTick } from "../lib/engine/sender";
import { syncAccount } from "../lib/engine/inbox";
import { warmupTick } from "../lib/engine/warmup";
import { jobTick } from "../lib/engine/jobs";

function loop(name: string, everyMs: number, fn: () => Promise<unknown>) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await fn();
      if (typeof r === "number" && r > 0) console.log(`[${name}] ${r}`);
    } catch (e) {
      console.error(`[${name}]`, (e as Error).message);
    } finally {
      busy = false;
    }
  };
  setTimeout(run, 2000);
  setInterval(run, everyMs);
}

async function syncAll() {
  const accounts = await db.emailAccount.findMany({ where: { status: { in: ["ACTIVE", "ERROR"] } } });
  const limit = pLimit(4);
  let total = 0;
  await Promise.all(
    accounts.map((acc) =>
      limit(async () => {
        try {
          total += await syncAccount(acc);
        } catch (e) {
          const msg = (e as Error).message;
          console.error(`[sync ${acc.email}]`, msg);
          if (/auth|login|credentials|invalid/i.test(msg)) {
            await db.emailAccount.update({ where: { id: acc.id }, data: { status: "ERROR", lastError: `IMAP: ${msg}`.slice(0, 300) } });
          }
        }
      }),
    ),
  );
  return total;
}

async function main() {
  // Recover jobs interrupted by a restart
  await db.job.updateMany({ where: { status: "RUNNING" }, data: { status: "QUEUED" } });
  console.log("albdata worker started");
  loop("sender", Number(process.env.SENDER_INTERVAL_MS || 20_000), senderTick);
  loop("inbox-sync", Number(process.env.SYNC_INTERVAL_MS || 90_000), syncAll);
  loop("warmup", Number(process.env.WARMUP_INTERVAL_MS || 180_000), warmupTick);
  loop("jobs", 3_000, () => jobTick());
}

main();
process.on("SIGTERM", async () => {
  await db.$disconnect();
  process.exit(0);
});
