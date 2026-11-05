import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

// Bulk delete / move
export const POST = api(async (req) => {
  const body = z.object({ action: z.enum(["delete", "move"]), leadIds: z.array(z.string()).min(1), listId: z.string().optional() }).parse(await req.json());
  if (body.action === "delete") {
    const r = await db.lead.deleteMany({ where: { id: { in: body.leadIds } } });
    return { deleted: r.count };
  }
  if (!body.listId) throw new Error("listId required");
  const r = await db.lead.updateMany({ where: { id: { in: body.leadIds } }, data: { listId: body.listId } });
  return { moved: r.count };
});
