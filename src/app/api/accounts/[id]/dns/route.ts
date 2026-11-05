import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkDomainDns } from "@/lib/dns";
import { domainOf } from "@/lib/utils";

export const GET = api<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const acc = await db.emailAccount.findUnique({ where: { id } });
  if (!acc) throw new HttpError(404, "Account not found");
  return checkDomainDns(domainOf(acc.email));
});
