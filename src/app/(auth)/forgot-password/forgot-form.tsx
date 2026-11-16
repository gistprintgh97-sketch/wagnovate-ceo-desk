"use client";
import { useState } from "react";
import { AuthForm } from "@/components/auth-form";

export function ForgotForm() {
  const [msg, setMsg] = useState<string | null>(null);
  if (msg) return <p role="status" className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm text-good">{msg}</p>;
  return (
    <AuthForm
      endpoint="/api/auth/forgot" submit="Send reset link"
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "username" }]}
      onSuccess={(r) => setMsg(r.message ?? "Done.")}
    />
  );
}
