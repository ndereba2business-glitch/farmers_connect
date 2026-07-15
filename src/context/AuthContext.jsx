import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // -----------------------------
  // RESOLVE CANONICAL IDENTITY
  // -----------------------------
  // A user has EITHER an email OR a phone (never both, in this app).
  // Every table (farm_batches, farm_tasks, products, etc.) is keyed on
  // a single "user_email" column that in practice holds whichever one
  // the user signed up with. This is the ONE place that decision is
  // made — every page in the app reads userEmail from this context,
  // so fixing it here fixes every downstream query at once.
  function resolveIdentity(user) {
    return user?.email || user?.phone || null;
  }

  // -----------------------------
  // FETCH FARMER PROFILE
  // -----------------------------
  async function fetchProfile(identity) {
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

      // No profile row yet for this identity — create one.
      const { data: newProfile, error: insertError } = await supabase
        .from("farmer_profiles")
        .insert([{
          user_email: identity,
          full_name: "Farmer",
          county: "",
          avatar_url: ""
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
  // EXTRACT ROLE FROM USER
  // -----------------------------
  function extractRole(user) {
    return user?.user_metadata?.role || "farmer";
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
      setRole(extractRole(currentUser));

      // Not awaited — runs in background, never blocks loading
      fetchProfile(resolveIdentity(currentUser));

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
        setRole(extractRole(currentUser));
        fetchProfile(resolveIdentity(currentUser));
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

  return (
    <AuthContext.Provider value={{
      user,
      role,
      profile,
      loading,
      logout,
      userEmail: resolveIdentity(user),
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