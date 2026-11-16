import { db } from "./db";
export const getSettings = () => db.applicationSettings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });
export const getCompany = () => db.company.upsert({ where: { id: "company" }, update: {}, create: { id: "company" } });

/** The four starting product records from the spec. Created once; never duplicated. */
export async function ensureInitialProjects() {
  const initial = [
    { name: "WAG SMS", category: "WAG_SMS" as const, description: "School management product." },
    { name: "WAG POS", category: "WAG_POS" as const, description: "Point-of-sale product." },
    { name: "Internal Business Projects", category: "INTERNAL_TOOLS" as const, description: "Internal tools and business projects." },
    { name: "Client Projects", category: "CLIENT_PROJECTS" as const, description: "Custom work for clients." },
  ];
  for (const p of initial) if (!(await db.project.findFirst({ where: { name: p.name } }))) await db.project.create({ data: { ...p, status: "ACTIVE" } });
}
