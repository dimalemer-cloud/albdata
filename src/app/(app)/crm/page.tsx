import { Pipeline } from "@/components/crm/Pipeline";
import { db } from "@/lib/db";

export default async function Page() {
  const clients = await db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <Pipeline clients={clients} />;
}
