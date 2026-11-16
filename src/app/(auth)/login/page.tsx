import { redirect } from "next/navigation";
import Link from "next/link";
import { anyUserExists, getUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  if (!(await anyUserExists())) redirect("/setup");
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      <LoginForm />
      <p className="mt-4 text-center text-xs">
        <Link href="/forgot-password" className="text-accent hover:underline">Forgot your password?</Link>
      </p>
    </>
  );
}
