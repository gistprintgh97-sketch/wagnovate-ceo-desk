import type { ReactNode } from "react";
import { getCompany } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const company = await getCompany();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {company.logoDocId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/branding/logo" alt={company.name} className="mx-auto mb-3 h-14 w-auto" />
          ) : (
            <p className="mb-1 text-2xl font-bold tracking-[0.18em]">WAGNOVATE</p>
          )}
          <p className="eyebrow">CEO DESK</p>
          <p className="mt-2 text-sm text-muted">Lead Better. Measure Progress. Build Bigger.</p>
        </div>
        <div className="panel p-6">{children}</div>
        <p className="mt-4 text-center text-[11px] text-muted">{company.name} · Private executive application</p>
      </div>
    </main>
  );
}
