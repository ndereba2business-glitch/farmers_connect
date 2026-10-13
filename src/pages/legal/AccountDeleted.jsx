import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import LegalLayout from "./LegalLayout";
import { supabase } from "../../lib/supabaseClient";
import { APP_NAME } from "../../config/legal";

// Where a person lands the moment their account has been deleted.
export default function AccountDeleted() {
  const { state } = useLocation();

  // The login no longer exists; this clears what the browser still holds.
  // It happens here, once this page is on screen, and not before leaving
  // the profile: the signed-in pages send anyone without a session to the
  // login page, and that redirect would win. Only when arriving from a
  // deletion, so opening this address by hand signs nobody out.
  useEffect(() => {
    if (state?.deleted) supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }, [state]);

  return (
    <LegalLayout title="Your account has been deleted">
      <p className="lg-lead">
        Your {APP_NAME} account and the data in it have been deleted. You have been signed out on this device.
      </p>
      <p>
        If you were signed in on another phone or computer, that device will be signed out within an hour and will find
        nothing to show. Copies in our hosting providers' backups disappear on their own schedules.
      </p>
      <p>You are welcome back at any time. A new account starts empty.</p>
      <div className="lg-actions">
        <Link to="/" className="fc-btn fc-btn--secondary">Go to the home page</Link>
      </div>
    </LegalLayout>
  );
}
