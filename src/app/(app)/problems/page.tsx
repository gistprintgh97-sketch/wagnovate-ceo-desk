import { Suspense } from "react";
import { ProblemsPage } from "@/components/pages/problems";

export const metadata = { title: "Problems & Lessons" };

export default function Page() {
  return (
    <Suspense>
      <ProblemsPage />
    </Suspense>
  );
}
