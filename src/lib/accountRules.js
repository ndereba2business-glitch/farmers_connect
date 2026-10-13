// The words and small decisions around deleting an account, free of React
// and Supabase so they can be unit tested (tests/unit/accountDeletion.test.js).
// src/lib/account.js adds the two network calls.

// The word typed to confirm. The delete-account function checks the same string.
export const CONFIRM_WORD = "DELETE";

// True when the account signs in with a password (an email or phone
// sign-up). A Google-only account has no password to ask for, so it has
// to sign in again shortly before deleting instead.
export function hasPassword(user) {
  const providers = (user?.identities || []).map(i => i.provider);
  if (providers.length === 0) return !!(user?.email || user?.phone) && user?.app_metadata?.provider !== "google";
  return providers.includes("email") || providers.includes("phone");
}

// What is removed and what stays, in the words shown before deleting.
// One list, used by the in-app section, the public page and the policy,
// so the three can never disagree.
export const DELETED_ITEMS = [
  "Your login, name, phone number, county, photo and profile",
  "Your batches, vaccinations, deaths, expenses, sales, tasks, feed calculations and gallery photos",
  "Your marketplace listings and their photos, and your supplier profile if you have one",
  "Your community messages, photos and reactions",
  "Your questions to vets, your bookings, your messages with vets, and the reports and prescriptions vets wrote for you",
  "Your conversation with Clucky, your notifications and your settings",
  "Your vet profile, availability and blocked dates if you are a vet"
];

export const KEPT_ITEMS = [
  "If you are a vet: visit reports, prescriptions and lab results you wrote stay in the farmer's own records, because they are that farmer's flock-health history. Your name, email and account are removed from them.",
  "Answers you gave to a farmer's question stay with their question, without your name.",
  "Other members' replies to your community messages stay, shown as replies to a former member, without your words.",
  "A record that an account was deleted on that date, with no name, email or phone number."
];

// A code from the delete-account function, as words a person can act on.
export function deleteErrorMessage(code) {
  switch (code) {
    case "wrong_password":
      return "That password is not right. Check it and try again.";
    case "reauth_required":
      return "For your safety, sign out, sign in again, and delete your account within ten minutes of signing in.";
    case "confirm_required":
      return `Type ${CONFIRM_WORD} in capital letters to confirm.`;
    case "admin_account":
      return "An admin account cannot be deleted here. It is removed by the project owner.";
    case "not_signed_in":
      return "You are signed out. Sign in again, then delete your account.";
    case "login_not_removed":
      return "Your data was deleted, but your login could not be removed. Tap Delete again to finish.";
    case "not_found":
      return "No account uses that email or phone number.";
    case "not_allowed":
      return "Only an administrator can delete another person's account.";
    default:
      return "Your account was not deleted. Check your connection and try again. Nothing has been removed.";
  }
}

export function requestErrorMessage(code) {
  switch (code) {
    case "bad_identity":
      return "Enter the email address or phone number your account uses.";
    case "too_long":
      return "That message is too long. Keep it under 1,000 characters.";
    case "busy":
      return "We are receiving a lot of requests. Please try again in an hour.";
    default:
      return "Your request was not sent. Check your connection and try again.";
  }
}
