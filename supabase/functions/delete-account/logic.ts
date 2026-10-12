// The decisions behind account deletion, with nothing here touching Deno,
// Supabase or the network, so they are unit tested from Node
// (tests/unit/accountDeletion.test.js).

// How long after actually signing in a person may delete their account
// without proving who they are again.
export const REAUTH_WINDOW_SECONDS = 10 * 60;

// The word the person must type. Deliberately not translated: it is the
// same string the function checks.
export const CONFIRM_WORD = "DELETE";

// Buckets where a person's files sit in a folder named after their user
// id. lab-results is not here: a vet's folder holds results that belong
// to farmers' records, which outlive the vet's account.
export const OWN_FOLDER_BUCKETS = ["avatars", "marketplace-images", "farm-gallery", "community-posts"];
const ALL_BUCKETS = new Set([...OWN_FOLDER_BUCKETS, "profile-photos", "lab-results"]);

export type Claims = { amr?: Array<{ method?: string; timestamp?: number }>; [key: string]: unknown };

// Reads the middle part of a sign-in token. The token has already been
// verified by Supabase before this runs; this only reads what it says.
export function readClaims(token: string): Claims {
  try {
    const part = token.split(".")[1] || "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// When the person last proved who they are (typed a password, came back
// from Google, entered a code), in seconds. A token that was only
// refreshed in the background keeps the original time, which is the
// point: an unlocked phone left on a table is not a fresh sign-in.
export function lastSignInAt(claims: Claims): number {
  const times = (claims.amr || []).map(entry => Number(entry?.timestamp) || 0);
  return times.length ? Math.max(...times) : 0;
}

export function signedInRecently(claims: Claims, nowSeconds: number): boolean {
  const at = lastSignInAt(claims);
  return at > 0 && nowSeconds - at >= 0 && nowSeconds - at <= REAUTH_WINDOW_SECONDS;
}

// What the request must still supply before a person's own account is
// deleted. "ok" means go ahead.
export function proofNeeded(
  input: { confirm?: unknown; password?: unknown },
  claims: Claims,
  nowSeconds: number
): "ok" | "confirm_required" | "check_password" | "reauth_required" {
  if (input.confirm !== CONFIRM_WORD) return "confirm_required";
  if (typeof input.password === "string" && input.password.length > 0) return "check_password";
  return signedInRecently(claims, nowSeconds) ? "ok" : "reauth_required";
}

// "https://x.supabase.co/storage/v1/object/public/avatars/uid/a.jpg"
// -> { bucket: "avatars", path: "uid/a.jpg" }. Null for anything that is
// not a file in one of this project's own buckets (a Google profile
// photo, for example).
export function storageRefFromUrl(url: string, projectUrl: string): { bucket: string; path: string } | null {
  const clean = String(url || "").split("?")[0];
  const base = projectUrl.replace(/\/$/, "");
  if (!clean.startsWith(base + "/storage/v1/object/public/")) return null;
  const rest = clean.slice((base + "/storage/v1/object/public/").length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  let path = rest.slice(slash + 1);
  try { path = decodeURIComponent(path); } catch { /* keep as written */ }
  if (!ALL_BUCKETS.has(bucket) || !path || path.includes("..")) return null;
  return { bucket, path };
}

// Public URLs grouped into { bucket: [paths] }, ready for storage.remove().
export function groupFiles(urls: string[], projectUrl: string): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const url of urls) {
    const ref = storageRefFromUrl(url, projectUrl);
    if (!ref) continue;
    (grouped[ref.bucket] ||= []).push(ref.path);
  }
  for (const bucket of Object.keys(grouped)) grouped[bucket] = [...new Set(grouped[bucket])];
  return grouped;
}
