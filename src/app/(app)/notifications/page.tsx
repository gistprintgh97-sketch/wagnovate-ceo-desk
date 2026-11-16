import { Suspense } from "react";
import { NotificationsPage } from "@/components/pages/notifications";

export const metadata = { title: "Notifications" };

export default function Page() {
  return (
    <Suspense>
      <NotificationsPage />
    </Suspense>
  );
}
