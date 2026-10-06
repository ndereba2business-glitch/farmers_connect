import { useEffect, useState } from "react";
import { Calculator, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BIRD_TYPES, birdTypeForBatch, buildFeedPlan, planProblem } from "../lib/feedPlan";
import "./FeedCalculator.css";

const PRICES_KEY = "fc_feed_prices";
const WEEKS_SHOWN = 8;

const TARGET_HINTS = {
  broiler: "Broilers are usually sold at 35-42 days.",
  layer: "Pullets start laying at about 126 days (18 weeks). A laying cycle runs to about 560 days.",
  kienyeji: "Improved kienyeji reach market weight at about 120-150 days."
};

const kg = (n) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
const kes = (n) => `KES ${Math.round(n).toLocaleString()}`;

// Bag prices are remembered on this phone only, as a convenience.
function loadPrices() {
  try { return JSON.parse(localStorage.getItem(PRICES_KEY) || "{}") || {}; } catch { return {}; }
}
function savePrices(prices) {
  try { localStorage.setItem(PRICES_KEY, JSON.stringify(prices)); } catch { /* storage unavailable */ }
}

// One row per week of age, which is how the amounts change.
function weeklyRows(days) {
  const rows = [];
  for (const d of days) {
    const week = Math.floor((d.day - 1) / 7) + 1;
    const last = rows[rows.length - 1];
    if (last && last.week === week) {
      last.to = d.day;
      last.kg += d.kg;
    } else {
      rows.push({ week, from: d.day, to: d.day, phase: d.phase, gPerBird: d.gPerBird, kgPerDay: d.kg, kg: d.kg });
    }
  }
  return rows;
}

export default function FeedCalculator() {
  const { userEmail } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState("new");
  const [batches, setBatches] = useState([]);
  const [saved, setSaved] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("manual");
  const [form, setForm] = useState({ type: "broiler", birds: "100", currentAge: "0", targetAge: "42", wastagePct: "5" });
  const [prices, setPrices] = useState(loadPrices);
  const [plan, setPlan] = useState(null);
  const [problem, setProblem] = useState("");
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  useEffect(() => {
    if (!userEmail) return undefined;
    let cancelled = false;

    async function load() {
      const [batchResult, savedResult] = await Promise.all([
        supabase.from("farm_batches")
          .select("id, batch_name, batch_type, hatch_date, current_count, quantity")
          .eq("user_email", userEmail).eq("status", "active"),
        supabase.from("feed_calculations")
          .select("id, batch_id, batch_name, chicken_type, num_birds, current_age, target_age, total_kg, bags_50, created_at")
          .eq("user_email", userEmail).order("created_at", { ascending: false }).limit(10)
      ]);
      if (cancelled) return;
      // The calculator works without either list, so a failed load only
      // means "enter the numbers yourself".
      if (batchResult.error) console.error("FeedCalculator: loading batches failed —", batchResult.error.message);
      if (savedResult.error) console.error("FeedCalculator: loading saved plans failed —", savedResult.error.message);
      setBatches(batchResult.data || []);
      setSaved(savedResult.data || []);
    }

    load();
    return () => { cancelled = true; };
  }, [userEmail]);

  const profile = BIRD_TYPES[form.type];

  function update(changes) {
    setForm(current => ({ ...current, ...changes }));
    setProblem("");
  }

  function chooseType(type) {
    update({ type, targetAge: String(BIRD_TYPES[type].defaultTarget) });
  }

  function chooseBatch(batchId) {
    setSelectedBatch(batchId);
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    const type = birdTypeForBatch(batch.batch_type);
    const age = Math.max(0, Math.floor((Date.now() - new Date(batch.hatch_date).getTime()) / 86400000));
    const { defaultTarget, maxAge } = BIRD_TYPES[type];
    update({
      type,
      birds: String(batch.current_count || batch.quantity || ""),
      currentAge: String(Math.min(age, maxAge)),
      // an older batch is planned one more week ahead rather than backwards
      targetAge: String(age < defaultTarget ? defaultTarget : Math.min(age + 7, maxAge))
    });
  }

  function setPrice(phaseName, value) {
    const next = { ...prices, [phaseName]: value };
    setPrices(next);
    savePrices(next);
  }

  function inputsFrom(source) {
    return {
      type: source.type,
      birds: Number(source.birds),
      currentAge: Number(source.currentAge),
      targetAge: Number(source.targetAge),
      wastagePct: Number(source.wastagePct),
      prices
    };
  }

  async function calculate() {
    const inputs = inputsFrom(form);
    const issue = planProblem(inputs);
    if (issue) {
      setProblem(issue);
      setPlan(null);
      return;
    }

    const result = buildFeedPlan(inputs);
    setPlan(result);
    setShowAllWeeks(false);

    const batch = batches.find(b => b.id === selectedBatch);
    const { data, error } = await supabase.from("feed_calculations").insert([{
      user_email: userEmail,
      batch_id: batch ? batch.id : null,
      batch_name: batch?.batch_name || "Manual entry",
      chicken_type: result.type,
      num_birds: result.birds,
      current_age: result.currentAge,
      target_age: result.targetAge,
      total_kg: result.totalKg,
      bags_50: result.bags50,
      bags_70: result.bags70
    }]).select("id, batch_id, batch_name, chicken_type, num_birds, current_age, target_age, total_kg, bags_50, created_at");

    // The plan is already on screen; only the saved copy is affected.
    if (error) toast.error("Your plan is shown below, but it couldn't be saved to your list. Check your connection.");
    else if (data?.[0]) setSaved(current => [data[0], ...current].slice(0, 10));
  }

  function openSaved(calc) {
    const type = BIRD_TYPES[calc.chicken_type] ? calc.chicken_type : "broiler";
    const next = {
      type,
      birds: String(calc.num_birds),
      currentAge: String(calc.current_age),
      targetAge: String(Math.min(calc.target_age, BIRD_TYPES[type].maxAge)),
      wastagePct: form.wastagePct
    };
    setForm(next);
    setSelectedBatch(batches.some(b => b.id === calc.batch_id) ? calc.batch_id : "manual");
    setProblem("");
    // Recalculated with today's tables, so an old saved plan shows the
    // corrected amounts rather than the totals stored at the time.
    setPlan(buildFeedPlan(inputsFrom(next)));
    setShowAllWeeks(false);
    setTab("new");
  }

  async function deleteSaved(id) {
    const { error } = await supabase.from("feed_calculations").delete().eq("id", id);
    if (error) {
      toast.error("That plan couldn't be deleted. Check your connection and try again.");
      return;
    }
    setSaved(current => current.filter(c => c.id !== id));
  }

  const weeks = plan ? weeklyRows(plan.days) : [];
  const visibleWeeks = showAllWeeks ? weeks : weeks.slice(0, WEEKS_SHOWN);

  return (
    <div className="fd-page">
      <div className="fd-head">
        <Calculator size={26} color="#22c55e" aria-hidden="true" />
        <h1>Feed Calculator</h1>
      </div>
      <p className="fd-lead">Work out how much feed to give each day and how much to buy.</p>

      <div className="fd-tabs">
        <button className={`fd-tab${tab === "new" ? " fd-tab--active" : ""}`} aria-pressed={tab === "new"} onClick={() => setTab("new")}>
          New plan
        </button>
        <button className={`fd-tab${tab === "saved" ? " fd-tab--active" : ""}`} aria-pressed={tab === "saved"} onClick={() => setTab("saved")}>
          Saved ({saved.length})
        </button>
      </div>

      {tab === "saved" && (
        saved.length === 0 ? (
          <div className="fd-empty">No saved plans yet. Each plan you calculate is kept here.</div>
        ) : (
          saved.map(calc => (
            <div key={calc.id} className="fd-saved">
              <div style={{ minWidth: 0 }}>
                <p className="fd-saved-title">{calc.batch_name}</p>
                <p className="fd-saved-meta">
                  {calc.num_birds} {(BIRD_TYPES[calc.chicken_type] || BIRD_TYPES.broiler).label.toLowerCase()} birds · day {calc.current_age} to {calc.target_age}
                </p>
                <p className="fd-saved-meta">{new Date(calc.created_at).toLocaleDateString()}</p>
              </div>
              <div className="fd-saved-actions">
                <button className="fd-load" onClick={() => openSaved(calc)}>Open</button>
                <button className="fd-delete" onClick={() => deleteSaved(calc.id)} aria-label={`Delete saved plan for ${calc.batch_name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )
      )}

      {tab === "new" && (
        <>
          <div className="fd-card">
            <h2>Your birds</h2>
            <p className="fd-sub">Pick one of your batches, or enter the numbers yourself.</p>

            <div className="fd-grid">
              <div className="fd-field">
                <label htmlFor="fd-batch">Batch</label>
                <select id="fd-batch" value={selectedBatch} onChange={e => chooseBatch(e.target.value)}>
                  <option value="manual">Enter manually</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                </select>
              </div>
              <div className="fd-field">
                <label htmlFor="fd-type">Type of bird</label>
                <select id="fd-type" value={form.type} onChange={e => chooseType(e.target.value)}>
                  {Object.entries(BIRD_TYPES).map(([value, t]) => <option key={value} value={value}>{t.label}</option>)}
                </select>
              </div>
              <div className="fd-field">
                <label htmlFor="fd-birds">Number of birds</label>
                <input id="fd-birds" type="number" inputMode="numeric" min="1" value={form.birds} onChange={e => update({ birds: e.target.value })} />
              </div>
              <div className="fd-field">
                <label htmlFor="fd-margin">Safety margin</label>
                <select id="fd-margin" value={form.wastagePct} onChange={e => update({ wastagePct: e.target.value })}>
                  <option value="0">None</option>
                  <option value="5">5% (recommended)</option>
                  <option value="10">10%</option>
                </select>
                <p className="fd-hint">Extra feed for spillage and for birds that eat more than average.</p>
              </div>
              <div className="fd-field">
                <label htmlFor="fd-age">Age today (days)</label>
                <input id="fd-age" type="number" inputMode="numeric" min="0" max={profile.maxAge} value={form.currentAge} onChange={e => update({ currentAge: e.target.value })} />
              </div>
              <div className="fd-field">
                <label htmlFor="fd-target">Plan up to (days)</label>
                <input id="fd-target" type="number" inputMode="numeric" min="1" max={profile.maxAge} value={form.targetAge} onChange={e => update({ targetAge: e.target.value })} />
                <p className="fd-hint">{TARGET_HINTS[form.type]}</p>
              </div>
            </div>

            <details className="fd-prices">
              <summary>Add feed prices to see the cost (optional)</summary>
              <div className="fd-grid" style={{ marginBottom: 0 }}>
                {profile.phases.map(phase => (
                  <div key={phase.name} className="fd-field">
                    <label htmlFor={`fd-price-${phase.name}`}>{phase.name} feed: price of a 50 kg bag (KES)</label>
                    <input
                      id={`fd-price-${phase.name}`}
                      type="number" inputMode="numeric" min="0"
                      placeholder="e.g. 3800"
                      value={prices[phase.name] || ""}
                      onChange={e => setPrice(phase.name, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </details>

            {problem && <div className="fd-error" role="alert">{problem}</div>}

            <button className="fd-primary" onClick={calculate}>Calculate feed</button>
          </div>

          {plan && (
            <>
              <div className="fd-card">
                <h2>Today (day {plan.today.day})</h2>
                <p className="fd-sub">{plan.today.phase.feed} · {plan.today.phase.protein}</p>
                <div className="fd-stats fd-stats--4">
                  <div className="fd-stat">
                    <div className="fd-stat-value">{plan.today.gPerBird} g</div>
                    <div className="fd-stat-label">per bird today</div>
                  </div>
                  <div className="fd-stat">
                    <div className="fd-stat-value">{kg(plan.today.kg)}</div>
                    <div className="fd-stat-label">for all {plan.birds.toLocaleString()} birds</div>
                  </div>
                  <div className="fd-stat">
                    <div className="fd-stat-value fd-stat-value--plain">{plan.today.feeds}×</div>
                    <div className="fd-stat-label">feedings, {kg(plan.today.perFeedKg)} each</div>
                  </div>
                  <div className="fd-stat">
                    <div className="fd-stat-value fd-stat-value--plain">{Math.round(plan.today.waterLitres).toLocaleString()} L</div>
                    <div className="fd-stat-label">clean water, more in heat</div>
                  </div>
                </div>
              </div>

              <div className="fd-card">
                <h2>Feed to buy</h2>
                <p className="fd-sub">
                  Day {plan.today.day} to day {plan.targetAge}
                  {plan.wastagePct > 0 ? `, including the ${plan.wastagePct}% safety margin` : ""}
                </p>
                <div className="fd-stats fd-stats--3">
                  <div className="fd-stat">
                    <div className="fd-stat-value">{kg(plan.totalKg)}</div>
                    <div className="fd-stat-label">total feed</div>
                  </div>
                  <div className="fd-stat">
                    <div className="fd-stat-value fd-stat-value--amber">{plan.bags50}</div>
                    <div className="fd-stat-label">bags of 50 kg</div>
                  </div>
                  <div className="fd-stat">
                    <div className="fd-stat-value fd-stat-value--plain">{plan.perBirdKg} kg</div>
                    <div className="fd-stat-label">eaten per bird</div>
                  </div>
                  {plan.cost && (
                    <>
                      <div className="fd-stat">
                        <div className="fd-stat-value fd-stat-value--amber">{kes(plan.cost.total)}</div>
                        <div className="fd-stat-label">feed cost{plan.cost.complete ? "" : " so far"}</div>
                      </div>
                      <div className="fd-stat">
                        <div className="fd-stat-value fd-stat-value--plain">{kes(plan.cost.perBird)}</div>
                        <div className="fd-stat-label">feed cost per bird</div>
                      </div>
                    </>
                  )}
                  {plan.weightAtTarget && (
                    <div className="fd-stat">
                      <div className="fd-stat-value fd-stat-value--plain">{plan.weightAtTarget} kg</div>
                      <div className="fd-stat-label">target weight at day {plan.targetAge}</div>
                    </div>
                  )}
                </div>

                {plan.cost && !plan.cost.complete && (
                  <p className="fd-note fd-note--amber">Add a price for every feed above to see the full cost.</p>
                )}
                {plan.weightAtTarget && (
                  <p className="fd-note">
                    The target weight is what the breed reaches with good feed, housing and health.
                    {plan.feedPerKgGain ? ` At that weight each bird has eaten about ${plan.feedPerKgGain} kg of feed for every kg it weighs.` : ""}
                    {" "}If your birds are well below it, check feed quality, water and space before buying more feed.
                  </p>
                )}
              </div>

              <div className="fd-card">
                <h2>By type of feed</h2>
                <p className="fd-sub">Buy each feed separately. Bags are rounded up.</p>
                {plan.phases.map(phase => (
                  <div key={phase.name} className="fd-phase">
                    <div style={{ minWidth: 0 }}>
                      <p className="fd-phase-name">{phase.name}: {phase.feed}</p>
                      <p className="fd-phase-feed">{phase.protein} · {phase.days} day{phase.days === 1 ? "" : "s"}</p>
                    </div>
                    <div className="fd-phase-buy">
                      <strong>{phase.bags50} bag{phase.bags50 === 1 ? "" : "s"}</strong>
                      {kg(phase.buyKg)}
                      {phase.cost !== null && <div>{kes(phase.cost)}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="fd-card">
                <h2>Week by week</h2>
                <p className="fd-sub">The daily amount goes up each week as the birds grow.</p>
                <table className="fd-weeks">
                  <thead>
                    <tr>
                      <th scope="col">Week</th>
                      <th scope="col">Per bird / day</th>
                      <th scope="col">All birds / day</th>
                      <th scope="col">Week total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWeeks.map(row => (
                      <tr key={row.week}>
                        <td>
                          Week {row.week}
                          <small>{row.from === row.to ? `day ${row.from}` : `days ${row.from}-${row.to}`} · {row.phase}</small>
                        </td>
                        <td>{row.gPerBird} g</td>
                        <td>{kg(row.kgPerDay)}</td>
                        <td>{kg(row.kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {weeks.length > WEEKS_SHOWN && (
                  <button className="fd-more" onClick={() => setShowAllWeeks(v => !v)}>
                    {showAllWeeks ? "Show fewer weeks" : `Show all ${weeks.length} weeks`}
                  </button>
                )}
              </div>

              <div className="fd-card">
                <h2>Good practice</h2>
                <ul className="fd-tips">
                  {plan.notes.map(note => <li key={note}>{note}</li>)}
                  <li>Give clean water at all times. Birds that can't drink stop eating.</li>
                  <li>Store feed off the floor in a dry place and use it within a month. Damp or mouldy feed makes birds sick.</li>
                  <li>These amounts are breed targets for healthy birds. If yours eat much less, look for heat, illness or poor feed, and ask a vet.</li>
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
