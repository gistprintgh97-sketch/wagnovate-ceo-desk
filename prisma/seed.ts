// Production bootstrap: creates ONLY the company + settings rows. No business data, no users.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  await db.company.upsert({ where: { id: "company" }, update: {}, create: { id: "company" } });
  await db.applicationSettings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });
  console.log("Bootstrap complete. Open /setup in the browser to create the CEO account.");
}
main().finally(() => db.$disconnect());
