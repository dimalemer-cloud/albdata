import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const count = await db.user.count();
  if (!count) redirect("/setup");
  const s = await getSession();
  if (!s) redirect("/login");
  redirect(s.role === "CLIENT" ? "/portal" : "/dashboard");
}
