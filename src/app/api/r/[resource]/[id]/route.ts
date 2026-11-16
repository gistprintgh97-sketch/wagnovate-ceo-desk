import { route } from "@/server/api";
import { deleteRecord, getDef, getRecord, updateRecord } from "@/server/resources";

export const GET = route({}, async ({ params }) => getRecord(getDef(params.resource), params.id));

export const PATCH = route({}, async ({ req, params }) => {
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  return updateRecord(getDef(params.resource), params.id, body);
});

export const DELETE = route({}, async ({ params }) => deleteRecord(getDef(params.resource), params.id));
