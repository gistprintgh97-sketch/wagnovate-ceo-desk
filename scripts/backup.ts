/** Creates a full PostgreSQL backup in ./backups using pg_dump (local install, or inside the docker container). */
import "dotenv/config";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is missing from .env"); process.exit(1); }
mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const file = `backups/ceo-desk-${stamp}.sql`;
const clean = url.split("?")[0];

const local = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
let dump: Buffer;
if (local.status === 0) dump = execFileSync("pg_dump", ["--no-owner", "--clean", "--if-exists", clean], { maxBuffer: 1 << 30 });
else {
  console.log("pg_dump not found on this computer; using the docker database container instead.");
  dump = execFileSync("docker", ["exec", "wagnovate-ceo-db", "pg_dump", "-U", "wagnovate", "--no-owner", "--clean", "--if-exists", "ceo_desk"], { maxBuffer: 1 << 30 });
}
writeFileSync(file, dump);
console.log(`Backup written to ${file} (${Math.round(dump.length / 1024)} KB).\nAlso copy storage/uploads somewhere safe, and keep backups off this computer.`);
