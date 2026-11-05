import { LeadsHome } from "@/components/leads/LeadsHome";
import { db } from "@/lib/db";

export default async function Page() {
  const clients = await db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <LeadsHome clients={clients} />;
}
