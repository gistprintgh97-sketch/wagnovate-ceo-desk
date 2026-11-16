// Production bootstrap: creates ONLY the company + settings rows and the four starting product records.
// No users, no customers, no money. Open /setup in the browser to create the CEO account.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const INITIAL = [
  { name: "WAG SMS", category: "WAG_SMS" as const, description: "School management product." },
  { name: "WAG POS", category: "WAG_POS" as const, description: "Point-of-sale product." },
  { name: "Internal Business Projects", category: "INTERNAL_TOOLS" as const, description: "Internal tools and business projects." },
  { name: "Client Projects", category: "CLIENT_PROJECTS" as const, description: "Custom work for clients." },
];

async function main() {
  await db.company.upsert({ where: { id: "company" }, update: {}, create: { id: "company" } });
  await db.applicationSettings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });
  for (const p of INITIAL) if (!(await db.project.findFirst({ where: { name: p.name } }))) await db.project.create({ data: { ...p, status: "ACTIVE" } });
  console.log("Bootstrap complete. Open /setup in the browser to create the CEO account.");
}
main().finally(() => db.$disconnect());
