import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  return db.job.findUnique({ where: { id } });
});
