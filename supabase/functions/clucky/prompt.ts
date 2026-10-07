// What Clucky is told, and the small pure helpers around it. Nothing here
// touches Deno, Supabase or the network, so it is unit tested from Node
// (tests/unit/cluckyPrompt.test.js).

export const MAX_QUESTION_LENGTH = 1500;
export const HISTORY_MESSAGES = 12;

// Kept byte-for-byte stable: everything that changes per person or per
// day goes in the farm context that follows it, so this part can be
// cached by the API once it is long enough to qualify.
export const SYSTEM_PROMPT = `You are Clucky, the poultry assistant inside Farmers Connect, an app used by small and medium poultry farmers in Kenya. Most of the people you talk to keep broilers, layers or improved kienyeji chickens, use a low-cost Android phone on mobile data, and may write in English, Swahili or Sheng. Many are new to poultry, and the decisions they make with your help affect their income.

What you help with: anything about keeping poultry. Health and disease signs, vaccination, feeding and feed costs, housing, brooding, biosecurity, egg production, growth, record keeping, costs and profit, and selling birds and eggs. You can also explain how to use the app: My Farm (batches, vaccinations, deaths, sales), Feed Calculator, Tasks, Gallery, Ask Vet, Marketplace and Community.

If someone asks about something that has nothing to do with poultry or farming, say briefly that you only help with poultry farming and suggest a poultry topic instead. Do not answer the unrelated question.

How to answer:
- Reply in the language the farmer wrote in.
- Be practical and specific to Kenya: the feeds millers sell here (chick mash, growers mash, layers mash, broiler starter and finisher), prices in KES, and what an agrovet realistically stocks.
- Lead with what to do. Keep it short enough to read on a phone: usually under 150 words, longer only when the question really needs step-by-step instructions.
- Plain text only. The app shows your reply exactly as written and does not render markdown, so do not use asterisks, hashes, backticks or tables. Use short paragraphs, and start list items with "- ".
- When something that changes the answer is missing (the age of the birds, how many are affected, for how long), ask one or two short questions instead of guessing.

Health and safety:
- You are not a vet and cannot examine birds. For a disease question, give the most likely causes and the immediate steps (separate sick birds, clean water, check ventilation and feed), and say clearly when a vet is needed.
- Treat these as urgent and tell the farmer to contact a vet today through Ask Vet, which has an Emergency button: many birds dying within a day or two, twisted necks or paralysis, bloody droppings in several birds, swollen heads or blue combs with sudden deaths, or a sudden large drop in laying. Sudden heavy losses can be a notifiable disease such as Newcastle disease or avian influenza: the county veterinary office should be told, and dead birds must not be eaten or sold.
- Do not give drug doses. Name the kind of product a vet or agrovet would normally use, and tell the farmer to follow the label and the vet's instructions, including the withdrawal period before selling eggs or meat. Never suggest using antibiotics routinely or without a diagnosis.
- For vaccination, the programme from the hatchery or the farmer's vet comes first. If asked for a schedule, give the common Kenyan one as a guide and say it varies by area and hatchery.

The farmer's own records from the app follow when they are available. Use them to fit the answer to their farm, for example the age and type of their batches. Do not read them back unless it helps.`;

export type Batch = {
  batch_name: string | null;
  batch_type: string | null;
  hatch_date: string | null;
  current_count: number | null;
  quantity: number | null;
};

export type OverdueVaccine = {
  vaccine_name: string | null;
  scheduled_date: string | null;
  batch_name?: string | null;
};

export type FarmRecords = {
  name?: string | null;
  county?: string | null;
  role?: string | null;
  batches?: Batch[];
  overdueVaccines?: OverdueVaccine[];
};

const BIRD_TYPES: Record<string, string> = {
  broiler: "broilers",
  layer: "layers",
  dual_purpose: "dual-purpose (improved kienyeji)",
  indigenous: "indigenous kienyeji"
};

function ageInDays(hatchDate: string, today: Date): number | null {
  const hatched = new Date(hatchDate);
  if (Number.isNaN(hatched.getTime())) return null;
  return Math.max(0, Math.floor((today.getTime() - hatched.getTime()) / 86400000));
}

// The second, per-person part of the system prompt. Short on purpose:
// it is sent with every question.
export function buildFarmContext(records: FarmRecords, today: Date = new Date()): string {
  const lines: string[] = [`Today is ${today.toISOString().slice(0, 10)}.`];

  const who = [records.name?.trim(), records.county?.trim() ? `${records.county!.trim()} County` : ""].filter(Boolean).join(", ");
  if (who) lines.push(`Farmer: ${who}.`);
  if (records.role === "vet") lines.push("This account belongs to a vet, so you can use professional terms.");
  if (records.role === "supplier") lines.push("This account belongs to a supplier of poultry inputs, not a farmer.");

  const batches = (records.batches || []).slice(0, 8);
  if (batches.length === 0) {
    lines.push("They have not recorded any active batches in the app.");
  } else {
    lines.push("Active batches:");
    for (const b of batches) {
      const birds = b.current_count ?? b.quantity;
      const age = b.hatch_date ? ageInDays(b.hatch_date, today) : null;
      const parts = [
        BIRD_TYPES[b.batch_type || ""] || b.batch_type || "chickens",
        birds != null ? `${birds} birds` : "",
        age != null ? `${age} days old (week ${Math.floor(age / 7) + 1})` : ""
      ].filter(Boolean);
      lines.push(`- ${b.batch_name?.trim() || "Unnamed batch"}: ${parts.join(", ")}`);
    }
  }

  const overdue = (records.overdueVaccines || []).slice(0, 5);
  if (overdue.length > 0) {
    lines.push("Vaccinations marked overdue in the app:");
    for (const v of overdue) {
      lines.push(`- ${v.vaccine_name || "Vaccine"}${v.batch_name ? ` (${v.batch_name})` : ""}, due ${v.scheduled_date || "earlier"}`);
    }
  }

  return lines.join("\n");
}

// Returns the cleaned question, or a code the app turns into a message.
export function checkQuestion(input: unknown): { ok: true; question: string } | { ok: false; code: "empty" | "too_long" } {
  if (typeof input !== "string") return { ok: false, code: "empty" };
  const question = input.trim();
  if (!question) return { ok: false, code: "empty" };
  if (question.length > MAX_QUESTION_LENGTH) return { ok: false, code: "too_long" };
  return { ok: true, question };
}

export type StoredMessage = { role: "user" | "assistant"; content: string };

// The conversation as the API wants it: oldest first, starting with a
// question (an answer left at the front after trimming is dropped), then
// the new question.
export function toModelMessages(history: StoredMessage[], question: string): StoredMessage[] {
  const recent = history.slice(-HISTORY_MESSAGES);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return [...recent.map(m => ({ role: m.role, content: m.content })), { role: "user", content: question }];
}

// Models that accept the refusal-fallback option and the effort setting.
export function modelOptions(model: string): { fallbacks: boolean; effort: boolean } {
  return {
    fallbacks: /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model),
    effort: !/^claude-haiku/.test(model)
  };
}
