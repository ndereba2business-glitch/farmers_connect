import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

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

  const [error, setError] =
    useState("");

  const navigate =
    useNavigate();

  const { setUser } =
    useAuth();

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
        navigate("/");
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

    // SAVE USER
    setUser(data.user);

    // GET ROLE
    const role =
      data.user?.user_metadata?.role;

    // REDIRECT BASED ON ROLE
    if (role === "vet") {

      navigate("/vet");

    } else if (role === "admin") {

      navigate("/admin");

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
        background: "#f0fdf4",
        padding: "20px"
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "white",
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

          <div
            style={{
              fontSize: "50px",
              marginBottom: "10px"
            }}
          >
            🐔
          </div>

          <h1>
            Farmers Connect
          </h1>

          <p
            style={{
              color: "#666"
            }}
          >
            Login to continue
          </p>

        </div>

        {/* METHOD TOGGLE — mirrors Signup.jsx */}
        <div
          style={{
            display: "flex",
            background: "#f3f4f6",
            borderRadius: "10px",
            padding: "4px",
            marginBottom: "20px"
          }}
        >

          <button
            type="button"

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
                  : "#666"
            }}
          >
            📧 Email
          </button>

          <button
            type="button"

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
                  : "#666"
            }}
          >
            📱 Phone
          </button>

        </div>

        {/* EMAIL OR PHONE INPUT */}
        {method === "email" ? (

          <input
            type="email"

            placeholder="Email"

            value={email}

            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }

            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              marginBottom: "15px",
              fontSize: "15px",
              boxSizing: "border-box"
            }}
          />

        ) : (

          <input
            type="tel"

            placeholder="0712345678"

            value={phone}

            onChange={(e) =>
              setPhone(
                e.target.value
              )
            }

            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              marginBottom: "15px",
              fontSize: "15px",
              boxSizing: "border-box"
            }}
          />
        )}

        {/* PASSWORD */}
        <input
          type="password"

          placeholder="Password"

          value={password}

          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }

          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "10px",
            border: "1px solid #ddd",
            marginBottom: "20px",
            fontSize: "15px",
            boxSizing: "border-box"
          }}
        />

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "12px",
              borderRadius: "10px",
              marginBottom: "14px",
              fontSize: "14px"
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* LOGIN BUTTON */}
        <button
          onClick={handleLogin}

          disabled={loading}

          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "10px",
            border: "none",
            background: "#15803d",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "15px"
          }}
        >
          {loading
            ? "Logging in..."
            : "Login"}
        </button>

        {/* SIGNUP */}
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "#666"
          }}
        >

          Don't have an account?

          <span
            onClick={() =>
              navigate("/signup")
            }

            style={{
              color: "#15803d",
              marginLeft: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Signup
          </span>

        </p>

      </div>

    </div>
  );
}