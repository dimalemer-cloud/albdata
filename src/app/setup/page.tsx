import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { SetupForm } from "@/components/AuthForm";
import { db } from "@/lib/db";

export default async function SetupPage() {
  if (await db.user.count()) redirect("/login");
  return (
    <AuthShell title="Set up albdata" subtitle="Create the owner account for your agency.">
      <SetupForm />
    </AuthShell>
  );
}
