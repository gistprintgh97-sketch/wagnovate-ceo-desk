import { Suspense } from "react";
import { ReportsPage } from "@/components/pages/reports";

export const metadata = { title: "Reports & Analytics" };

export default function Page() {
  return (
    <Suspense>
      <ReportsPage />
    </Suspense>
  );
}
