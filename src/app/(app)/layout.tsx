import type { ReactNode } from "react";
import { requireUser } from "@/server/auth";
import { getCompany } from "@/server/settings";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const company = await getCompany();
  return (
    <AppShell company={{ name: company.name, hasLogo: !!company.logoDocId }} user={{ name: user.name, email: user.email }}>
      {children}
    </AppShell>
  );
}
