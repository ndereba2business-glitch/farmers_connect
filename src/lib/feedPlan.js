// Feed planning for the Feed Calculator.
//
// Daily intake rises every week as birds grow, so each bird type has a
// week-by-week table of grams per bird per day rather than one flat
// number per phase. The tables follow the breeders' own management
// guides, rounded:
//   - broilers: fast-growing commercial strains (Ross 308 / Cobb 500
//     class), as-hatched performance objectives
//   - layers: commercial brown-egg strains (ISA Brown / Lohmann Brown
//     class) rearing and laying guides
//   - kienyeji: improved dual-purpose birds (Kuroiler, Rainbow Rooster,
//     KALRO improved) kept fully housed
// These are targets under good management. Real intake moves with feed
// quality, heat and health, which is why the plan adds a safety margin.
//
// Feed names match what Kenyan millers sell: broilers go starter then
// finisher; layers and kienyeji go chick mash, growers mash, layers mash.

const DAYS_PER_WEEK = 7;

export const BIRD_TYPES = {
  broiler: {
    label: "Broiler",
    // grams per bird per day, week 1 onwards
    weeklyIntake: [23, 53, 88, 126, 160, 190, 210, 225],
    // target live weight (kg) at the end of each week
    weeklyWeight: [0.21, 0.52, 0.98, 1.57, 2.24, 2.92, 3.55, 4.1],
    defaultTarget: 42,
    maxAge: 56,
    phases: [
      { name: "Starter", from: 1, to: 21, feed: "Broiler starter crumbs or mash", protein: "21-23% protein", feeds: 4 },
      { name: "Finisher", from: 22, to: 56, feed: "Broiler finisher pellets or mash", protein: "18-20% protein", feeds: 3 }
    ],
    notes: [
      "Broilers should never run out of feed. Top up the feeders through the day rather than giving fixed meals.",
      "Change from starter to finisher over 2-3 days by mixing the two, so the birds keep eating."
    ]
  },
  layer: {
    label: "Layer",
    weeklyIntake: [12, 18, 24, 29, 35, 39, 43, 47, 51, 54, 57, 60, 62, 65, 68, 71, 75, 81, 90, 100, 108, 115],
    defaultTarget: 365,
    maxAge: 560,
    phases: [
      { name: "Chick", from: 1, to: 56, feed: "Chick mash", protein: "18-20% protein", feeds: 4 },
      { name: "Grower", from: 57, to: 126, feed: "Growers mash", protein: "15-17% protein", feeds: 2 },
      { name: "Layer", from: 127, to: 560, feed: "Layers mash", protein: "16-18% protein, 3.5-4% calcium", feeds: 2 }
    ],
    notes: [
      "Move to layers mash when the first eggs appear (around week 18-19), not before: the extra calcium harms young pullets' kidneys.",
      "A hen in lay eats about 110-120 g a day. Much less than that usually means heat, illness or poor feed."
    ]
  },
  kienyeji: {
    label: "Kienyeji / dual purpose",
    weeklyIntake: [12, 20, 28, 36, 44, 52, 58, 64, 70, 75, 80, 85, 90, 94, 98, 102, 106, 110, 114, 118, 125],
    defaultTarget: 140,
    maxAge: 365,
    phases: [
      { name: "Chick", from: 1, to: 56, feed: "Chick mash", protein: "18-20% protein", feeds: 4 },
      { name: "Grower", from: 57, to: 140, feed: "Growers mash", protein: "15-17% protein", feeds: 2 },
      { name: "Adult", from: 141, to: 365, feed: "Layers mash for hens in lay (growers mash for cocks)", protein: "16-18% protein", feeds: 2 }
    ],
    notes: [
      "These amounts are for birds kept housed and fed fully. Birds that free-range find part of their own feed and will eat less of what you buy.",
      "Improved kienyeji reach market weight at about 4-5 months, much later than broilers. Budget feed for the whole period."
    ]
  }
};

// The batch types offered on My Farm, mapped to a feeding profile.
export function birdTypeForBatch(batchType) {
  if (batchType === "layer") return "layer";
  if (batchType === "dual_purpose" || batchType === "indigenous" || batchType === "kienyeji") return "kienyeji";
  return "broiler";
}

function profileOf(type) {
  return BIRD_TYPES[type] || BIRD_TYPES.broiler;
}

// Grams one bird eats on a given day of age (day 1 = the first day).
// Past the end of the table, birds are adult and intake stays level.
export function dailyIntake(type, day) {
  const table = profileOf(type).weeklyIntake;
  const week = Math.floor((Math.max(1, day) - 1) / DAYS_PER_WEEK);
  return table[Math.min(week, table.length - 1)];
}

export function phaseOn(type, day) {
  const phases = profileOf(type).phases;
  return phases.find(p => day >= p.from && day <= p.to) || phases[phases.length - 1];
}

// Breeder target live weight (kg) at a given age, where a table exists.
export function targetWeight(type, day) {
  const table = profileOf(type).weeklyWeight;
  if (!table || day < DAYS_PER_WEEK) return null;
  const week = Math.min(Math.floor(day / DAYS_PER_WEEK), table.length);
  const atWeek = table[week - 1];
  const next = table[week];
  if (next === undefined) return atWeek;
  // between two weekly weights, grow evenly day by day
  return atWeek + (next - atWeek) * ((day % DAYS_PER_WEEK) / DAYS_PER_WEEK);
}

const round1 = (n) => Math.round(n * 10) / 10;

// Checks the form before planning. Returns a message, or null when fine.
export function planProblem({ type, birds, currentAge, targetAge }) {
  const profile = profileOf(type);
  if (!Number.isFinite(birds) || birds < 1) return "Enter how many birds you have (at least 1).";
  if (!Number.isInteger(birds)) return "The number of birds must be a whole number.";
  if (!Number.isFinite(currentAge) || currentAge < 0) return "Current age can't be less than 0 days.";
  if (!Number.isFinite(targetAge) || targetAge < 1) return "Enter the age you want to plan up to.";
  if (targetAge > profile.maxAge) return `This calculator plans ${profile.label.toLowerCase()} birds up to ${profile.maxAge} days.`;
  if (currentAge > targetAge) return "The target age must be later than the current age.";
  return null;
}

// Builds the whole plan: today's amounts, the feed to buy for each
// phase, the day-by-day table and, when prices are given, the cost.
//   wastagePct: extra allowed for spillage, spoilage and birds that
//               eat more than the table (5 is a sensible default)
//   prices:     { [phase name]: KES per 50 kg bag }, any may be missing
export function buildFeedPlan({ type, birds, currentAge, targetAge, wastagePct = 5, prices = {} }) {
  const profile = profileOf(type);
  const startDay = Math.max(1, currentAge);
  const margin = 1 + Math.max(0, wastagePct) / 100;

  const days = [];
  const byPhase = new Map();
  for (let day = startDay; day <= targetAge; day++) {
    const phase = phaseOn(type, day);
    const gPerBird = dailyIntake(type, day);
    const kg = (gPerBird * birds) / 1000;
    days.push({ day, phase: phase.name, feed: phase.feed, gPerBird, kg, feeds: phase.feeds, perFeedKg: kg / phase.feeds });
    const entry = byPhase.get(phase.name) || { ...phase, days: 0, eatenKg: 0 };
    entry.days += 1;
    entry.eatenKg += kg;
    byPhase.set(phase.name, entry);
  }

  let totalCost = 0;
  let allPriced = true;
  const phases = [...byPhase.values()].map(p => {
    const buyKg = p.eatenKg * margin;
    const bags50 = Math.ceil(buyKg / 50);
    const price = Number(prices[p.name]);
    const cost = price > 0 ? bags50 * price : null;
    if (cost === null) allPriced = false; else totalCost += cost;
    return { name: p.name, feed: p.feed, protein: p.protein, days: p.days, eatenKg: round1(p.eatenKg), buyKg: round1(buyKg), bags50, bags70: Math.ceil(buyKg / 70), cost };
  });

  const eatenKg = days.reduce((sum, d) => sum + d.kg, 0);
  const buyKg = eatenKg * margin;
  const today = days[0];
  const weightAtTarget = targetWeight(type, targetAge);

  return {
    type,
    label: profile.label,
    birds,
    currentAge,
    targetAge,
    wastagePct,
    today: {
      day: startDay,
      phase: phaseOn(type, startDay),
      gPerBird: today.gPerBird,
      kg: today.kg,
      feeds: today.feeds,
      perFeedKg: today.perFeedKg,
      // Birds drink about twice the weight of the feed they eat in mild
      // weather, and noticeably more in heat.
      waterLitres: today.kg * 2
    },
    eatenKg: round1(eatenKg),
    totalKg: round1(buyKg),
    perBirdKg: Math.round((eatenKg / birds) * 100) / 100,
    // Bags are bought per feed type, so the total is the sum of the
    // phases, each rounded up, not the grand total rounded once.
    bags50: phases.reduce((sum, p) => sum + p.bags50, 0),
    bags70: phases.reduce((sum, p) => sum + p.bags70, 0),
    phases,
    days,
    cost: phases.some(p => p.cost !== null) ? { total: totalCost, perBird: totalCost / birds, complete: allPriced } : null,
    weightAtTarget: weightAtTarget === null ? null : Math.round(weightAtTarget * 100) / 100,
    // feed eaten per kg of live weight, from day 1; only meaningful when
    // the plan starts at the beginning
    feedPerKgGain: weightAtTarget && currentAge <= 1 ? Math.round((eatenKg / birds / weightAtTarget) * 100) / 100 : null,
    notes: profile.notes
  };
}
