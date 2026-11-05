import { api, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = api(async (req) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  if (file.size > 600_000) throw new HttpError(400, "Logo must be under 600 KB");
  if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/.test(file.type)) throw new HttpError(400, "Upload a PNG, JPG, SVG or WebP image");
  const dataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  await db.workspace.upsert({ where: { id: "default" }, update: { logoUrl: dataUrl }, create: { id: "default", logoUrl: dataUrl } });
  return { logoUrl: dataUrl };
}, { roles: ["OWNER", "ADMIN"] });
