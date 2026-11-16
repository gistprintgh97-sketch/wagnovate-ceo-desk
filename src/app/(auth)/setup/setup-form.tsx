"use client";
import { AuthForm } from "@/components/auth-form";

export function SetupForm() {
  return (
    <AuthForm
      endpoint="/api/auth/setup" submit="Create account and continue" initial={{ name: "Wallace Gideon" }}
      fields={[
        { name: "token", label: "Setup token (SETUP_TOKEN in .env)", type: "password" },
        { name: "name", label: "Your name", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", autoComplete: "username" },
        { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters with upper-case, lower-case and a number." },
      ]}
      onSuccess={() => { window.location.href = "/"; }}
    />
  );
}
