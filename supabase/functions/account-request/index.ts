// Takes a deletion or privacy request from the public /delete-account page,
// for people who cannot sign in (a forgotten password, a lost phone).
//
//   POST /functions/v1/account-request          (no sign-in)
//   { "kind": "delete_account" | "privacy", "identity": "email or phone", "message": "..." }
//
// It only writes one row to account_requests. Nothing is deleted here: an
// admin reads the request, confirms with the person that the account is
// theirs, and then acts. The reply is the same whether or not an account
// exists, so the form cannot be used to find out who has one.
//
// Visitors still have no access to the database. This function is the
// single, narrow way in, and it is limited per identity and overall.
import { createClient } from "@supabase/supabase-js";
import { PER_IDENTITY_PER_DAY, TOTAL_PER_HOUR, checkRequest } from "./logic.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "failed" });

  let input;
  try {
    input = await req.json();
  } catch {
    return json(400, { code: "bad_identity" });
  }
  const checked = checkRequest(input || {});
  // a script that filled the hidden field is told it worked
  if (!checked.ok) return checked.code === "bot" ? json(200, { ok: true }) : json(400, { code: checked.code });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Resolved requests are not kept: the privacy policy says 90 days. There
  // is no scheduler in this project, so the tidy-up rides on each new request.
  const expired = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { error: tidyError } = await admin.from("account_requests").delete().neq("status", "open").lt("resolved_at", expired);
  if (tidyError) console.error("account-request: tidy-up failed —", tidyError.code || "unknown");

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [recent, same] = await Promise.all([
    admin.from("account_requests").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
    admin.from("account_requests").select("id", { count: "exact", head: true }).eq("identity", checked.identity).gte("created_at", dayAgo)
  ]);
  if (recent.error || same.error) {
    console.error("account-request: limit check failed —", recent.error?.code || same.error?.code || "unknown");
    return json(500, { code: "failed" });
  }
  if ((recent.count || 0) >= TOTAL_PER_HOUR) return json(429, { code: "busy" });
  // already asked enough times today: say yes without adding another row
  if ((same.count || 0) >= PER_IDENTITY_PER_DAY) return json(200, { ok: true });

  const { error } = await admin.from("account_requests").insert({
    kind: checked.kind, identity: checked.identity, message: checked.message
  });
  if (error) {
    console.error("account-request: insert failed —", error.code || "unknown");
    return json(500, { code: "failed" });
  }
  return json(200, { ok: true });
});
