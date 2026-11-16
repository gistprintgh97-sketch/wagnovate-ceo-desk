import { Suspense } from "react";
import { CustomersPage } from "@/components/pages/customers";

export const metadata = { title: "Customers & Feedback" };

export default function Page() {
  return (
    <Suspense>
      <CustomersPage />
    </Suspense>
  );
}
