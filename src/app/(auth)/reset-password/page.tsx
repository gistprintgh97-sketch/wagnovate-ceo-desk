import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Choose a new password</h1>
      <ResetForm token={token ?? ""} />
    </>
  );
}
