import { redirect } from "next/navigation";
import { anyUserExists } from "@/server/auth";
import { SetupForm } from "./setup-form";

export const metadata = { title: "First-time setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await anyUserExists()) redirect("/login");
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Create the CEO account</h1>
      <p className="mb-4 text-xs text-muted">
        This page works once. It needs the SETUP_TOKEN from your .env file, so only someone with server access can create the owner account.
      </p>
      <SetupForm />
    </>
  );
}
