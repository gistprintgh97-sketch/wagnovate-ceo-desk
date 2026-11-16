import { NextResponse } from "next/server";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { readStored } from "@/server/files";

// Authenticated download. Files are never served from a public folder.
export const GET = route({}, async ({ params }) => {
  const d = await db.uploadedDocument.findUnique({ where: { id: params.id } });
  if (!d) throw new AppError(404, "That file no longer exists.");
  const buf = await readStored(d.storedName);
  const inline = d.mime.startsWith("image/") || d.mime === "application/pdf";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": d.mime, "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(d.originalName)}"`, "x-content-type-options": "nosniff", "content-security-policy": "sandbox", "cache-control": "private, max-age=60" },
  });
});
