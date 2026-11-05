import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async () => {
  const since = new Date(Date.now() - 13 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await db.$queryRaw<{ d: string; landed: string | null; reply: boolean; c: number }[]>`
    SELECT to_char(date_trunc('day', "sentAt"), 'YYYY-MM-DD') d, "landedIn" landed, "isReply" reply, count(*)::int c
    FROM "WarmupEmail" WHERE "sentAt" >= ${since} GROUP BY 1, 2, 3`;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const r = rows.filter((x) => x.d === d);
    return {
      date: d,
      sent: r.filter((x) => !x.reply).reduce((s, x) => s + x.c, 0),
      replies: r.filter((x) => x.reply).reduce((s, x) => s + x.c, 0),
      inbox: r.filter((x) => x.landed === "INBOX").reduce((s, x) => s + x.c, 0),
      spam: r.filter((x) => x.landed === "SPAM").reduce((s, x) => s + x.c, 0),
    };
  });
  const pool = await db.emailAccount.count({ where: { warmupEnabled: true, status: "ACTIVE" } });
  return { days, pool };
});
