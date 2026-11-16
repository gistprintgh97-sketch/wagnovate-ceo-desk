import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

export type Block =
  | { t: "h2"; text: string }
  | { t: "p"; text: string }
  | { t: "md"; text: string }
  | { t: "bullets"; items: string[] }
  | { t: "kv"; rows: [string, string][] }
  | { t: "table"; columns: { label: string; width?: number; align?: "left" | "right" }[]; rows: string[][] }
  | { t: "space" };

export type PdfSpec = { title: string; subtitle?: string; blocks: Block[] };

const INK = "#0f172a", MUTED = "#64748b", ACCENT = "#2563eb", LINE = "#e2e8f0";
const accraStamp = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", dateStyle: "long", timeStyle: "short" }).format(new Date());

/** Draws "text with **bold** parts" on one flow. */
function richText(doc: PDFKit.PDFDocument, text: string, size: number, color: string) {
  const parts = text.split("**");
  parts.forEach((part, i) => {
    doc.font(i % 2 ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color).text(part, { continued: i < parts.length - 1, lineGap: 2 });
  });
  doc.font("Helvetica");
}

export async function renderPdf(spec: PdfSpec): Promise<Buffer> {
  const company = await db.company.findUnique({ where: { id: "company" } });
  let logo: Buffer | null = null;
  if (company?.logoDocId) {
    const d = await db.uploadedDocument.findUnique({ where: { id: company.logoDocId } });
    if (d && (d.mime === "image/png" || d.mime === "image/jpeg")) logo = await readFile(path.join(path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads"), d.storedName)).catch(() => null);
  }
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 48, right: 48 }, bufferPages: true, info: { Title: spec.title, Author: company?.name ?? "WAGNOVATE Technologies" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 96;

  // Branded header
  if (logo) { try { doc.image(logo, 48, 40, { fit: [120, 40] }); } catch { logo = null; } }
  doc.font("Helvetica-Bold").fontSize(logo ? 9 : 16).fillColor(INK).text(company?.name ?? "WAGNOVATE Technologies", logo ? 48 : 48, logo ? 86 : 44, { characterSpacing: logo ? 0 : 1.2 });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(company?.slogan ?? "Custom Software for Modern Businesses.", 48, doc.y);
  doc.moveTo(48, doc.y + 8).lineTo(48 + W, doc.y + 8).strokeColor(ACCENT).lineWidth(1.5).stroke();
  doc.moveDown(1.6);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text(spec.title, 48, doc.y, { width: W });
  if (spec.subtitle) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(spec.subtitle, { width: W });
  doc.fontSize(8).fillColor(MUTED).text(`Generated ${accraStamp()} (Africa/Accra)`, { width: W });
  doc.moveDown(1);

  const need = (h: number) => { if (doc.y + h > doc.page.height - 70) doc.addPage(); };

  for (const b of spec.blocks) {
    if (b.t === "space") { doc.moveDown(0.6); continue; }
    if (b.t === "h2") { need(50); doc.moveDown(0.6); doc.font("Helvetica-Bold").fontSize(12.5).fillColor(ACCENT).text(b.text, 48, doc.y, { width: W }); doc.moveDown(0.25); continue; }
    if (b.t === "p") { need(30); doc.font("Helvetica").fontSize(10).fillColor(INK).text(b.text, 48, doc.y, { width: W, lineGap: 2 }); doc.moveDown(0.3); continue; }
    if (b.t === "bullets") { for (const it of b.items) { need(22); doc.font("Helvetica").fontSize(10).fillColor(INK).text(`•  ${it}`, 56, doc.y, { width: W - 8, lineGap: 2 }); } doc.moveDown(0.3); continue; }
    if (b.t === "kv") { for (const [k, v] of b.rows) { need(18); const y = doc.y; doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(k, 48, y, { width: 190 }); doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(v, 240, y, { width: W - 192 }); } doc.moveDown(0.3); continue; }
    if (b.t === "md") {
      for (const raw of b.text.split("\n")) {
        const line = raw.trimEnd(); if (!line.trim()) continue; need(26);
        if (line.startsWith("### ")) { doc.moveDown(0.5); doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(line.slice(4), 48, doc.y, { width: W }); }
        else if (line.startsWith("- ")) { doc.x = 56; richText(doc, `•  ${line.slice(2)}`, 10, INK); doc.x = 48; }
        else { doc.x = 48; richText(doc, line, 10, INK); }
      }
      doc.moveDown(0.3); continue;
    }
    // table
    const total = b.columns.reduce((s, c) => s + (c.width ?? 1), 0);
    const widths = b.columns.map((c) => ((c.width ?? 1) / total) * W);
    const row = (cells: string[], bold: boolean, shade: boolean) => {
      const heights = cells.map((c, i) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).heightOfString(c, { width: widths[i] - 8 }));
      const h = Math.max(...heights) + 8; need(h + 4);
      const y = doc.y; if (shade) doc.rect(48, y, W, h).fill("#f1f5f9");
      let x = 48;
      cells.forEach((c, i) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(INK).text(c, x + 4, y + 4, { width: widths[i] - 8, align: b.columns[i].align ?? "left" }); x += widths[i]; });
      doc.y = y + h; doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).strokeColor(LINE).lineWidth(0.5).stroke();
    };
    row(b.columns.map((c) => c.label), true, true);
    if (!b.rows.length) { doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("No records for this period.", 52, doc.y + 6); doc.moveDown(1.2); }
    b.rows.forEach((r) => row(r, false, false));
    doc.moveDown(0.6);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`${company?.name ?? "WAGNOVATE Technologies"} · Confidential · Page ${i + 1} of ${range.count}`, 48, doc.page.height - 40, { width: W, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
