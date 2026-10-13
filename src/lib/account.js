// Deleting an account and sending a request from the public page: the two
// calls that need the browser. The wording and rules are in accountRules.js.
import { supabase } from "./supabaseClient";
import { CONFIRM_WORD } from "./accountRules";

export * from "./accountRules";

// Reads the `code` out of a failed functions.invoke() call.
async function codeOf(error) {
  try {
    const body = await error?.context?.json?.();
    return body?.code || "failed";
  } catch {
    return "failed";
  }
}

// Deletes the signed-in person's own account. Resolves to { ok: true } or
// { ok: false, code }. On success the caller signs out locally.
export async function deleteMyAccount({ password }) {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirm: CONFIRM_WORD, ...(password ? { password } : {}) }
  });
  if (error) return { ok: false, code: await codeOf(error) };
  return data?.ok ? { ok: true } : { ok: false, code: data?.code || "failed" };
}

// An admin deleting the account named in a request from the public page.
export async function deleteAccountFor(identity) {
  const { data, error } = await supabase.functions.invoke("delete-account", { body: { target: identity } });
  if (error) return { ok: false, code: await codeOf(error) };
  return data?.ok ? { ok: true } : { ok: false, code: data?.code || "failed" };
}

// The public form. Works signed out: it calls one edge function and
// nothing else, so a visitor still has no access to the database.
export async function sendAccountRequest({ kind, identity, message, website = "" }) {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ kind, identity, message, website })
    });
    const body = await response.json().catch(() => ({}));
    return response.ok && body.ok ? { ok: true } : { ok: false, code: body.code || "failed" };
  } catch {
    return { ok: false, code: "failed" };
  }
}
