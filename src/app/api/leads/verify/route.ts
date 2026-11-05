import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/engine/jobs";

export const POST = api(async (req) => {
  const body = z.object({ leadIds: z.array(z.string()).optional(), listId: z.string().optional(), onlyUnverified: z.boolean().optional() }).parse(await req.json());
  let ids = body.leadIds || [];
  if (body.listId) {
    ids = (await db.lead.findMany({ where: { listId: body.listId, ...(body.onlyUnverified ? { verifyStatus: null } : {}) }, select: { id: true } })).map((l) => l.id);
  }
  if (!ids.length) throw new Error("No leads to verify");
  const job = await enqueue("VERIFY_LEADS", { leadIds: ids }, ids.length);
  return { jobId: job.id, total: ids.length };
});
