import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";
import { importLeads } from "@/lib/leads";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const verify = sp.get("verify");
  const page = Math.max(1, Number(sp.get("page") || 1));
  const size = Math.min(500, Number(sp.get("size") || 50));
  const where: Prisma.LeadWhereInput = {
    listId: id,
    ...(status ? { status: status as Prisma.EnumLeadStatusFilter["equals"] } : {}),
    ...(verify ? { verifyStatus: verify === "none" ? null : verify } : {}),
    ...(q
      ? { OR: ["email", "firstName", "lastName", "companyName", "city"].map((f) => ({ [f]: { contains: q, mode: "insensitive" } })) }
      : {}),
  };
  const all = sp.get("ids") === "1";
  if (all) return { ids: (await db.lead.findMany({ where, select: { id: true } })).map((l) => l.id) };
  const [total, leads, list] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
    db.leadList.findUnique({ where: { id }, include: { client: true } }),
  ]);
  return { total, page, size, leads, list };
});

export const POST = api<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = z.object({ leads: z.array(z.unknown()).max(50000), dedupe: z.enum(["list", "all"]).optional() }).parse(await req.json());
  return importLeads(id, body.leads, body.dedupe);
});
