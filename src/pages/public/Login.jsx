import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let authResult;

      if (method === "email") {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      } else {
        const formattedPhone = phone.startsWith("+")
          ? phone
          : "+254" + phone.replace(/^0/, "");
        authResult = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password
        });
      }

      const { error: authError } = authResult;

      if (authError) {
        setError(authError.message);
        return;
      }

      // ✅ No navigate here — AuthContext detects login
      // and App.jsx routes redirect automatically

    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f0fdf4",
      padding: "20px"
    }}>
      <div style={{
        background: "#fff",
        width: "100%",
        maxWidth: "440px",
        borderRadius: "20px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        padding: "36px 32px"
      }}>
        <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#15803d", margin: "0 0 6px" }}>
          🐔 Farmers Connect
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "28px" }}>
          Login to manage your farm
        </p>

        {/* TOGGLE EMAIL / PHONE */}
        <div style={{
          display: "flex",
          background: "#f3f4f6",
          borderRadius: "10px",
          padding: "4px",
          marginBottom: "20px"
        }}>
          <button
            type="button"
            onClick={() => { setMethod("email"); setError(""); }}
            style={{
              flex: 1, padding: "8px", borderRadius: "8px", border: "none",
              cursor: "pointer", fontWeight: "600", fontSize: "13px",
              background: method === "email" ? "#15803d" : "transparent",
              color: method === "email" ? "#fff" : "#6b7280", transition: "all 0.2s"
            }}
          >
            📧 Email
          </button>
          <button
            type="button"
            onClick={() => { setMethod("phone"); setError(""); }}
            style={{
              flex: 1, padding: "8px", borderRadius: "8px", border: "none",
              cursor: "pointer", fontWeight: "600", fontSize: "13px",
              background: method === "phone" ? "#15803d" : "transparent",
              color: method === "phone" ? "#fff" : "#6b7280", transition: "all 0.2s"
            }}
          >
            📱 Phone
          </button>
        </div>

        <form onSubmit={handleLogin}>
          {method === "email" ? (
            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          ) : (
            <input
              type="tel"
              placeholder="Phone number e.g. 0712345678"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          )}

          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              color: "#dc2626", padding: "10px 14px", borderRadius: "8px",
              fontSize: "13px", marginBottom: "14px"
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#86efac" : "#15803d",
              color: "#fff", border: "none", borderRadius: "12px",
              fontWeight: "700", fontSize: "15px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s", marginBottom: "14px"
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            <span
              onClick={async () => {
                if (!email) { setError("Enter your email above first."); return; }
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/reset-password"
                });
                if (resetError) { setError(resetError.message); }
                else { setError("✅ Password reset email sent! Check your inbox."); }
              }}
              style={{ fontSize: "13px", color: "#15803d", cursor: "pointer", fontWeight: "600" }}
            >
              Forgot password?
            </span>
          </div>
        </form>

        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "16px", textAlign: "center" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#15803d", fontWeight: "700", textDecoration: "none" }}>
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px", marginBottom: "14px",
  outline: "none", boxSizing: "border-box"
};