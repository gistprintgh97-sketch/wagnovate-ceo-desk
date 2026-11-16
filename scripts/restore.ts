/** Restores a backup made by `pnpm db:backup`. This REPLACES the current database, so it asks you to type RESTORE first. */
import "dotenv/config";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const file = process.argv[2];
if (!file) { console.error("Usage: pnpm db:restore backups/<file>.sql"); process.exit(1); }
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is missing from .env"); process.exit(1); }
const sql = readFileSync(file);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`This will REPLACE all current data with ${file}.\nMake a fresh backup first if unsure. Type RESTORE to continue: `);
rl.close();
if (answer.trim() !== "RESTORE") { console.log("Cancelled. Nothing was changed."); process.exit(0); }

const local = spawnSync("psql", ["--version"], { encoding: "utf8" });
if (local.status === 0) execFileSync("psql", [url.split("?")[0], "-v", "ON_ERROR_STOP=1"], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
else execFileSync("docker", ["exec", "-i", "wagnovate-ceo-db", "psql", "-U", "wagnovate", "-d", "ceo_desk", "-v", "ON_ERROR_STOP=1"], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
console.log("Restore complete. Restart the app.");
