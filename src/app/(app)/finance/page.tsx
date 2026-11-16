import { Suspense } from "react";
import { FinancePage } from "@/components/pages/finance";

export const metadata = { title: "Finance" };

export default function Page() {
  return (
    <Suspense>
      <FinancePage />
    </Suspense>
  );
}
