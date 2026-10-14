// What to tell someone when signing up or logging in does not simply work,
// most of all when the project asks new members to confirm their email
// address first. No imports, so it is unit tested (tests/unit/authMessages.test.js).

const describe = error => `${error?.code || ""} ${error?.name || ""} ${error?.message || ""}`.toLowerCase();

// Where the confirmation link brings people back to. "/" sends each role to
// its own home once the link has signed them in. Supabase honours it only
// if the address is on its Redirect URLs list (npm run check:auth-urls).
export function confirmationRedirect(origin) {
  return `${String(origin || "").replace(/\/+$/, "")}/`;
}

// Supabase answers a sign-up without a session when the address has to be
// confirmed first. It answers the same way, on purpose, when the address
// already has an account, so the two cases cannot be told apart here.
export function needsEmailConfirmation(data) {
  return !!data?.user && !data?.session;
}

export function isUnconfirmedEmail(error) {
  return /email_not_confirmed|email not confirmed/.test(describe(error));
}

function isRateLimited(error) {
  return error?.status === 429 || /rate limit|too many|over_email_send_rate_limit|over_request_rate_limit/.test(describe(error));
}

function isOffline(error) {
  return /failed to fetch|networkerror|network request failed|load failed|authretryablefetcherror/.test(describe(error));
}

export function signInErrorMessage(error, method = "email") {
  if (!error) return "";
  if (isUnconfirmedEmail(error)) {
    return "Confirm your email address first: open the link we sent when you signed up. Can't find it? Check your spam folder, or send it again below.";
  }
  if (/invalid_credentials|invalid login credentials|invalid_grant/.test(describe(error))) {
    return method === "phone"
      ? "That phone number and password don't match an account. Check both, or reset your password."
      : "That email address and password don't match an account. Check both, or reset your password.";
  }
  if (isRateLimited(error)) return "Too many attempts just now. Wait a few minutes, then try again.";
  if (isOffline(error)) return "Could not reach Farmers Connect. Check your connection and try again.";
  return error.message || "Logging in did not work. Try again.";
}

export function signUpErrorMessage(error) {
  if (!error) return "";
  if (/user_already_exists|already registered|already been registered/.test(describe(error))) {
    return "An account already uses that email address or phone number. Log in instead, or reset your password.";
  }
  if (/weak_password|password should be|at least/.test(describe(error))) {
    return "That password is too short or too easy to guess. Use at least 8 characters.";
  }
  if (isRateLimited(error)) return "Too many sign-ups were attempted just now. Wait a few minutes, then try again.";
  if (isOffline(error)) return "Could not reach Farmers Connect. Check your connection and try again; what you typed is still here.";
  return error.message || "Your account was not created. Try again.";
}

// After asking for the confirmation email again.
export function resendMessage(error) {
  if (!error) return { ok: true, message: "A new link is on its way. It can take a few minutes; check your spam folder too." };
  if (isRateLimited(error)) return { ok: false, message: "Too many emails were sent to this address just now. Wait an hour, then try again." };
  if (isOffline(error)) return { ok: false, message: "Could not reach Farmers Connect. Check your connection and try again." };
  return { ok: false, message: "The link could not be sent. Try again in a few minutes." };
}
