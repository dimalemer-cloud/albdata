import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { testConnection } from "@/lib/accounts";

export const POST = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const acc = await db.emailAccount.findUnique({ where: { id } });
  if (!acc) throw new HttpError(404, "Account not found");
  try {
    await testConnection(acc, decrypt(acc.passwordEnc));
  } catch (e) {
    await db.emailAccount.update({ where: { id }, data: { status: "ERROR", lastError: (e as Error).message.slice(0, 300) } });
    throw new HttpError(400, (e as Error).message);
  }
  await db.emailAccount.update({ where: { id }, data: { status: acc.status === "PAUSED" ? "PAUSED" : "ACTIVE", lastError: null } });
  return { ok: true };
});
