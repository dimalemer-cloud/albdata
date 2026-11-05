import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForm";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

export default async function LoginPage() {
  if (!(await db.user.count())) redirect("/setup");
  const w = await getWorkspace();
  const demo = process.env.DEMO_LOGIN?.split(":");
  return (
    <AuthShell title="Sign in" subtitle={`Welcome back to ${w.name}`} name={w.name} logoUrl={w.logoUrl}>
      {demo && (
        <div className="mb-4 rounded-lg bg-brand/10 p-3 text-sm text-slate-700">
          <b>Demo login</b>
          <br />
          {demo[0]} / {demo[1]}
        </div>
      )}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
