"use client";
import { AuthForm } from "@/components/auth-form";

export function ResetForm({ token }: { token: string }) {
  return (
    <AuthForm
      endpoint="/api/auth/reset" submit="Save new password" initial={{ token }}
      fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters with upper-case, lower-case and a number." }]}
      onSuccess={() => { window.location.href = "/login"; }}
    />
  );
}
