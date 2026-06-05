export default function CluckyInsights({
  batches
}) {
  if (!batches.length) return null;

  const totalMortality = batches.reduce(
    (sum, b) => sum + b.mortality,
    0
  );

  const totalInitial = batches.reduce(
    (sum, b) => sum + b.initial_count,
    0
  );

  const mortalityRate =
    (totalMortality / totalInitial) * 100;

  let advice = "";

  if (mortalityRate > 15) {
    advice =
      "⚠ High mortality detected. Review hygiene, vaccination, and feed quality immediately.";
  } else if (mortalityRate > 5) {
    advice =
      "⚠ Moderate mortality observed. Monitor disease symptoms closely.";
  } else {
    advice =
      "✅ Farm performance looks healthy. Maintain current management practices.";
  }

  return (
    <div
      style={{
        padding: "15px",
        border: "1px solid green",
        marginBottom: "20px",
        borderRadius: "10px",
        background: "#f0fff4"
      }}
    >
      <h2>Clucky AI Insights 🧠</h2>

      <p>{advice}</p>

      <p>
        Current mortality rate:{" "}
        {mortalityRate.toFixed(1)}%
      </p>
    </div>
  );
}