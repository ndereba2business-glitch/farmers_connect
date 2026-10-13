// Deletes an account for good: everything it owns in the database, its
// files, and then the login itself. This is the only place the app can do
// that, because removing a login needs the service role, which never
// reaches a browser.
//
//   POST /functions/v1/delete-account          (signed in)
//   { "confirm": "DELETE", "password": "..." }  a person deleting their own
//                                               account; the password can
//                                               be left out within ten
//                                               minutes of signing in
//   { "target": "email or phone" }              an admin acting on a
//                                               request from someone who
//                                               cannot sign in
//
// Replies 200 { ok: true }, or an HTTP error with a `code`:
//   not_signed_in, confirm_required, reauth_required, wrong_password,
//   admin_account, not_allowed, not_found, failed, login_not_removed.
//
// Order matters. The data goes first (one database transaction), then the
// files, then the login: tables that point at the login would otherwise
// refuse to let it go. If the last step fails the account is empty but
// still exists, and sending the request again finishes the job.
//
// Nothing personal is logged: no email, phone number or user id.
import { createClient } from "@supabase/supabase-js";
import { OWN_FOLDER_BUCKETS, groupFiles, proofNeeded, readClaims } from "./logic.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ACCOUNT_ALLOWED_ORIGINS") || Deno.env.get("CLUCKY_ALLOWED_ORIGINS") || "")
  .split(",").map(o => o.trim().replace(/\/$/, "")).filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { code: "failed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authorization = req.headers.get("Authorization") || "";

  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await asUser.auth.getUser();
  const caller = auth?.user;
  if (!caller || caller.is_anonymous) return json(401, { code: "not_signed_in" });

  let input: { confirm?: unknown; password?: unknown; target?: unknown };
  try {
    input = await req.json();
  } catch {
    return json(400, { code: "confirm_required" });
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const callerIsAdmin = caller.app_metadata?.role === "admin";

  let targetId = caller.id;
  let method: "self" | "admin" = "self";
  let accountRole = String(caller.user_metadata?.role || "farmer");

  if (typeof input.target === "string" && input.target.trim()) {
    // Only a real admin (app_metadata, which no account can give itself)
    // may delete somebody else's account.
    if (!callerIsAdmin) return json(403, { code: "not_allowed" });
    const { data: found, error } = await admin.rpc("account_for_identity", { p_identity: input.target.trim() });
    if (error) {
      console.error("delete-account: lookup failed —", error.code || "unknown");
      return json(500, { code: "failed" });
    }
    if (!found) return json(404, { code: "not_found" });
    targetId = found as string;
    method = "admin";
    const { data: target } = await admin.auth.admin.getUserById(targetId);
    accountRole = String(target?.user?.user_metadata?.role || "farmer");
  } else {
    // An admin account is removed by the project owner, never from here:
    // deleting the only admin would leave nobody to moderate.
    if (callerIsAdmin) return json(403, { code: "admin_account" });

    const token = authorization.replace(/^Bearer\s+/i, "");
    const proof = proofNeeded(input, readClaims(token), Math.floor(Date.now() / 1000));
    if (proof === "confirm_required" || proof === "reauth_required") return json(proof === "confirm_required" ? 400 : 401, { code: proof });
    if (proof === "check_password") {
      // Asks the sign-in service itself whether the password is right.
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify(caller.email ? { email: caller.email, password: input.password } : { phone: caller.phone, password: input.password })
      });
      const checked = response.ok ? await response.json().catch(() => null) : null;
      if (!checked?.user?.id || checked.user.id !== caller.id) return json(401, { code: "wrong_password" });
    }
  }

  // 1. Everything the account owns, in one transaction.
  const { data: removed, error: dataError } = await admin.rpc("delete_account_data", { p_user_id: targetId });
  if (dataError) {
    if (dataError.code === "42501") return json(403, { code: "admin_account" });
    if (dataError.code === "P0002") return json(404, { code: "not_found" });
    console.error("delete-account: data removal failed —", dataError.code || "unknown");
    return json(500, { code: "failed" });
  }

  // 2. Files. A file that will not delete must not keep the account
  // alive, so failures are counted and recorded for an admin to clean up.
  const filesLeft: string[] = [];
  const remove = async (bucket: string, paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) filesLeft.push(...batch.map(path => `${bucket}/${path}`));
    }
  };

  for (const bucket of OWN_FOLDER_BUCKETS) {
    const { data: listed, error } = await admin.storage.from(bucket).list(targetId, { limit: 1000 });
    if (error) { filesLeft.push(`${bucket}/${targetId}/*`); continue; }
    const paths = (listed || []).filter(entry => entry.id).map(entry => `${targetId}/${entry.name}`);
    if (paths.length) await remove(bucket, paths);
  }
  // older files that sit outside the person's own folder, found through the rows that pointed at them
  const byUrl = groupFiles((removed?.files || []) as string[], supabaseUrl);
  for (const [bucket, paths] of Object.entries(byUrl)) await remove(bucket, paths);
  const privateFiles = ((removed?.private_files || []) as string[]).filter(path => path && !path.includes(".."));
  if (privateFiles.length) await remove("lab-results", privateFiles);

  // 3. The login. After this the email or phone number can sign up afresh
  // and finds nothing from before.
  const { error: loginError } = await admin.auth.admin.deleteUser(targetId);
  if (loginError) {
    console.error("delete-account: login removal failed —", loginError.status || "unknown");
    return json(500, { code: "login_not_removed" });
  }

  const { error: logError } = await admin.from("account_deletions").insert({
    method, account_role: accountRole, rows_removed: removed?.counts || {}, files_left: filesLeft
  });
  if (logError) console.error("delete-account: could not write the deletion log —", logError.code || "unknown");

  console.log(`delete-account: done method=${method} files_left=${filesLeft.length}`);
  return json(200, { ok: true });
});
