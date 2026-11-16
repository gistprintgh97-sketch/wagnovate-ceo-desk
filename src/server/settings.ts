import { db } from "./db";
export const getSettings = () => db.applicationSettings.upsert({ where: { id: "settings" }, update: {}, create: { id: "settings" } });
export const getCompany = () => db.company.upsert({ where: { id: "company" }, update: {}, create: { id: "company" } });
