import BrandMark from "../components/BrandMark";
import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import GoogleButton from "../components/GoogleButton";
import { MINIMUM_AGE, TERMS_VERSION } from "../config/legal";
import { MIN_PASSWORD_LENGTH } from "../lib/passwordRules";
import { confirmationRedirect, needsEmailConfirmation, resendMessage, signUpErrorMessage } from "../lib/authMessages";
import { POLICIES_PUBLISHED } from "../config/features";
import "../components/Account.css";

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

  // With the policies unpublished there is nothing to agree to yet.
  const [agreed, setAgreed] =
    useState(!POLICIES_PUBLISHED);

  // Set when the account exists but waits for its email address to be
  // confirmed: the address the link was sent to.
  const [sentTo, setSentTo] =
    useState("");

  const [resend, setResend] =
    useState({ busy: false, ok: false, message: "" });

  async function sendLinkAgain() {
    setResend({ busy: true, ok: false, message: "" });
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: confirmationRedirect(window.location.origin) }
    });
    setResend({ busy: false, ...resendMessage(resendError) });
  }

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
              // where the confirmation link brings them back to, signed in
              emailRedirectTo:
                confirmationRedirect(window.location.origin),

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
          signUpErrorMessage(authError)
        );

        setLoading(false);

        return;
      }

      // =========================
      // EMAIL TO CONFIRM
      // =========================
      // With "Confirm email" on, Supabase creates the account but gives no
      // session until the link in the email is opened. The database has
      // already made the profile; the terms are asked for again at first
      // sign-in (TermsGate). Supabase answers the same way when the address
      // already has an account, so the words cover both.
      if (needsEmailConfirmation(data)) {

        setSentTo(
          data.user.email || email
        );

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

      // Record the acceptance on the profile the database created at
      // sign-up. If this does not save, TermsGate asks again on first use.
      if (userIdentity && POLICIES_PUBLISHED) {
        await supabase
          .from("farmer_profiles")
          .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
          .eq("user_email", userIdentity);
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

    } catch {

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
        background: "var(--fc-bg-gray53)",
        padding: "20px"
      }}
    >

      <div
        style={{
          background: "var(--fc-bg-gray0)",
          width: "100%",
          maxWidth: "440px",
          borderRadius: "16px",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.08)",
          padding: "36px 32px"
        }}
      >

        {/* HEADER */}
        <div style={{ marginBottom: "14px" }}>
          <BrandMark size={48} />
        </div>

        <h1
          style={{
            margin: "0 0 4px",
            fontSize: "24px",
            fontWeight: "700",
            letterSpacing: "-0.02em",
            color: "var(--fc-fg-gray900)"
          }}
        >
          Create your account
        </h1>

        <p
          style={{
            color: "var(--fc-fg-gray500)",
            fontSize: "14px",
            marginBottom: "28px"
          }}
        >
          For poultry farmers, vets and suppliers
        </p>

        {sentTo ? (
          <div className="ac-sent">
            <h2>Check your email</h2>
            <p>
              We sent a link to <strong>{sentTo}</strong>. Open it on this phone to finish creating
              your account; it can take a few minutes, so check your spam folder too.
            </p>
            <p>
              If this address already has an account, no new one was made: log in, or reset your password.
            </p>
            {resend.message && (
              <p role={resend.ok ? "status" : "alert"} className={resend.ok ? "ac-note" : "ac-error"}>
                {resend.message}
              </p>
            )}
            <button type="button" className="fc-btn fc-btn--secondary" onClick={sendLinkAgain} disabled={resend.busy}>
              {resend.busy ? "Sending..." : "Send the link again"}
            </button>
            <Link to="/login" className="fc-btn fc-btn--primary">Go to log in</Link>
          </div>
        ) : <>

        {/* METHOD TOGGLE */}
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
                  : "var(--fc-fg-gray550)"
            }}
          >
            Email
          </button>

          <button
            type="button"
            className="fc-tap"

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
                  : "var(--fc-fg-gray550)"
            }}
          >
            Phone
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

            aria-label="Full Name" placeholder="Full Name"

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

              aria-label="Email" placeholder="Email"

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

              aria-label="Phone number" placeholder="0712345678"

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

            aria-label="Password" placeholder="Password"

            required

            minLength={MIN_PASSWORD_LENGTH}

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
                  className="fc-tap"

                  onClick={() =>
                    setRole(r)
                  }

                  style={{
                    padding:
                      "8px 16px",

                    borderRadius: "16px",

                    border:
                      role === r
                        ? "2px solid var(--fc-line-green700)"
                        : "2px solid var(--fc-line-gray250)",

                    background:
                      role === r
                        ? "var(--fc-bg-green100)"
                        : "var(--fc-surface)",

                    // a button's own default text colour follows the system, not the page
                    color:
                      "var(--fc-ink)",

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
                  "var(--fc-bg-red50)",
                color:
                  "var(--fc-fg-red600)",
                padding:
                  "12px",
                borderRadius: "12px",
                marginBottom:
                  "14px",
                fontSize:
                  "14px"
              }}
            >
              <AlertTriangle size={14} aria-hidden="true" /> {error}
            </div>
          )}

          {/* SUCCESS */}
          {success && (

            <div
              style={{
                background:
                  "var(--fc-bg-green50)",
                color:
                  "var(--fc-fg-green700)",
                padding:
                  "12px",
                borderRadius: "12px",
                marginBottom:
                  "14px",
                fontSize:
                  "14px"
              }}
            >
              <CheckCircle2 size={14} aria-hidden="true" /> {success}
            </div>
          )}

          {/* TERMS: accepted before the account exists */}
          {POLICIES_PUBLISHED && <label className="ac-check" style={{ marginBottom: "14px" }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              required
            />
            <span>
              I am {MINIMUM_AGE} or older, and I agree to the{" "}
              <Link to="/terms" target="_blank" rel="noopener">Terms and Community Rules</Link> and have read the{" "}
              <Link to="/privacy" target="_blank" rel="noopener">Privacy Policy</Link>.
            </span>
          </label>}

          {/* BUTTON */}
          <button
            type="submit"

            disabled={loading || !agreed}

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
              ? "Creating account..."
              : "Create account"}
          </button>

        </form>

        <GoogleButton role={role} label="Sign up with Google" />

        {/* LOGIN LINK */}
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "var(--fc-fg-gray550)",
            fontSize: "14px"
          }}
        >

          Already have an account?

          <Link
            to="/login"

            style={{
              color: "var(--fc-fg-green700)",
              fontWeight: "700",
              marginLeft: "5px",
              textDecoration:
                "none"
            }}
          >
            Login
          </Link>

        </p>

        </>}

      </div>

    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1.5px solid var(--fc-line-gray250)",
  marginBottom: "14px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};