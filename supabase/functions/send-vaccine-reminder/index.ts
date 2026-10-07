// Sends one vaccination reminder by SMS through Africa's Talking.
//
// Not used by the app today: notifications are in-app only. It is kept for
// a future SMS feature, and until then only an admin can call it. It used
// to accept calls from anyone who knew its address, with no sign-in, which
// made it an open SMS relay on the project's Africa's Talking account.
import { createClient } from "@supabase/supabase-js";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // Who is calling? Admin comes from app_metadata, which only the service
  // role can set; a self-declared role in user_metadata is ignored.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } }
  });
  const { data: auth } = await asCaller.auth.getUser();
  if (!auth?.user) return json(401, { error: "Sign in first" });
  if (auth.user.app_metadata?.role !== "admin") return json(403, { error: "Admins only" });

  let payload: { phone?: unknown; batchName?: unknown; vaccinationDate?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Send JSON with phone, batchName and vaccinationDate" });
  }
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const batchName = typeof payload.batchName === "string" ? payload.batchName.trim().slice(0, 60) : "";
  const vaccinationDate = typeof payload.vaccinationDate === "string" ? payload.vaccinationDate.trim().slice(0, 30) : "";
  if (!/^\+?\d{9,15}$/.test(phone) || !batchName || !vaccinationDate) {
    return json(400, { error: "phone, batchName and vaccinationDate are required" });
  }

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey: Deno.env.get("AFRICASTALKING_API_KEY") || "",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      username: "sandbox",
      to: phone,
      message: `Farmers Connect reminder:\n${batchName} vaccination is due on ${vaccinationDate}`
    })
  });

  return json(response.ok ? 200 : 502, await response.json().catch(() => ({ error: "SMS provider did not answer" })));
});
