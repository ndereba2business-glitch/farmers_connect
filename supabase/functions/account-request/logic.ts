// Checks for the public account-request form, free of Deno and Supabase so
// they can be unit tested (tests/unit/accountDeletion.test.js).

export const MAX_MESSAGE_LENGTH = 1000;
// The same identity may ask this many times a day, and the whole form
// accepts this many requests an hour, before it says "try later".
export const PER_IDENTITY_PER_DAY = 3;
export const TOTAL_PER_HOUR = 30;

export type RequestInput = { kind?: unknown; identity?: unknown; message?: unknown; website?: unknown };
export type Checked =
  | { ok: true; kind: "delete_account" | "privacy"; identity: string; message: string | null }
  | { ok: false; code: "bad_kind" | "bad_identity" | "too_long" | "bot" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the cleaned request, or why it is refused. An email is stored
// lower-case and a Kenyan phone number as 2547..., the forms accounts use,
// so an admin can match the request to an account.
export function checkRequest(input: RequestInput): Checked {
  // a field people never see; only a script fills it in
  if (typeof input.website === "string" && input.website.trim()) return { ok: false, code: "bot" };
  if (input.kind !== "delete_account" && input.kind !== "privacy") return { ok: false, code: "bad_kind" };

  const raw = typeof input.identity === "string" ? input.identity.trim() : "";
  let identity = "";
  if (EMAIL.test(raw) && raw.length <= 320) {
    identity = raw.toLowerCase();
  } else {
    let digits = raw.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) digits = digits.slice(1);
    if (digits.startsWith("0")) digits = "254" + digits.slice(1);
    if (/^\d{9,15}$/.test(digits)) identity = digits;
  }
  if (!identity) return { ok: false, code: "bad_identity" };

  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, code: "too_long" };
  return { ok: true, kind: input.kind, identity, message: message || null };
}
