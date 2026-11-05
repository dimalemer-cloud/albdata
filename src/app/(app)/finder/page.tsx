import { Finder } from "@/components/finder/Finder";
import { db } from "@/lib/db";
import { getSecrets } from "@/lib/workspace";

export default async function Page() {
  const [secrets, lists, clients] = await Promise.all([
    getSecrets(),
    db.leadList.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <Finder hasPlaces={!!secrets.placesKey} aiEnabled={!!secrets.anthropicKey} lists={lists} clients={clients} />;
}
