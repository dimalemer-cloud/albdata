import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { addLeadsToCampaign } from "@/lib/leads";

export const POST = api(async (req) => {
  const body = z.object({ campaignId: z.string(), leadIds: z.array(z.string()).optional(), listId: z.string().optional() }).parse(await req.json());
  let ids = body.leadIds || [];
  if (body.listId) ids = (await db.lead.findMany({ where: { listId: body.listId }, select: { id: true } })).map((l) => l.id);
  return addLeadsToCampaign(body.campaignId, ids);
});
