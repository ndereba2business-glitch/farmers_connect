import { supabase } from "./supabaseClient";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 1200;

export const IMAGE_ACCEPT = ACCEPTED.join(",");

export function validateImage(file) {
  if (!file) return "";
  if (!ACCEPTED.includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > MAX_INPUT_BYTES) return "That image is too large. Pick one under 15 MB.";
  return "";
}

// Phone cameras produce 4-12 MB photos. Shrink to at most 1200px and
// re-encode as JPEG before upload: much faster on slow mobile data, and it
// stays well under the buckets' 5 MB limit. Falls back to the original file
// if the browser can't decode it.
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Storage policies only allow writes inside the caller's own <uid>/ folder,
// in every photo bucket (marketplace-images, avatars, farm-gallery,
// community-posts). Returns the public URL.
export async function uploadImage(userId, file, prefix, bucket = "marketplace-images") {
  const body = await shrink(file);
  const ext = body.type === "image/png" ? "png" : body.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: body.type || "image/jpeg", upsert: false });
  if (error) throw error;

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Best effort: only files in the caller's own folder can be removed (older
// files at a bucket's root can't), and a failed cleanup must never block the
// save or delete that triggered it.
export async function removeImageByUrl(url, userId) {
  if (!url || !userId) return;
  const match = /\/object\/public\/([^/]+)\/(.+)$/.exec(String(url).split("?")[0]);
  if (!match) return;
  const [, bucket, rawPath] = match;
  const path = decodeURIComponent(rawPath);
  if (!path.startsWith(`${userId}/`)) return;
  await supabase.storage.from(bucket).remove([path]).catch(() => {});
}
