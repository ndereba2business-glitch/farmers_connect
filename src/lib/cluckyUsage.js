// Turns the rows from clucky_usage_summary() (one per day, newest first)
// into the figures and the advice on the admin dashboard's Clucky tab.
// No imports, so it is unit tested on its own.

// What the same use would cost on the paid plan, in US dollars per million
// tokens. These are Google's published prices for gemini-3.5-flash-lite in
// October 2026: update them here if the model or the prices change.
export const PAID_PRICE_PER_MILLION = { input: 0.30, output: 2.50 };

const number = (value) => Number(value) || 0;

export function paidCostUsd(inputTokens, outputTokens) {
  return (number(inputTokens) * PAID_PRICE_PER_MILLION.input + number(outputTokens) * PAID_PRICE_PER_MILLION.output) / 1_000_000;
}

export function summarise(rows) {
  const days = (rows || []).map(r => ({
    day: r.day,
    questions: number(r.questions),
    people: number(r.people),
    inputTokens: number(r.input_tokens),
    outputTokens: number(r.output_tokens),
    quotaHits: number(r.quota_hits),
    failures: number(r.failures)
  }));
  const sum = (key) => days.reduce((total, d) => total + d[key], 0);
  const questions = sum("questions");
  const inputTokens = sum("inputTokens");
  const outputTokens = sum("outputTokens");

  return {
    days,
    today: days[0] || { day: null, questions: 0, people: 0, inputTokens: 0, outputTokens: 0, quotaHits: 0, failures: 0 },
    questions,
    busiestDay: days.reduce((best, d) => (d.questions > (best?.questions ?? 0) ? d : best), null),
    // days on which farmers were turned away because the allowance ran out
    daysRanOut: days.filter(d => d.quotaHits > 0).length,
    timesTurnedAway: sum("quotaHits"),
    failures: sum("failures"),
    inputTokens,
    outputTokens,
    paidCostUsd: paidCostUsd(inputTokens, outputTokens),
    costPerQuestionUsd: questions ? paidCostUsd(inputTokens, outputTokens) / questions : 0
  };
}

// One plain sentence on whether the free plan is still enough.
//   tone: "ok" | "watch" | "act"
export function advice(summary) {
  const span = summary.days.length;
  if (summary.questions === 0 && summary.timesTurnedAway === 0) {
    return { tone: "ok", text: `Nobody has asked Clucky anything in the last ${span} days, so there is nothing to decide yet.` };
  }
  if (summary.daysRanOut === 0) {
    return { tone: "ok", text: `The free plan was enough on every one of the last ${span} days. Nobody was turned away.` };
  }
  const dayWord = summary.daysRanOut === 1 ? "day" : "days";
  if (summary.daysRanOut >= 3 || summary.daysRanOut * 4 >= span) {
    return {
      tone: "act",
      text: `The free plan ran out on ${summary.daysRanOut} of the last ${span} days, and farmers were turned away ${summary.timesTurnedAway} times. It is time to move to the paid plan.`
    };
  }
  return {
    tone: "watch",
    text: `The free plan ran out on ${summary.daysRanOut} ${dayWord} in the last ${span}. Keep watching: if it becomes regular, move to the paid plan.`
  };
}

// The cost of one question is a fraction of a cent, so it gets a third
// decimal place: "$0.002".
export function usdSmall(amount) {
  if (amount >= 0.01 || amount === 0) return `$${amount.toFixed(2)}`;
  return amount < 0.001 ? "less than $0.001" : `$${amount.toFixed(3)}`;
}

// "$0.42", or "less than $0.01" so a tiny cost is not shown as free.
export function usd(amount) {
  if (amount > 0 && amount < 0.01) return "less than $0.01";
  return `$${amount.toFixed(2)}`;
}

export function shortDay(day) {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(day) : date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
