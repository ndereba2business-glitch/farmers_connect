import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // -----------------------------
  // FETCH FARMER PROFILE
  // -----------------------------
  async function fetchProfile(email) {
    if (!email) return;
    try {
      const { data, error } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("user_email", email)
        .maybeSingle(); // ✅ maybeSingle returns null if no profile, instead of throwing error

      if (!error && data) {
        // ✅ No profile exists - create one automatically
        const { data: newProfile } = await supabase
          .from("farmer_profiles")
          .insert([{ 
            user_email: email,
            full_name: "Farmer",
            county: "",
            avatar_url: ""
          }])
          .select()
          .single();
        setProfile(newProfile);
      } else {
        setProfile(data || null);
      }
    } catch (err) {
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
  // GET SESSION ON LOAD
  // -----------------------------
  async function getSession() {
    try {
      const { data } = await supabase.auth.getSession();
      const currentUser = data?.session?.user || null;
      setUser(currentUser);
      setRole(extractRole(currentUser));

      // ✅ NOT awaited — runs in background, never blocks loading
      fetchProfile(currentUser?.email);

    } catch (err) {
      setUser(null);
      setRole(null);
    } finally {
      // ✅ Always fires immediately after session check
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
        fetchProfile(currentUser?.email);
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
      userEmail: user?.email || null,
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