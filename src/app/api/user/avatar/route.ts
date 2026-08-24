import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, json, withUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const ALLOWED = Object.keys(EXT);

type Storage = ReturnType<typeof createAdminClient>["storage"];

/** Create the public avatars bucket on first use so no manual setup is needed. */
async function ensureBucket(storage: Storage) {
  const { data } = await storage.getBucket(BUCKET);
  if (data) return;
  await storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ALLOWED,
  });
}

/** Delete any existing avatar files for this user (keeps the folder to one). */
async function clearExisting(storage: Storage, userId: string) {
  const { data } = await storage.from(BUCKET).list(userId);
  if (data && data.length) {
    await storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
  }
}

export const POST = withUser(async (user, req: NextRequest) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return apiError("No image provided", 400);
  if (!ALLOWED.includes(file.type)) return apiError("Use a PNG, JPG or WebP image", 415);
  if (file.size > MAX_BYTES) return apiError("Image must be 5 MB or smaller", 413);

  const storage = createAdminClient().storage;
  await ensureBucket(storage);
  await clearExisting(storage, user.id);

  const path = `${user.id}/${Date.now()}.${EXT[file.type]}`;
  const { error: uploadError } = await storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (uploadError) return apiError("Could not upload the image. Please try again.", 502);

  const avatarUrl = storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  return json({ avatarUrl });
});

export const DELETE = withUser(async (user) => {
  await clearExisting(createAdminClient().storage, user.id);
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  return json({ ok: true });
});
