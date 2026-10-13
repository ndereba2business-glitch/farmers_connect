import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { resetRequestMessage } from "../lib/passwordRules";
import LegalLayout from "./legal/LegalLayout";
import "../components/Account.css";

// Step one of recovering an account: ask for a link by email. It never
// says whether the address has an account.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setResult({ ok: false, message: "Enter the email address your account uses." });
      return;
    }
    setBusy(true);
    setResult(null);
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setBusy(false);
    setResult(resetRequestMessage(error));
  }

  return (
    <LegalLayout title="Forgot your password?">
      <p className="lg-lead">Enter the email address you signed up with and we will send you a link to choose a new password.</p>

      {result?.ok ? (
        <div className="lg-done" role="status">{result.message}</div>
      ) : (
        <form className="lg-form" onSubmit={submit} noValidate>
          <label className="ac-field" htmlFor="fp-email">
            <span>Email address</span>
            <input
              id="fp-email" className="ac-input" type="email" autoComplete="email" inputMode="email"
              value={email} onChange={e => setEmail(e.target.value)} disabled={busy} required
            />
          </label>
          {result && !result.ok && <p role="alert" className="lg-error">{result.message}</p>}
          <button type="submit" className="fc-btn fc-btn--primary" disabled={busy}>
            {busy ? "Sending..." : "Send me a link"}
          </button>
        </form>
      )}

      <h2>Signed up with a phone number?</h2>
      <p>
        A password for a phone-number account cannot be reset by text message yet. Send us the number through the{" "}
        <Link to="/delete-account#request">request form</Link> (choose "A question or request about my data") and an
        administrator will contact you on that number.
      </p>

      <div className="lg-actions">
        <Link to="/login" className="fc-btn fc-btn--secondary">Back to log in</Link>
      </div>
    </LegalLayout>
  );
}
