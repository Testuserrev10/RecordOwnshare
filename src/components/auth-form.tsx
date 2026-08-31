"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.text();
      const data = body ? JSON.parse(body) as { error?: string } : {};
      if (!response.ok) { setError(data.error ?? "Something went wrong. Please try again."); setPending(false); return; }
    } catch {
      setError("Capture could not reach the account service. Please try again.");
      setPending(false);
      return;
    }
    router.push("/capture"); router.refresh();
  }
  return <form className="auth-form" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={pending}>{pending ? "Opening workspace…" : mode === "signin" ? "Sign in" : "Create account"}</button></form>;
}
