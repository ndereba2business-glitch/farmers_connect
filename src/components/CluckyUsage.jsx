import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { advice, paidCostUsd, shortDay, summarise, usd, usdSmall } from "../lib/cluckyUsage";
import "./CluckyUsage.css";

const DAYS = 14;
const TONE_ICON = { ok: CheckCircle2, watch: Eye, act: AlertTriangle };

// The admin dashboard's Clucky tab: how much Clucky is being used, whether
// the AI service's free allowance is holding, and what the same use would
// cost on the paid plan. Counts only, from clucky_usage_summary(), which
// the database gives to admins alone. No questions or answers are shown.
export default function CluckyUsage() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error: loadFailure } = await supabase.rpc("clucky_usage_summary", { p_days: DAYS });
      if (cancelled) return;
      setLoading(false);
      if (loadFailure) {
        console.error("CluckyUsage: loading failed —", loadFailure.message);
        setError(true);
        return;
      }
      setError(false);
      setRows(data || []);
    }
    load();
    return () => { cancelled = true; };
  }, [attempt]);

  if (loading) return <p className="cu-status">Loading Clucky usage...</p>;

  if (error) {
    return (
      <div className="cu-status" role="alert">
        We couldn't load Clucky's usage. Check your connection and try again.
        <button type="button" className="fc-btn fc-btn--secondary" onClick={() => { setLoading(true); setAttempt(n => n + 1); }}>
          Try again
        </button>
      </div>
    );
  }

  const summary = summarise(rows);
  const verdict = advice(summary);
  const ToneIcon = TONE_ICON[verdict.tone];

  return (
    <div className="cu-root">
      <div className={`cu-verdict cu-verdict--${verdict.tone}`} role="status">
        <ToneIcon size={20} aria-hidden="true" />
        <p>{verdict.text}</p>
      </div>

      <div className="fc-stats">
        <div className="fc-stat fc-stat--static">
          <span className="fc-stat-label">Questions today</span>
          <span className="fc-stat-value">{summary.today.questions.toLocaleString()}</span>
          <span className="fc-stat-note">{summary.today.people} {summary.today.people === 1 ? "person" : "people"}</span>
        </div>
        <div className="fc-stat fc-stat--static">
          <span className="fc-stat-label">Last {DAYS} days</span>
          <span className="fc-stat-value">{summary.questions.toLocaleString()}</span>
          <span className="fc-stat-note">
            {summary.busiestDay ? `busiest: ${summary.busiestDay.questions.toLocaleString()} on ${shortDay(summary.busiestDay.day)}` : "no questions yet"}
          </span>
        </div>
        <div className={`fc-stat fc-stat--static${summary.daysRanOut ? " fc-stat--warn" : ""}`}>
          <span className="fc-stat-label">Days the free plan ran out</span>
          <span className="fc-stat-value">{summary.daysRanOut}</span>
          <span className="fc-stat-note">{summary.timesTurnedAway.toLocaleString()} times a farmer was turned away</span>
        </div>
        <div className="fc-stat fc-stat--static">
          <span className="fc-stat-label">Same use on the paid plan</span>
          <span className="fc-stat-value">{usd(summary.paidCostUsd)}</span>
          <span className="fc-stat-note">
            {summary.questions ? `about ${usdSmall(summary.costPerQuestionUsd)} a question` : "nothing to price yet"}
          </span>
        </div>
      </div>

      <div className="fc-card cu-card">
        <h2 className="fc-section-title">Day by day</h2>
        <div className="fc-scroll-x">
          <table className="cu-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Questions</th>
                <th scope="col">Free plan ran out</th>
                <th scope="col">People</th>
                <th scope="col">Other failures</th>
                <th scope="col">Paid-plan cost</th>
              </tr>
            </thead>
            <tbody>
              {summary.days.map(day => (
                <tr key={day.day} className={day.quotaHits ? "cu-row--out" : undefined}>
                  <th scope="row">{shortDay(day.day)}</th>
                  <td>{day.questions.toLocaleString()}</td>
                  <td>{day.quotaHits ? `${day.quotaHits.toLocaleString()} turned away` : "No"}</td>
                  <td>{day.people.toLocaleString()}</td>
                  <td>{day.failures.toLocaleString()}</td>
                  <td>{day.inputTokens + day.outputTokens ? usd(paidCostUsd(day.inputTokens, day.outputTokens)) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="cu-note">
        Clucky is on the AI service's free plan, which every farmer shares. When it runs out for the day, farmers are asked
        to come back later and pointed to Ask Vet. The live allowance and its reset time are shown in Google AI Studio.
        On the free plan Google may use questions to improve its products; on the paid plan it does not. Costs here are an
        estimate from the amount of text sent and received.
      </p>
    </div>
  );
}
