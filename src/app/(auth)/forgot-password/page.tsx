import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
      <p className="mb-4 text-xs text-muted">Enter your email. We send a link that works for one hour.</p>
      <ForgotForm />
      <p className="mt-4 text-center text-xs">
        <Link href="/login" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
