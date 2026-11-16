"use client";
import { AuthForm } from "@/components/auth-form";

export function LoginForm() {
  return (
    <AuthForm
      endpoint="/api/auth/login" submit="Sign in"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "username" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      onSuccess={() => { window.location.href = "/"; }}
    />
  );
}
