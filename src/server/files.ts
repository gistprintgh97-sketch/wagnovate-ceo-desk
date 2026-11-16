import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { AppError } from "./api";

const DIR = () => path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");

type Kind = { ext: string; mime: string; magic: (b: Buffer) => boolean; image?: boolean };
const isZip = (b: Buffer) => b.subarray(0, 2).toString("latin1") === "PK";
const KINDS: Kind[] = [
  { ext: "png", mime: "image/png", image: true, magic: (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" },
  { ext: "jpg", mime: "image/jpeg", image: true, magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  { ext: "webp", mime: "image/webp", image: true, magic: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { ext: "pdf", mime: "application/pdf", magic: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: isZip },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: isZip },
  { ext: "txt", mime: "text/plain", magic: (b) => !b.subarray(0, 512).includes(0) },
  { ext: "csv", mime: "text/csv", magic: (b) => !b.subarray(0, 512).includes(0) },
];

export type Links = { customerId?: string; contractId?: string; projectId?: string; transactionId?: string };

/** Validates by file CONTENT (magic bytes), not the browser-supplied type, then stores outside the public folder. */
export async function saveUpload(file: File, purpose: string, links: Links = {}, opts: { imagesOnly?: boolean; maxBytes?: number } = {}) {
  const max = opts.maxBytes ?? 10 * 1024 * 1024;
  if (file.size === 0) throw new AppError(400, "That file is empty.");
  if (file.size > max) throw new AppError(400, `That file is too large. The limit is ${Math.round(max / 1048576)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace("jpeg", "jpg");
  const kind = KINDS.find((k) => k.ext === ext);
  if (!kind || !kind.magic(buf) || (opts.imagesOnly && !kind.image)) {
    throw new AppError(400, opts.imagesOnly ? "Please upload a PNG, JPG or WEBP image." : "That file type is not allowed. Use PNG, JPG, WEBP, PDF, DOCX, XLSX, TXT or CSV.");
  }
  await mkdir(DIR(), { recursive: true });
  const storedName = `${randomUUID()}.${kind.ext}`;
  await writeFile(path.join(DIR(), storedName), buf);
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return db.uploadedDocument.create({ data: { purpose, originalName: safeName, storedName, mime: kind.mime, size: buf.length, ...links } });
}

export async function readStored(storedName: string) {
  if (!/^[0-9a-f-]{36}\.\w{2,4}$/.test(storedName)) throw new AppError(404, "File not found.");
  try { return await readFile(path.join(DIR(), storedName)); } catch { throw new AppError(404, "File not found."); }
}
