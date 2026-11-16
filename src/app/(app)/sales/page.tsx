import { Suspense } from "react";
import { SalesPage } from "@/components/pages/sales";

export const metadata = { title: "Sales & Contracts" };

export default function Page() {
  return (
    <Suspense>
      <SalesPage />
    </Suspense>
  );
}
