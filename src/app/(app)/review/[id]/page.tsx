import { ReviewWizard } from "@/components/review/wizard";

export const metadata = { title: "Weekly CEO Review" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewWizard id={id} />;
}
