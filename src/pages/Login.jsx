import BrandMark from "../components/BrandMark";
import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { extractRole } from "../context/AuthContext";
import GoogleButton from "../components/GoogleButton";
import { POLICIES_PUBLISHED } from "../config/features";

export default function Login() {

  const [method, setMethod] =
    useState("email");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  // A sign-in that came back refused (App.jsx) arrives here with its reason.
  const [error, setError] =
    useState(useLocation().state?.signInProblem || "");

  const navigate =
    useNavigate();

  // Only a path on this site is honoured, never a full address.
  const requested = new URLSearchParams(window.location.search).get("next") || "";
  const nextPath = requested.startsWith("/") && !requested.startsWith("//") ? requested : "";

  // =========================
  // AUTO REDIRECT IF LOGGED IN
  // =========================
  useEffect(() => {

    async function checkSession() {

      const {
        data
      } =
        await supabase.auth.getSession();

      if (data.session) {
        navigate(nextPath || "/");
      }
    }

    checkSession();

  }, []);

  // =========================
  // LOGIN
  // =========================
  async function handleLogin() {

    setError("");

    if (method === "email" && (!email || !password)) {
      setError("Please enter email and password");
      return;
    }

    if (method === "phone" && (!phone || !password)) {
      setError("Please enter phone number and password");
      return;
    }

    setLoading(true);

    let authResult;

    if (method === "email") {

      authResult =
        await supabase.auth.signInWithPassword({
          email,
          password
        });

    } else {

      // Same +254 normalization used in Signup.jsx —
      // must stay identical or a user who signed up
      // with "0712345678" won't match on login.
      const formattedPhone =
        phone.startsWith("+")
          ? phone
          : "+254" +
            phone.replace(/^0/, "");

      authResult =
        await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password
        });
    }

    const {
      data,
      error: authError
    } = authResult;

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // AuthContext's own onAuthStateChange listener (supabase.auth.
    // onAuthStateChange) already updates `user` for us on SIGNED_IN —
    // no need to push it in manually here.

    // GET ROLE — must match AuthContext's extractRole exactly, since a
    // self-reported "admin" in user_metadata is never trusted (only
    // app_metadata is authoritative for admin status).
    const role =
      extractRole(data.user);

    // Sent here from a page that needs a sign-in: go back to it.
    if (nextPath) {
      navigate(nextPath);
      return;
    }

    // REDIRECT BASED ON ROLE
    if (role === "vet") {

      navigate("/vet");

    } else if (role === "admin") {

      navigate("/admin");

    } else if (role === "supplier") {

      navigate("/supplier");

    } else {

      navigate("/");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "var(--fc-bg-gray53)",
        padding: "20px"
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--fc-surface)",
          padding: "30px",
          borderRadius: "16px",
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.08)"
        }}
      >

        <div
          style={{
            textAlign: "center",
            marginBottom: "25px"
          }}
        >

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
            <BrandMark size={56} />
          </div>

          <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: "700", letterSpacing: "-0.02em", color: "var(--fc-fg-gray900)" }}>
            Farmers Connect
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--fc-fg-gray500)"
            }}
          >
            Log in to continue
          </p>

        </div>

        {/* METHOD TOGGLE — mirrors Signup.jsx */}
        <div
          style={{
            display: "flex",
            background: "var(--fc-bg-gray100)",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "20px"
          }}
        >

          <button
            type="button"
            className="fc-tap"

            onClick={() => {
              setMethod("email");
              setError("");
            }}

            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              background:
                method === "email"
                  ? "#15803d"
                  : "transparent",
              color:
                method === "email"
                  ? "white"
                  : "var(--fc-fg-gray550)"
            }}
          >
            Email
          </button>

          <button
            type="button"
            className="fc-tap"

            onClick={() => {
              setMethod("phone");
              setError("");
            }}

            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              background:
                method === "phone"
                  ? "#15803d"
                  : "transparent",
              color:
                method === "phone"
                  ? "white"
                  : "var(--fc-fg-gray550)"
            }}
          >
            Phone
          </button>

        </div>

        {/* EMAIL OR PHONE INPUT */}
        {method === "email" ? (

          <input
            type="email"

            aria-label="Email" placeholder="Email"

            value={email}

            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }

            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid var(--fc-line-gray250)",
              marginBottom: "15px",
              fontSize: "15px",
              boxSizing: "border-box"
            }}
          />

        ) : (

          <input
            type="tel"

            aria-label="Phone number" placeholder="0712345678"

            value={phone}

            onChange={(e) =>
              setPhone(
                e.target.value
              )
            }

            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid var(--fc-line-gray250)",
              marginBottom: "15px",
              fontSize: "15px",
              boxSizing: "border-box"
            }}
          />
        )}

        {/* PASSWORD */}
        <input
          type="password"

          aria-label="Password" placeholder="Password"

          value={password}

          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }

          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid var(--fc-line-gray250)",
            marginBottom: "20px",
            fontSize: "15px",
            boxSizing: "border-box"
          }}
        />

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            style={{
              background: "var(--fc-bg-red50)",
              color: "var(--fc-fg-red600)",
              padding: "12px",
              borderRadius: "12px",
              marginBottom: "14px",
              fontSize: "14px"
            }}
          >
            <AlertTriangle size={14} aria-hidden="true" /> {error}
          </div>
        )}

        {/* LOGIN BUTTON */}
        <button
          onClick={handleLogin}

          disabled={loading}

          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "#15803d",
            color: "white",
            fontWeight: "700",
            cursor: "pointer",
            fontSize: "15px"
          }}
        >
          {loading
            ? "Logging in..."
            : "Log in"}
        </button>

        <GoogleButton />

        {/* SIGNUP */}
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "var(--fc-fg-gray550)"
          }}
        >

          Don't have an account?

          <span
            onClick={() =>
              navigate("/signup")
            }

            style={{
              color: "var(--fc-fg-green700)",
              marginLeft: "6px",
              cursor: "pointer",
              fontWeight: "700"
            }}
          >
            Sign up
          </span>

        </p>

        <p className="fc-policy-links" style={{ justifyContent: "center" }}>
          {POLICIES_PUBLISHED && <Link to="/privacy">Privacy</Link>}
          {POLICIES_PUBLISHED && <Link to="/terms">Terms and rules</Link>}
          <Link to="/delete-account">Delete account</Link>
        </p>

      </div>

    </div>
  );
}