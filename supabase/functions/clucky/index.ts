// Clucky AI: the poultry assistant behind /clucky.
//
// The browser sends one question; this function works out who is asking,
// checks their daily allowance, adds their recent conversation and a short
// summary of their farm, asks the AI service, and streams the answer back
// as it is written.
//
// Which AI service answers is decided in providers/ (Gemini today). The
// API key lives only there, as a function secret. It is never sent to the
// browser, never logged, and never returned in a response.
//
// Reply format: newline-delimited JSON, one event per line.
//   {"t":"delta","text":"..."}   a piece of the answer
//   {"t":"done","truncated":bool}
//   {"t":"error","code":"..."}   declined | busy | failed | not_configured
//                                | service_limit
// A not_configured reply also carries "reason" (key_missing, key_rejected,
// not_permitted or model_not_found) so the owner can tell which setting to
// fix. The app shows the farmer the same sentence for all of them.
// Problems found before the answer starts come back as ordinary JSON with
// an HTTP error status and a `code`: not_signed_in, not_configured,
// empty, too_long, daily_limit (this person's own allowance) or
// service_limit (the allowance shared by everyone is used up for now).
//
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL, CLUCKY_DAILY_LIMIT
// (per person), CLUCKY_GLOBAL_DAILY_LIMIT (everyone together; no cap when
// unset), CLUCKY_ALLOWED_ORIGINS (comma-separated; any origin when unset).
import { createClient } from "@supabase/supabase-js";
import {
  HISTORY_MESSAGES, SYSTEM_PROMPT, buildFarmContext, checkQuestion, styleNote, toModelMessages,
  type Batch, type OverdueVaccine, type StoredMessage
} from "./prompt.ts";
import { getProvider } from "./providers/index.ts";
import { AiError } from "./providers/types.ts";

// Background work that must finish even if the farmer leaves the page.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// One person's questions per day. Modest by default, because on a free
// plan every farmer draws on the same small allowance.
const DAILY_LIMIT = Math.max(1, Math.floor(Number(Deno.env.get("CLUCKY_DAILY_LIMIT")) || 15));
// Everyone's questions per day. Set it a little under the AI service's own
// daily allowance so Clucky stops politely before the service refuses.
const GLOBAL_DAILY_LIMIT = Math.max(0, Math.floor(Number(Deno.env.get("CLUCKY_GLOBAL_DAILY_LIMIT")) || 0));
// After the service says its daily allowance is used up, stop asking it
// for this long: every request in between would be refused anyway.
const QUOTA_PAUSE_MS = 10 * 60 * 1000;
// Room for a phone-sized answer plus the model's own brief reasoning.
const MAX_OUTPUT_TOKENS = 2000;

const ALLOWED_ORIGINS = (Deno.env.get("CLUCKY_ALLOWED_ORIGINS") || "")
  .split(",").map(o => o.trim().replace(/\/$/, "")).filter(Boolean);

// The sign-in token, not the origin, is what protects this endpoint: a
// request from anywhere still needs a valid Farmers Connect session. The
// origin list is a second fence for browsers, used once the owner sets it.
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
  const authorization = req.headers.get("Authorization") || "";

  // Acts as the caller, so row-level security decides what it can read.
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  const identity = user?.email || user?.phone;
  // An anonymous session is not an account: it gets no questions.
  if (!user || !identity || user.is_anonymous) return json(401, { code: "not_signed_in" });

  const provider = getProvider();
  if (!provider) return json(503, { code: "not_configured", reason: "key_missing" });

  let payload: { message?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { code: "empty" });
  }
  const checked = checkQuestion(payload?.message);
  if (!checked.ok) return json(400, { code: checked.code });
  const question = checked.question;

  // Writes the conversation, the allowance and the notification; never
  // handed anything the caller chose except the question text itself.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // The allowance everyone shares. If these figures cannot be read, Clucky
  // carries on: they exist to save pointless requests, not to gate access.
  const { data: dayRows, error: dayError } = await admin.rpc("clucky_day_state");
  if (dayError) console.error("clucky: day state unavailable —", dayError.code || "unknown");
  const dayState = Array.isArray(dayRows) ? dayRows[0] : dayRows;
  const lastQuotaHit = dayState?.last_quota_hit ? new Date(dayState.last_quota_hit).getTime() : 0;
  if (lastQuotaHit && Date.now() - lastQuotaHit < QUOTA_PAUSE_MS) return json(429, { code: "service_limit" });
  if (GLOBAL_DAILY_LIMIT && Number(dayState?.questions_today || 0) >= GLOBAL_DAILY_LIMIT) {
    return json(429, { code: "service_limit" });
  }

  // Counted before any money is spent, in one statement, so two requests
  // sent at once cannot both slip under the limit. Clearing the chat does
  // not reset it: the count lives in its own table.
  const { data: allowed, error: limitError } = await admin.rpc("clucky_take_question", {
    p_user_id: user.id, p_limit: DAILY_LIMIT
  });
  if (limitError) {
    console.error("clucky: allowance check failed —", limitError.code || "unknown");
    return json(500, { code: "failed" });
  }
  if (!allowed) return json(429, { code: "daily_limit", limit: DAILY_LIMIT });

  // Gives the question back when nothing was answered.
  const refund = async () => {
    const { error } = await admin.rpc("clucky_refund_question", { p_user_id: user.id });
    if (error) console.error("clucky: refund failed —", error.code || "unknown");
  };

  const today = new Date().toISOString().slice(0, 10);
  const [historyResult, profileResult, batchResult, vaccineResult] = await Promise.all([
    admin.from("clucky_messages").select("role, content")
      .eq("user_email", identity).order("created_at", { ascending: false }).limit(HISTORY_MESSAGES),
    asUser.from("farmer_profiles").select("county").eq("user_email", identity).maybeSingle(),
    asUser.from("farm_batches").select("batch_name, batch_type, hatch_date, current_count, quantity")
      .eq("user_email", identity).eq("status", "active").order("hatch_date", { ascending: false }).limit(8),
    asUser.from("vaccination_tasks").select("vaccine_name, scheduled_date, farm_batches(batch_name, status)")
      .eq("user_email", identity).eq("completed", false).lt("scheduled_date", today)
      .order("scheduled_date", { ascending: true }).limit(10)
  ]);

  const history = ((historyResult.data || []) as StoredMessage[]).reverse();
  const overdueVaccines: OverdueVaccine[] = (vaccineResult.data || [])
    // deno-lint-ignore no-explicit-any
    .filter((v: any) => v.farm_batches?.status === "active")
    // deno-lint-ignore no-explicit-any
    .map((v: any) => ({ vaccine_name: v.vaccine_name, scheduled_date: v.scheduled_date, batch_name: v.farm_batches?.batch_name }));

  // Only what changes the advice goes to the AI service: the county, the
  // batches and overdue vaccines. No name, email, phone number or farm name.
  const farmContext = buildFarmContext({
    county: profileResult.data?.county,
    role: user.user_metadata?.role,
    batches: (batchResult.data || []) as Batch[],
    overdueVaccines
  });

  const { data: saved, error: saveError } = await admin
    .from("clucky_messages").insert({ user_email: identity, role: "user", content: question }).select("id").single();
  if (saveError) {
    await refund();
    return json(500, { code: "failed" });
  }

  const encoder = new TextEncoder();
  let clientGone = false;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    cancel() { clientGone = true; }
  });
  const send = (event: Record<string, unknown>) => {
    if (clientGone) return;
    try {
      controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
    } catch {
      clientGone = true;
    }
  };

  const work = (async () => {
    try {
      const result = await provider.generate({
        system: [SYSTEM_PROMPT, farmContext, styleNote(history, question)].filter(Boolean).join("\n\n"),
        messages: toModelMessages(history, question),
        maxOutputTokens: MAX_OUTPUT_TOKENS
      }, text => send({ t: "delta", text }));

      if (result.declined) {
        // Nothing useful came back: don't keep or count the question.
        await admin.from("clucky_messages").delete().eq("id", saved.id);
        await refund();
        send({ t: "error", code: "declined" });
        return;
      }

      await admin.from("clucky_messages").insert({ user_email: identity, role: "assistant", content: result.text });

      // What the answer cost, for the admin's usage figures.
      const { error: costError } = await admin.rpc("clucky_record_answer", {
        p_user_id: user.id,
        p_input_tokens: Math.round(result.usage?.inputTokens || 0),
        p_output_tokens: Math.round(result.usage?.outputTokens || 0)
      });
      if (costError) console.error("clucky: usage not recorded —", costError.code || "unknown");

      // Only worth a notification if the farmer left before it finished.
      if (clientGone) {
        await admin.rpc("push_notification", {
          p_user_email: identity,
          p_type: "clucky",
          p_title: "Clucky has answered your question",
          p_message: question.length > 90 ? question.slice(0, 90) + "..." : question,
          p_link: "/clucky",
          p_dedupe_key: "clucky:" + saved.id
        });
      }

      // Sizes only, for watching cost. Never the question or the answer.
      console.log(`clucky: answered model=${provider.model} in=${result.usage?.inputTokens ?? "?"} out=${result.usage?.outputTokens ?? "?"}`);
      send({ t: "done", truncated: result.truncated });
    } catch (error) {
      const failure = error instanceof AiError ? error.code : "failed";
      // The farmer does not need to know whose allowance ran out.
      const code = failure === "quota" ? "service_limit" : failure;
      const reason = error instanceof AiError ? error.reason : undefined;
      const detail = error instanceof AiError ? error.detail : (error instanceof Error ? error.name : "unknown");
      console.error(`clucky: ${provider.name} call failed — ${code} (${detail}) model=${provider.model}`);
      await admin.from("clucky_messages").delete().eq("id", saved.id);
      await refund();
      if (failure !== "not_configured") {
        const { error: noteError } = await admin.rpc("clucky_record_service_event", { p_kind: failure === "quota" ? "quota" : "failure" });
        if (noteError) console.error("clucky: service event not recorded —", noteError.code || "unknown");
      }
      send(reason ? { t: "error", code, reason } : { t: "error", code });
    } finally {
      try { controller.close(); } catch { /* the client already went away */ }
    }
  })();

  EdgeRuntime.waitUntil(work);

  return new Response(body, {
    headers: {
      ...cors,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
});
