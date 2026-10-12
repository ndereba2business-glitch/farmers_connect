// What to tell someone whose sign-in came back refused.
//
// When Google sign-in (or an emailed link) fails, Supabase sends the
// browser back to the app with the reason in the address, for example
//   /?error=access_denied&error_code=signup_disabled&error_description=...
// and signs nobody in. Without this the person just sees the landing page
// again and cannot tell that anything went wrong.
//
// No imports, so it can be unit tested.

const TRY_ANOTHER_WAY = "Please try again, or log in with your email or phone number.";

const MESSAGES = {
  signup_disabled: "New accounts can't be created right now. Please try again later.",
  user_banned: "This account has been paused. Contact support if you think this is a mistake.",
  otp_expired: "That sign-in link has expired or was already used. Please log in again.",
  access_denied: `Google sign-in was cancelled or refused. ${TRY_ANOTHER_WAY}`
};

const FALLBACK = `Sign-in did not finish. ${TRY_ANOTHER_WAY}`;

// Returns a message, or null when the address carries no sign-in error.
// The message is always one of ours: `error_description` is never shown,
// because anyone can put any text they like in a link.
export function readSignInProblem(href) {
  let url;
  try { url = new URL(href); } catch { return null; }

  // Supabase repeats the error after the "#"; read both places.
  const params = new URLSearchParams(url.search);
  for (const [key, value] of new URLSearchParams(url.hash.replace(/^#/, ""))) params.set(key, value);

  const error = params.get("error");
  const code = params.get("error_code");
  if (!error && !code) return null;

  return MESSAGES[code] || MESSAGES[error] || FALLBACK;
}
