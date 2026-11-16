import { route, AppError } from "@/server/api";
import { db } from "@/server/db";
import { saveUpload } from "@/server/files";

// Logo (company) or profile picture (user). Images only, 2 MB max, checked by file content.
export const POST = route({}, async ({ req, user }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file"); const kind = form?.get("kind");
  if (!(file instanceof File) || (kind !== "logo" && kind !== "avatar")) throw new AppError(400, "Choose an image file.");
  const doc = await saveUpload(file, kind === "logo" ? "LOGO" : "AVATAR", {}, { imagesOnly: true, maxBytes: 2 * 1024 * 1024 });
  if (kind === "logo") await db.company.update({ where: { id: "company" }, data: { logoDocId: doc.id } });
  else await db.user.update({ where: { id: user.id }, data: { avatarDocId: doc.id } });
  return { id: doc.id };
});
