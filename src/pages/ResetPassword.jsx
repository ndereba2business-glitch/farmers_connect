import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { MIN_PASSWORD_LENGTH, passwordProblem, passwordUpdateMessage } from "../lib/passwordRules";
import LegalLayout from "./legal/LegalLayout";
import "../components/Account.css";

// Step two: the link in the email signs the person in for this one
// purpose and brings them here to choose a new password. Someone already
// signed in can use the same page to change theirs.
export default function ResetPassword() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const problem = passwordProblem(password, repeat);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    const { error: failure } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (failure) {
      setError(passwordUpdateMessage(failure));
      return;
    }
    toast.success("Your password has been changed.");
    navigate("/", { replace: true });
  }

  if (!user) {
    return (
      <LegalLayout title="Choose a new password">
        <p className="lg-lead">This link has expired or was already used.</p>
        <p>Reset links work once and for a limited time. Ask for a new one and open it on this phone.</p>
        <div className="lg-actions">
          <Link to="/forgot-password" className="fc-btn fc-btn--primary">Send me a new link</Link>
          <Link to="/login" className="fc-btn fc-btn--secondary">Back to log in</Link>
        </div>
      </LegalLayout>
    );
  }

  return (
    <LegalLayout title="Choose a new password">
      <p className="lg-lead">Choose a password of at least {MIN_PASSWORD_LENGTH} characters that you do not use anywhere else.</p>
      <form className="lg-form" onSubmit={submit} noValidate>
        <label className="ac-field" htmlFor="rp-new">
          <span>New password</span>
          <input
            id="rp-new" className="ac-input" type="password" autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)} disabled={busy} required
          />
        </label>
        <label className="ac-field" htmlFor="rp-repeat">
          <span>Type it again</span>
          <input
            id="rp-repeat" className="ac-input" type="password" autoComplete="new-password"
            value={repeat} onChange={e => setRepeat(e.target.value)} disabled={busy} required
          />
        </label>
        {error && <p role="alert" className="lg-error">{error}</p>}
        <button type="submit" className="fc-btn fc-btn--primary" disabled={busy}>
          {busy ? "Saving..." : "Save new password"}
        </button>
      </form>
    </LegalLayout>
  );
}
