import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {

  const navigate = useNavigate();

  const [method, setMethod] =
    useState("email");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [fullName, setFullName] =
    useState("");

  const [role, setRole] =
    useState("farmer");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // =========================
  // REDIRECT IF LOGGED IN
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
  // SIGNUP
  // =========================
  async function handleSignup(e) {

    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {

      let authResult;

      // =========================
      // EMAIL SIGNUP
      // =========================
      if (method === "email") {

        authResult =
          await supabase.auth.signUp({

            email,

            password,

            options: {
              data: {
                full_name:
                  fullName,

                role:
                  role
              }
            }
          });

      } else {

        // =========================
        // PHONE SIGNUP
        // =========================

        const formattedPhone =
          phone.startsWith("+")
            ? phone
            : "+254" +
              phone.replace(/^0/, "");

        authResult =
          await supabase.auth.signUp({

            phone:
              formattedPhone,

            password,

            options: {
              data: {
                full_name:
                  fullName,

                role:
                  role
              }
            }
          });
      }

      const {
        data,
        error: authError
      } = authResult;

      // =========================
      // HANDLE ERROR
      // =========================
      if (authError) {

        setError(
          authError.message
        );

        setLoading(false);

        return;
      }

      // =========================
      // CREATE PROFILE
      // =========================
      // IMPORTANT: identity must come from data.user (what Supabase
      // actually stored — e.g. the normalized "+254..." phone), never
      // from local form state. AuthContext looks profiles up using
      // data.user.email || data.user.phone, so this must match exactly
      // or the profile becomes unreachable after login.
      const userId =
        data?.user?.id;

      const userIdentity =
        data?.user?.email ||
        data?.user?.phone ||
        null;

      if (userId && userIdentity) {

        await supabase
          .from(
            "farmer_profiles"
          )
          .insert([
            {
              user_email:
                userIdentity,

              full_name:
                fullName,

              county: "",

              avatar_url: ""
            }
          ]);
      }

      // =========================
      // SUCCESS MESSAGE
      // =========================
      setSuccess(
        "Account created successfully!"
      );

      // =========================
      // AUTO REDIRECT
      // =========================
      setTimeout(() => {

        if (role === "vet") {

          navigate("/vet");

        } else if (
          role === "admin"
        ) {

          navigate("/admin");

        } else {

          navigate("/");
        }

      }, 1500);

    } catch (err) {

      setError(
        "Something went wrong. Please try again."
      );

    } finally {

      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0fdf4",
        padding: "20px"
      }}
    >

      <div
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: "440px",
          borderRadius: "20px",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.08)",
          padding: "36px 32px"
        }}
      >

        {/* HEADER */}
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#15803d",
            marginBottom: "6px"
          }}
        >
          🐔 Farmers Connect
        </h1>

        <p
          style={{
            color: "#6b7280",
            fontSize: "14px",
            marginBottom: "28px"
          }}
        >
          Create your account and grow your farm
        </p>

        {/* METHOD TOGGLE */}
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

            onClick={() =>
              setMethod("email")
            }

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

            onClick={() =>
              setMethod("phone")
            }

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

        {/* FORM */}
        <form
          onSubmit={
            handleSignup
          }
        >

          {/* FULL NAME */}
          <input
            type="text"

            placeholder="Full Name"

            required

            value={fullName}

            onChange={(e) =>
              setFullName(
                e.target.value
              )
            }

            style={inputStyle}
          />

          {/* EMAIL OR PHONE */}
          {method === "email" ? (

            <input
              type="email"

              placeholder="Email"

              required

              value={email}

              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }

              style={inputStyle}
            />

          ) : (

            <input
              type="tel"

              placeholder="0712345678"

              required

              value={phone}

              onChange={(e) =>
                setPhone(
                  e.target.value
                )
              }

              style={inputStyle}
            />

          )}

          {/* PASSWORD */}
          <input
            type="password"

            placeholder="Password"

            required

            minLength={6}

            value={password}

            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }

            style={inputStyle}
          />

          {/* ROLE */}
          <div
            style={{
              marginBottom: "18px"
            }}
          >

            <p
              style={{
                marginBottom: "10px",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              I am a:
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap"
              }}
            >

              {[
                "farmer",
                "vet",
                "supplier"
              ].map((r) => (

                <button
                  key={r}

                  type="button"

                  onClick={() =>
                    setRole(r)
                  }

                  style={{
                    padding:
                      "8px 16px",

                    borderRadius:
                      "20px",

                    border:
                      role === r
                        ? "2px solid #15803d"
                        : "2px solid #ddd",

                    background:
                      role === r
                        ? "#dcfce7"
                        : "white",

                    cursor:
                      "pointer",

                    fontWeight:
                      "600",

                    textTransform:
                      "capitalize"
                  }}
                >
                  {r}
                </button>
              ))}

            </div>

          </div>

          {/* ERROR */}
          {error && (

            <div
              style={{
                background:
                  "#fef2f2",
                color:
                  "#dc2626",
                padding:
                  "12px",
                borderRadius:
                  "10px",
                marginBottom:
                  "14px",
                fontSize:
                  "14px"
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* SUCCESS */}
          {success && (

            <div
              style={{
                background:
                  "#f0fdf4",
                color:
                  "#15803d",
                padding:
                  "12px",
                borderRadius:
                  "10px",
                marginBottom:
                  "14px",
                fontSize:
                  "14px"
              }}
            >
              ✅ {success}
            </div>
          )}

          {/* BUTTON */}
          <button
            type="submit"

            disabled={loading}

            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background:
                "#15803d",
              color: "white",
              fontWeight: "700",
              fontSize: "15px",
              cursor: "pointer"
            }}
          >
            {loading
              ? "Creating Account..."
              : "Create Account"}
          </button>

        </form>

        {/* LOGIN LINK */}
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "#666",
            fontSize: "14px"
          }}
        >

          Already have an account?

          <Link
            to="/login"

            style={{
              color: "#15803d",
              fontWeight: "700",
              marginLeft: "5px",
              textDecoration:
                "none"
            }}
          >
            Login
          </Link>

        </p>

      </div>

    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: "10px",
  border: "1.5px solid #ddd",
  marginBottom: "14px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};