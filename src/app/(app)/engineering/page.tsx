import { Suspense } from "react";
import { EngineeringPage } from "@/components/pages/engineering";

export const metadata = { title: "Engineering & Products" };

export default function Page() {
  return (
    <Suspense>
      <EngineeringPage />
    </Suspense>
  );
}
