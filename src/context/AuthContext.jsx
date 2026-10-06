import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { clearPendingRole, readPendingRole } from "../lib/googleSignIn";

const AuthContext = createContext();

// Users sign up with either an email or a phone number (Signup.jsx already
// writes farmer_profiles.user_email as email||phone for phone-only
// accounts, and the RLS policies are built around
// coalesce(auth.email(), auth.jwt()->>'phone') for exactly this reason) —
// so "identity" here means whichever one the account actually has, not
// email specifically.
function identityOf(u) {
  return u?.email || u?.phone || null;
}

// Admin status must come from app_metadata — it's settable only via the
// Supabase dashboard/SQL editor or the service-role key, never by the
// authenticated client itself (unlike user_metadata, which any user can
// set on their own account via supabase.auth.updateUser()). A self-
// reported "admin" in user_metadata is never trusted; farmer/vet/supplier
// self-selection is fine since those don't grant elevated access on their
// own — vet-specific actions are separately gated by
// vet_profiles.verification_status, an admin-controlled DB column.
export function extractRole(user) {
  if (user?.app_metadata?.role === "admin") return "admin";
  const claimed = user?.user_metadata?.role;
  return claimed === "admin" ? "farmer" : (claimed || "farmer");
}

// Google sign-up can't carry the role picked on the sign-up page through
// the trip to Google and back, so the page parks it (googleSignIn.js)
// and it's applied here once, to an account that has no role yet. Only
// farmer/vet/supplier can be parked, the same self-selected roles the
// email sign-up form writes; it can never produce an admin.
let savingPendingRole = false;

function roleFor(user) {
  const role = extractRole(user);
  if (!user || user.user_metadata?.role || role === "admin") return role;

  const pending = readPendingRole();
  if (!pending) return role;

  if (!savingPendingRole) {
    savingPendingRole = true;
    // Deferred: Supabase forbids calling auth methods from inside its own
    // onAuthStateChange callback.
    setTimeout(async () => {
      const { error } = await supabase.auth.updateUser({ data: { role: pending } });
      if (error) console.error("roleFor: saving the chosen role failed —", error.message);
      else clearPendingRole();
      savingPendingRole = false;
    }, 0);
  }
  return pending;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // -----------------------------
  // FETCH FARMER PROFILE
  // -----------------------------
  async function fetchProfile(currentUser) {
    const identity = identityOf(currentUser);
    if (!identity) return;
    try {
      const { data, error } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("user_email", identity)
        .maybeSingle(); // returns null if no row found, instead of throwing

      if (error) {
        console.error("fetchProfile: select failed —", error.message);
        setProfile(null);
        return;
      }

      if (data) {
        // Profile already exists — just use it. Do NOT insert again.
        setProfile(data);
        return;
      }

      // No profile row yet for this identity — create one. Google
      // accounts arrive with a name and photo, so start from those.
      const meta = currentUser.user_metadata || {};
      const { data: newProfile, error: insertError } = await supabase
        .from("farmer_profiles")
        .insert([{
          user_email: identity,
          full_name: meta.full_name || meta.name || "Farmer",
          county: "",
          avatar_url: meta.avatar_url || meta.picture || ""
        }])
        .select()
        .single();

      if (insertError) {
        console.error("fetchProfile: insert failed —", insertError.message);
        setProfile(null);
        return;
      }

      setProfile(newProfile);
    } catch (err) {
      console.error("fetchProfile: unexpected error —", err.message);
      setProfile(null);
    }
  }

  // -----------------------------
  // TIMEOUT HELPER
  // Prevents getSession() from hanging forever on slow/flaky mobile
  // networks. If Supabase doesn't respond within 8s, we stop waiting
  // and let the app proceed as "logged out" rather than freeze on
  // the loading screen indefinitely.
  // -----------------------------
  function withTimeout(promise, ms = 8000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), ms)
      )
    ]);
  }

  // -----------------------------
  // GET SESSION ON LOAD
  // -----------------------------
  async function getSession() {
    try {
      const { data } = await withTimeout(supabase.auth.getSession());
      const currentUser = data?.session?.user || null;
      setUser(currentUser);
      setRole(roleFor(currentUser));

      // Not awaited — runs in background, never blocks loading
      fetchProfile(currentUser);

    } catch (err) {
      console.error("getSession: failed or timed out —", err.message);
      setUser(null);
      setRole(null);
    } finally {
      // Always fires — either from success, real failure, or timeout
      setLoading(false);
    }
  }

  // -----------------------------
  // LISTEN FOR AUTH CHANGES
  // -----------------------------
  useEffect(() => {
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);
        setRole(roleFor(currentUser));
        fetchProfile(currentUser);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // -----------------------------
  // LOGOUT HELPER
  // -----------------------------
  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setProfile(null);
  }

  // -----------------------------
  // COMPLETE ONBOARDING TOUR
  // Called when the user finishes or skips the OnboardingTour.
  // Persists to the DB (not localStorage) so it follows the user
  // across devices. Local state changes first so the tour closes at
  // once even on a bad connection; if the save fails the user simply
  // sees the tour again next time they sign in.
  // -----------------------------
  async function completeOnboarding() {
    const identity = identityOf(user);
    if (!identity) return;

    setProfile(prev => prev ? { ...prev, has_seen_onboarding: true } : prev);

    const { error } = await supabase
      .from("farmer_profiles")
      .update({ has_seen_onboarding: true })
      .eq("user_email", identity);

    if (error) console.error("completeOnboarding: update failed —", error.message);
  }

  // -----------------------------
  // REPLAY ONBOARDING TOUR
  // Flips has_seen_onboarding back to false. OnboardingTour (mounted by
  // Layout.jsx and SupplierShell.jsx) watches that flag and opens by
  // itself, so this works from wherever it's triggered (e.g. Profile).
  // Local state changes first so the tour opens even if the save is
  // slow or fails; finishing the tour writes the flag again anyway.
  // -----------------------------
  async function replayOnboarding() {
    const identity = identityOf(user);
    if (!identity) return;

    setProfile(prev => prev ? { ...prev, has_seen_onboarding: false } : prev);

    const { error } = await supabase
      .from("farmer_profiles")
      .update({ has_seen_onboarding: false })
      .eq("user_email", identity);

    if (error) console.error("replayOnboarding: update failed —", error.message);
  }

  return (
    <AuthContext.Provider value={{
      user,
      role,
      profile,
      loading,
      logout,
      completeOnboarding,
      replayOnboarding,
      userEmail: identityOf(user),
      isAdmin: role === "admin",
      isVet: role === "vet",
      isSupplier: role === "supplier",
      isFarmer: role === "farmer"
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}