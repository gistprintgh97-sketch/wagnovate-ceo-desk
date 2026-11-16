import { route } from "@/server/api";
import { createRecord, getDef, listRecords } from "@/server/resources";

export const GET = route({}, async ({ req, params }) => listRecords(getDef(params.resource), req.nextUrl.searchParams));

export const POST = route({}, async ({ req, params }) => {
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  return createRecord(getDef(params.resource), body);
});
