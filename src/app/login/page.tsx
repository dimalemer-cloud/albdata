import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForm";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

export default async function LoginPage() {
  if (!(await db.user.count())) redirect("/setup");
  const w = await getWorkspace();
  return (
    <AuthShell title="Sign in" subtitle={`Welcome back to ${w.name}`} name={w.name} logoUrl={w.logoUrl}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
