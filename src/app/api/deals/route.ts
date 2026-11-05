import { z } from "zod";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api(async (req) => {
  const clientId = new URL(req.url).searchParams.get("clientId");
  return db.deal.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
    include: {
      lead: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true, phone: true, website: true, threads: { select: { id: true }, take: 1 } } },
      client: { select: { name: true } },
      campaign: { select: { name: true } },
      owner: { select: { name: true } },
    },
  });
});

export const POST = api(async (req, _ctx, s) => {
  const b = z.object({ title: z.string().min(1), value: z.coerce.number().default(0), stage: z.string().default("interested"), clientId: z.string().nullish(), notes: z.string().optional() }).parse(await req.json());
  return db.deal.create({ data: { ...b, clientId: b.clientId || null, ownerId: s.sub } });
});
