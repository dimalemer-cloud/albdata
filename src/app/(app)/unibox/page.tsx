import { Unibox } from "@/components/unibox/Unibox";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";

export default async function Page() {
  const [accounts, campaigns, ai] = await Promise.all([
    db.emailAccount.findMany({ select: { id: true, email: true }, orderBy: { email: "asc" } }),
    db.campaign.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    aiEnabled(),
  ]);
  return <Unibox accounts={accounts} campaigns={campaigns} aiEnabled={ai} />;
}
