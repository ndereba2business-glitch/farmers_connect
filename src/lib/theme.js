// Light and dark theme: the rules, with no React and no Supabase, so they
// are unit tested (tests/unit/theme.test.js). ThemeContext.jsx applies them.
//
// A person's choice is one of three PREFERENCES: "light", "dark", or
// "system" (follow the phone). What is drawn is one of two THEMES.
//
// Where the preference comes from, strongest first:
//   1. the signed-in person's profile (so it follows them between devices),
//   2. what this browser remembers,
//   3. the phone's own setting.

export const PREFERENCES = ["light", "dark", "system"];
export const STORAGE_KEY = "fc-theme";
// The last value this browser took from (or saved to) the profile.
export const SYNCED_KEY = "fc-theme-synced";

// The colour of the browser's own bar around the app, per theme.
export const BAR_COLOUR = { light: "#14532d", dark: "#0f1512" };

export const isPreference = (value) => PREFERENCES.includes(value);

export function resolveTheme(preference, systemIsDark) {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemIsDark ? "dark" : "light";
}

// The sun/moon button flips what is on screen: it always results in an
// explicit choice, never "system".
export function toggledPreference(currentTheme) {
  return currentTheme === "dark" ? "light" : "dark";
}

// Decides which preference wins when the profile has loaded.
//
// The profile wins only when its value is NEWS to this browser, that is,
// when it differs from the value this browser last synced. That covers
// both cases that matter: a choice made on another device arrives here,
// and a choice made here while the save failed (no connection) is not
// thrown away by the older value still sitting in the profile.
export function reconcile({ local, synced, profile }) {
  const mine = isPreference(local) ? local : "system";
  if (!isPreference(profile)) return { preference: mine, synced: isPreference(synced) ? synced : null };
  if (profile !== synced) return { preference: profile, synced: profile };
  return { preference: mine, synced };
}
