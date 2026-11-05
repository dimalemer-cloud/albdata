import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/engine/jobs";

export const POST = api(async (req) => {
  const { resultIds } = z.object({ resultIds: z.array(z.string()).min(1) }).parse(await req.json());
  const valid = (await db.finderResult.findMany({ where: { id: { in: resultIds }, website: { not: null } }, select: { id: true } })).map((r) => r.id);
  if (!valid.length) throw new Error("None of the selected businesses has a website");
  await db.finderResult.updateMany({ where: { id: { in: valid } }, data: { crawlStatus: "PENDING" } });
  const job = await enqueue("FINDER_CRAWL", { resultIds: valid }, valid.length);
  return { jobId: job.id, total: valid.length };
});
