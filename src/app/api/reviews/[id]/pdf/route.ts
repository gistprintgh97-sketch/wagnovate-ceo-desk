import { NextResponse } from "next/server";
import { route } from "@/server/api";
import { renderPdf } from "@/server/pdf";
import { weeklyReportSpec } from "@/server/review-report";

export const GET = route({}, async ({ params }) => {
  const buf = await renderPdf(await weeklyReportSpec(params.id));
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="weekly-ceo-report.pdf"`, "cache-control": "no-store" } });
});
