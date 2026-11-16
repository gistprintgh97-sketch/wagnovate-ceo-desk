import { NextRequest } from "next/server";
import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { saveUpload, type Links } from "@/server/files";

export const GET = route({}, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const where: Record<string, string> = {};
  for (const k of ["customerId", "contractId", "projectId", "transactionId"]) if (sp.get(k)) where[k] = sp.get(k)!;
  if (!Object.keys(where).length) throw new AppError(400, "Say which record the documents belong to.");
  return { items: await db.uploadedDocument.findMany({ where, orderBy: { createdAt: "desc" } }) };
});

export const POST = route({}, async ({ req }: { req: NextRequest }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new AppError(400, "Choose a file to upload.");
  const links: Links = {};
  for (const k of ["customerId", "contractId", "projectId", "transactionId"] as const) { const v = form.get(k); if (typeof v === "string" && v) links[k] = v; }
  if (!Object.keys(links).length) throw new AppError(400, "Say which record the document belongs to.");
  const purpose = String(form.get("purpose") ?? "DOCUMENT").slice(0, 20);
  return saveUpload(file, purpose, links);
});
