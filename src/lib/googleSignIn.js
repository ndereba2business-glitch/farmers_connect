// "Continue with Google". Google sign-in only works once the Google
// provider is switched on in the Supabase project (Authentication >
// Sign In / Providers), so the button asks Supabase first and stays
// hidden until it is; nobody gets sent to a provider error page.
import { supabase } from "./supabaseClient";

const SETTINGS_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ENABLED_KEY = "fc_google_enabled";
const PENDING_ROLE_KEY = "fc_pending_role";
const PENDING_ROLE_MAX_AGE_MS = 10 * 60 * 1000;

// Roles a person may choose for themselves at sign-up. Admin is never
// one of them (see extractRole in AuthContext).
const SELF_SERVICE_ROLES = ["farmer", "vet", "supplier"];

function storage(kind) {
  try { return window[kind]; } catch { return null; }
}

export async function isGoogleEnabled() {
  const cached = storage("sessionStorage")?.getItem(ENABLED_KEY);
  if (cached) return cached === "yes";
  try {
    const res = await fetch(SETTINGS_URL, { headers: { apikey: ANON_KEY } });
    if (!res.ok) return false;
    const enabled = (await res.json())?.external?.google === true;
    storage("sessionStorage")?.setItem(ENABLED_KEY, enabled ? "yes" : "no");
    return enabled;
  } catch {
    return false;
  }
}

// Google sends the person away and back, so a role picked on the sign-up
// page is parked here and applied when they return (AuthContext).
export function rememberPendingRole(role) {
  if (!SELF_SERVICE_ROLES.includes(role)) return;
  storage("localStorage")?.setItem(PENDING_ROLE_KEY, JSON.stringify({ role, at: Date.now() }));
}

export function readPendingRole() {
  try {
    const saved = JSON.parse(storage("localStorage")?.getItem(PENDING_ROLE_KEY) || "null");
    if (!saved || !SELF_SERVICE_ROLES.includes(saved.role)) return null;
    // Stale choices are ignored so one left behind on a shared phone
    // can't change the next person's account.
    if (Date.now() - saved.at > PENDING_ROLE_MAX_AGE_MS) return null;
    return saved.role;
  } catch {
    return null;
  }
}

export function clearPendingRole() {
  storage("localStorage")?.removeItem(PENDING_ROLE_KEY);
}

// `role` is only passed from the sign-up page. Returns an error message,
// or nothing when the browser is on its way to Google.
export async function startGoogleSignIn(role) {
  if (role) rememberPendingRole(role);
  else clearPendingRole();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` }
  });
  if (error) {
    clearPendingRole();
    return error.message || "Google sign-in could not start. Please try again.";
  }
  return null;
}
