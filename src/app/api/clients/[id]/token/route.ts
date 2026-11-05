import { randomUUID } from "node:crypto";
import { api } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  return db.client.update({ where: { id }, data: { shareToken: randomUUID().replace(/-/g, "") } });
});
