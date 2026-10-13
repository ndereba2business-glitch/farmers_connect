// The rules for choosing a new password, and the words shown when a reset
// goes wrong. No imports, so it is unit tested (tests/unit/passwordRules.test.js).

export const MIN_PASSWORD_LENGTH = 8;

// Returns what is wrong with a new password, or "" when it is acceptable.
// Deliberately few rules: length is what makes a password hard to guess,
// and a farmer on a small phone keyboard should not be fighting demands
// for symbols.
export function passwordProblem(password, repeat) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (value.trim() !== value) return "A password cannot start or end with a space.";
  if (/^(.)\1+$/.test(value) || /^(?:0?1234567890?|12345678|87654321|password|qwertyui|11111111)$/i.test(value)) {
    return "That password is too easy to guess. Choose another.";
  }
  if (repeat !== undefined && value !== String(repeat)) return "The two passwords are not the same.";
  return "";
}

// What to say after asking for a reset link. The same sentence whether or
// not the address has an account, so the form cannot be used to find out
// who has one. Only "slow down" is different, because the person can act
// on it.
export function resetRequestMessage(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (error?.status === 429 || /rate limit|too many|over_email_send_rate_limit/.test(text)) {
    return { ok: false, message: "Too many reset emails have been requested. Wait an hour, then try again." };
  }
  return {
    ok: true,
    message: "If an account uses that email address, a link to choose a new password is on its way. It can take a few minutes; check your spam folder too."
  };
}

export function passwordUpdateMessage(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (/same_password|different from the old/.test(text)) return "That is your current password. Choose a different one.";
  if (/weak|at least|should be/.test(text)) return `That password is not strong enough. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (/session|jwt|not authenticated|expired/.test(text)) return "This link has expired or was already used. Ask for a new one.";
  return "Your password was not changed. Check your connection and try again.";
}
