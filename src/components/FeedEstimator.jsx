import { useState } from "react";

export default function FeedEstimator() {
  const [chicks, setChicks] = useState("");
  const [days, setDays] = useState("");
  const [result, setResult] = useState(null);

  function calculateFeed() {
    const numChicks = Number(chicks);
    const ageDays = Number(days);

    // Simple estimation logic
    const feedPerBird =
      ageDays < 14
        ? 0.05
        : ageDays < 30
        ? 0.09
        : 0.12;

    const totalFeed =
      numChicks * feedPerBird;

    const estimatedCost =
      totalFeed * 60;

    setResult({
      totalFeed,
      estimatedCost
    });
  }

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "15px",
        borderRadius: "10px",
        marginBottom: "20px"
      }}
    >
      <h2>Feed Estimator 🌽</h2>

      <input
        type="number"
        placeholder="Number of chicks"
        value={chicks}
        onChange={(e) =>
          setChicks(e.target.value)
        }
      />

      <br />
      <br />

      <input
        type="number"
        placeholder="Age in days"
        value={days}
        onChange={(e) =>
          setDays(e.target.value)
        }
      />

      <br />
      <br />

      <button onClick={calculateFeed}>
        Estimate Feed
      </button>

      {result && (
        <div style={{ marginTop: "15px" }}>
          <p>
            Recommended feed/day:{" "}
            <b>
              {result.totalFeed.toFixed(2)} kg
            </b>
          </p>

          <p>
            Estimated daily cost:{" "}
            <b>
              KES{" "}
              {result.estimatedCost.toFixed(
                0
              )}
            </b>
          </p>
        </div>
      )}
    </div>
  );
}