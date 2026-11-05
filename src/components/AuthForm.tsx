"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input } from "./ui";
import { api } from "@/lib/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
          const r = await api<{ redirect: string }>("/api/auth/login", { body: { email, password } });
          router.push(params.get("next") || r.redirect);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setLoading(false);
        }
      }}
    >
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" loading={loading}>Sign in</Button>
    </form>
  );
}

export function SetupForm() {
  const router = useRouter();
  const [f, setF] = useState({ agency: "albdata", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
          await api("/api/auth/setup", { body: f });
          router.push("/dashboard");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setLoading(false);
        }
      }}
    >
      <Field label="Workspace name">
        <Input value={f.agency} onChange={(e) => setF({ ...f, agency: e.target.value })} required />
      </Field>
      <Field label="Your name">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus />
      </Field>
      <Field label="Email">
        <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      </Field>
      <Field label="Password" hint="min 8 characters">
        <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" loading={loading}>Create owner account</Button>
    </form>
  );
}
