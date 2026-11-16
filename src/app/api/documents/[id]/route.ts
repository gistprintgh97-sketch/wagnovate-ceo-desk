import { route, AppError } from "@/server/api";
import { db } from "@/server/db";

// Soft delete: the file stays on disk and in the database history.
export const DELETE = route({}, async ({ params }) => {
  const d = await db.uploadedDocument.findUnique({ where: { id: params.id } });
  if (!d) throw new AppError(404, "That document no longer exists.");
  await db.uploadedDocument.update({ where: { id: d.id }, data: { deletedAt: new Date() } });
  return { ok: true };
});
