import { Suspense } from "react";
import { PrioritiesPage } from "@/components/pages/priorities";

export const metadata = { title: "Strategic Priorities" };

export default function Page() {
  return (
    <Suspense>
      <PrioritiesPage />
    </Suspense>
  );
}
