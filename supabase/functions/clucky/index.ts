// Clucky AI: the poultry assistant behind /clucky.
//
// The browser sends one question; this function works out who is asking,
// adds their farm records and recent conversation, asks Claude, and
// streams the answer back as it is written. The Anthropic API key lives
// only here, as a function secret (ANTHROPIC_API_KEY). It is never sent
// to the browser.
//
// Reply format: newline-delimited JSON, one event per line.
//   {"t":"delta","text":"..."}   a piece of the answer
//   {"t":"reset"}                discard what was shown so far (the first
//                                model declined and another took over)
//   {"t":"done","truncated":bool}
//   {"t":"error","code":"..."}   declined | busy | failed
// Problems found before the answer starts come back as ordinary JSON with
// an HTTP error status and a `code`: not_signed_in, not_configured,
// empty, too_long, daily_limit.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  HISTORY_MESSAGES, SYSTEM_PROMPT, buildFarmContext, checkQuestion, modelOptions, toModelMessages,
  type Batch, type OverdueVaccine, type StoredMessage
} from "./prompt.ts";

// Background work that must finish even if the farmer leaves the page.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MODEL = Deno.env.get("CLUCKY_MODEL") || "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("CLUCKY_DAILY_LIMIT")) || 30;
// Room for the model's own reasoning plus a phone-sized answer. A ceiling
// on what one question can cost, not a target.
const MAX_TOKENS = 8000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Why the model call failed, as a code the app can explain.
function failureCode(error: unknown): "not_configured" | "busy" | "failed" {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "not_configured";
  if (error instanceof Anthropic.RateLimitError) return "busy";
  if (error instanceof Anthropic.APIConnectionError) return "busy";
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) return "busy";
  return "failed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
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
  if (!user || !identity) return json(401, { code: "not_signed_in" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { code: "not_configured" });

  let payload: { message?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { code: "empty" });
  }
  const checked = checkQuestion(payload?.message);
  if (!checked.ok) return json(400, { code: checked.code });
  const question = checked.question;

  // Writes the conversation and the notification; never handed anything
  // the caller chose except the question text itself.
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: askedToday, error: countError } = await admin
    .from("clucky_messages").select("id", { count: "exact", head: true })
    .eq("user_email", identity).eq("role", "user").gte("created_at", since);
  if (countError) return json(500, { code: "failed" });
  if ((askedToday || 0) >= DAILY_LIMIT) return json(429, { code: "daily_limit", limit: DAILY_LIMIT });

  const today = new Date().toISOString().slice(0, 10);
  const [historyResult, profileResult, batchResult, vaccineResult] = await Promise.all([
    admin.from("clucky_messages").select("role, content")
      .eq("user_email", identity).order("created_at", { ascending: false }).limit(HISTORY_MESSAGES),
    asUser.from("farmer_profiles").select("full_name, county").eq("user_email", identity).maybeSingle(),
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

  const farmContext = buildFarmContext({
    name: profileResult.data?.full_name,
    county: profileResult.data?.county,
    role: user.user_metadata?.role,
    batches: (batchResult.data || []) as Batch[],
    overdueVaccines
  });

  const { data: saved, error: saveError } = await admin
    .from("clucky_messages").insert({ user_email: identity, role: "user", content: question }).select("id").single();
  if (saveError) return json(500, { code: "failed" });

  const anthropic = new Anthropic({ apiKey });
  const options = modelOptions(MODEL);
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      // stable instructions first, the person's own records after
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: farmContext }
    ],
    messages: toModelMessages(history, question),
    // A short chat answer doesn't need deep deliberation; low effort keeps
    // replies quick and cheap on a phone.
    ...(options.effort ? { output_config: { effort: "low" as const } } : {}),
    // Questions about Newcastle disease or bird flu are ordinary here, but
    // can look alarming to a safety filter. If the first model declines,
    // the API retries on the fallback it recommends instead of failing.
    ...(options.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {})
  });

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
      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "fallback") {
          send({ t: "reset" });
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ t: "delta", text: event.delta.text });
        }
      }

      const final = await stream.finalMessage();

      // The answer is the text written after the last hand-over, if any.
      let answer = "";
      for (const block of final.content) {
        if (block.type === "fallback") answer = "";
        else if (block.type === "text") answer += block.text;
      }
      answer = answer.trim();

      if (final.stop_reason === "refusal" || !answer) {
        // Nothing useful came back: don't count the question against today's limit.
        await admin.from("clucky_messages").delete().eq("id", saved.id);
        send({ t: "error", code: "declined" });
        return;
      }

      await admin.from("clucky_messages").insert({ user_email: identity, role: "assistant", content: answer });

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

      send({ t: "done", truncated: final.stop_reason === "max_tokens" });
    } catch (error) {
      console.error("clucky: model call failed —", error instanceof Error ? error.message : error);
      await admin.from("clucky_messages").delete().eq("id", saved.id);
      send({ t: "error", code: failureCode(error) });
    } finally {
      try { controller.close(); } catch { /* the client already went away */ }
    }
  })();

  EdgeRuntime.waitUntil(work);

  return new Response(body, {
    headers: {
      ...CORS,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
});
