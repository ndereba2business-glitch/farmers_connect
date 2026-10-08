import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { isGoogleEnabled, startGoogleSignIn } from "../lib/googleSignIn";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// Renders nothing until Supabase confirms Google sign-in is switched on.
// `role` is the role chosen on the sign-up page; leave it out on login.
export default function GoogleButton({ role, label = "Continue with Google" }) {
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    isGoogleEnabled().then(on => { if (!cancelled) setEnabled(on); });
    return () => { cancelled = true; };
  }, []);

  if (!enabled) return null;

  async function handleClick() {
    setError("");
    setStarting(true);
    const problem = await startGoogleSignIn(role);
    // On success the browser leaves for Google, so there is nothing to reset.
    if (problem) {
      setError(problem);
      setStarting(false);
    }
  }

  return (
    <div style={{ marginTop: "16px" }}>
      <div
        aria-hidden="true"
        style={{
          display: "flex", alignItems: "center", gap: "12px",
          color: "#6b7280", fontSize: "13px", marginBottom: "16px"
        }}
      >
        <span style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
        or
        <span style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={starting}
        style={{
          width: "100%", minHeight: "48px", padding: "12px 14px",
          borderRadius: "10px", border: "1px solid #d1d5db",
          background: "#fff", color: "#1f2937",
          fontWeight: "600", fontSize: "15px",
          cursor: starting ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px"
        }}
      >
        <GoogleLogo />
        {starting ? "Opening Google..." : label}
      </button>

      {role && (
        <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280", textAlign: "center" }}>
          You'll join as a <strong>{role}</strong>. Change it above if that's wrong.
        </p>
      )}

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2", color: "#dc2626", padding: "12px",
            borderRadius: "10px", marginTop: "12px", fontSize: "14px"
          }}
        >
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </div>
      )}
    </div>
  );
}
