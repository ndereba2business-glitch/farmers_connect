export default function VetPlaceholderPage({ title, description }) {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#111827" }}>
        {title}
      </h1>
      <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: "14px" }}>
        {description}
      </p>
      <div style={{
        marginTop: "24px", padding: "60px 20px", textAlign: "center",
        background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
      }}>
        <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
          This section is coming in a future update.
        </p>
      </div>
    </div>
  );
}