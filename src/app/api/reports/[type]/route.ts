import { NextResponse } from "next/server";
import { route, AppError } from "@/server/api";
import { REPORT_TYPES, buildReport, reportToCsv, reportToPdf, resolveRange } from "@/server/reports";
import { renderPdf } from "@/server/pdf";

export const GET = route({}, async ({ req, params }) => {
  if (!REPORT_TYPES.some((t) => t.id === params.type)) throw new AppError(404, "Unknown report.");
  const sp = req.nextUrl.searchParams;
  const { range, preset } = resolveRange(sp);
  const rep = await buildReport(params.type, range, preset);
  const format = sp.get("format");
  const file = `${params.type}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv") return new NextResponse(reportToCsv(rep), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}.csv"` } });
  if (format === "pdf") {
    const buf = await renderPdf(reportToPdf(rep));
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${file}.pdf"` } });
  }
  return rep;
});
