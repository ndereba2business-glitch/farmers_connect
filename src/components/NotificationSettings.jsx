import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { categoriesFor } from "../lib/notificationHelpers";
import "./NotificationsBell.css";

function Switch({ id, checked, disabled, onChange }) {
  return (
    <span className="ns-switch">
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span aria-hidden="true" />
    </span>
  );
}

// Shown on the profile page for every role. Each switch saves as soon as
// it is flipped, and flips back if the save fails. The database enforces
// the choices (see the notifications_system migration), so they apply to
// every kind of notification, wherever it comes from.
export default function NotificationSettings() {
  const { role, userEmail } = useAuth();
  const toast = useToast();
  const categories = categoriesFor(role);

  const [enabled, setEnabled] = useState(true);
  const [choices, setChoices] = useState({});
  const [ready, setReady] = useState(false);

  // The bell links here as /profile#notifications.
  const { hash } = useLocation();
  useEffect(() => {
    if (ready && hash === "#notifications") {
      document.getElementById("notifications")?.scrollIntoView({ block: "start" });
    }
  }, [ready, hash]);

  useEffect(() => {
    if (!userEmail) return undefined;
    let cancelled = false;

    async function load() {
      const [profileResult, prefsResult] = await Promise.all([
        supabase.from("farmer_profiles").select("notifications_enabled").eq("user_email", userEmail).maybeSingle(),
        supabase.from("notification_preferences")
          .select("vaccinations, farm, vet, community, marketplace, clucky").eq("user_email", userEmail).maybeSingle()
      ]);
      if (cancelled) return;
      if (profileResult.error || prefsResult.error) {
        console.error("NotificationSettings: load failed —", (profileResult.error || prefsResult.error).message);
      }
      setEnabled(profileResult.data?.notifications_enabled !== false);
      // no saved row means every switch is on
      setChoices(prefsResult.data || {});
      setReady(true);
    }

    load();
    return () => { cancelled = true; };
  }, [userEmail]);

  async function setMaster(next) {
    setEnabled(next);
    const { error } = await supabase.from("farmer_profiles")
      .update({ notifications_enabled: next }).eq("user_email", userEmail);
    if (error) {
      setEnabled(!next);
      toast.error("That didn't save. Check your connection and try again.");
    }
  }

  async function setCategory(key, next) {
    const before = choices;
    setChoices({ ...choices, [key]: next });
    const { error } = await supabase.from("notification_preferences")
      .upsert({ user_email: userEmail, [key]: next, updated_at: new Date().toISOString() }, { onConflict: "user_email" });
    if (error) {
      setChoices(before);
      toast.error("That didn't save. Check your connection and try again.");
    }
  }

  return (
    <section className="ns-card" id="notifications" aria-labelledby="ns-title">
      <h2 id="ns-title">Notifications</h2>
      <p className="ns-lead">Choose what Farmers Connect tells you about. Notifications appear under the bell at the top.</p>

      <label className="ns-row ns-row--master" htmlFor="ns-master">
        <span className="ns-row-text">
          <span className="ns-row-label">Allow notifications</span>
          <span className="ns-row-detail">Turn this off to stop all notifications.</span>
        </span>
        <Switch id="ns-master" checked={enabled} disabled={!ready} onChange={setMaster} />
      </label>

      {categories.map(category => (
        <label key={category.key} className={`ns-row${enabled ? "" : " ns-row--off"}`} htmlFor={`ns-${category.key}`}>
          <span className="ns-row-text">
            <span className="ns-row-label">{category.label}</span>
            <span className="ns-row-detail">{category.detail}</span>
          </span>
          <Switch
            id={`ns-${category.key}`}
            checked={enabled && choices[category.key] !== false}
            disabled={!ready || !enabled}
            onChange={next => setCategory(category.key, next)}
          />
        </label>
      ))}

      <p className="ns-note">
        Notices about your account, such as a verification decision, are always sent while notifications are allowed.
      </p>
    </section>
  );
}
