import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { readStored } from "@/server/files";

// Public on purpose: the login page shows the company logo. Only the logo document is ever served here.
export async function GET() {
  const company = await db.company.findUnique({ where: { id: "company" } });
  if (!company?.logoDocId) return new NextResponse(null, { status: 404 });
  const doc = await db.uploadedDocument.findUnique({ where: { id: company.logoDocId } });
  if (!doc) return new NextResponse(null, { status: 404 });
  const buf = await readStored(doc.storedName);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": doc.mime, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
}
