import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { BAR_COLOUR, STORAGE_KEY, SYNCED_KEY, isPreference, reconcile, resolveTheme, toggledPreference } from "../lib/theme";

const ThemeContext = createContext(null);

// Storage can be unavailable (private windows, a full disk). The theme
// then simply lasts for the visit.
function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* nothing to do */ }
}

const systemQuery = () => window.matchMedia?.("(prefers-color-scheme: dark)");

// One theme for the whole app: farmers, vets, suppliers and admins share
// it, and so do the sign-in and policy pages. The first paint is handled
// by the small script in index.html, so there is no flash of the wrong
// theme while this loads; this keeps it right afterwards.
export function ThemeProvider({ children }) {
  const { profile, userEmail } = useAuth();
  const [preference, setPreferenceState] = useState(() => (isPreference(read(STORAGE_KEY)) ? read(STORAGE_KEY) : "system"));
  const [systemIsDark, setSystemIsDark] = useState(() => Boolean(systemQuery()?.matches));

  // The phone switching between light and dark (at sunset, say) is
  // followed at once when the preference is "system".
  useEffect(() => {
    const query = systemQuery();
    if (!query) return undefined;
    const onChange = (e) => setSystemIsDark(e.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // A choice made on another device arrives with the profile.
  const profilePreference = profile?.theme_preference;
  useEffect(() => {
    if (!userEmail || !isPreference(profilePreference)) return;
    const result = reconcile({ local: read(STORAGE_KEY), synced: read(SYNCED_KEY), profile: profilePreference });
    write(SYNCED_KEY, result.synced);
    write(STORAGE_KEY, result.preference === "system" ? null : result.preference);
    // adopting the stored choice of the person who just signed in
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferenceState(result.preference);
  }, [userEmail, profilePreference]);

  const theme = resolveTheme(preference, systemIsDark);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOUR[theme]);
  }, [theme]);

  const setPreference = useCallback(async (next) => {
    if (!isPreference(next)) return;
    setPreferenceState(next);
    write(STORAGE_KEY, next === "system" ? null : next);
    if (!userEmail) return;
    // Saved to the profile so it follows the person. A failed save is not
    // an error worth interrupting anyone for: the choice still holds here.
    const { error } = await supabase.from("farmer_profiles").update({ theme_preference: next }).eq("user_email", userEmail);
    if (!error) write(SYNCED_KEY, next);
  }, [userEmail]);

  const toggle = useCallback(() => setPreference(toggledPreference(theme)), [setPreference, theme]);

  const value = useMemo(() => ({ theme, preference, setPreference, toggle }), [theme, preference, setPreference, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
