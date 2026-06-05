import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function Login() {

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

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

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    setLoading(true);

    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    setLoading(false);

    if (error) {
      alert(error.message);
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

        {/* EMAIL */}
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
            fontSize: "15px"
          }}
        />

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
            fontSize: "15px"
          }}
        />

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