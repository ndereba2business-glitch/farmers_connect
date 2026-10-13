// The facts the policy pages state about who runs Farmers Connect.
//
// OWNER: the three values marked "owner to provide" are deliberately empty.
// Nothing is invented here: a policy page shows a line only when its value
// is filled in, and until then people reach you through the request form
// on /delete-account, which lands in Admin > Requests.
// Fill them in before the Play Store submission (docs/play-store/).

export const APP_NAME = "Farmers Connect";

// Owner to provide: the registered business or the person legally
// responsible for the app, exactly as it will appear on the Play listing.
export const OPERATOR_LEGAL_NAME = "";

// Owner to provide: an inbox that is read. Shown on the privacy policy,
// the terms and the deletion page when set.
export const CONTACT_EMAIL = "";

// Owner to provide (optional): a postal address, if you want one shown.
export const POSTAL_ADDRESS = "";

// Change these dates when the documents change in a way people should be
// asked to accept again. TERMS_VERSION is saved with each acceptance.
export const TERMS_VERSION = "2026-10-12";
export const PRIVACY_UPDATED = "12 October 2026";
export const TERMS_UPDATED = "12 October 2026";

// The youngest a person may be to hold an account.
export const MINIMUM_AGE = 18;

export const operatorName = () => OPERATOR_LEGAL_NAME || APP_NAME;

// What is not allowed anywhere people can post: the community group,
// marketplace listings, profiles and photos. Shown in the Terms; keep the
// short version in TermsGate.jsx and GROUP_RULES (src/lib/community.js)
// in step with it.
export const PROHIBITED = [
  "Insults, threats, harassment or hate aimed at any person or group",
  "Sexual content, and anything that sexualises or endangers children",
  "Scams and misleading offers: fake listings, false prices, products you do not have, pretending to be someone else or to be a vet",
  "Betting, loan apps, forex, crypto, pyramid schemes and other get-rich-quick offers",
  "Selling things that are illegal or unsafe: stolen birds, sick or dead birds for food, expired or counterfeit medicines and vaccines, medicines that need a vet's prescription",
  "Dangerous advice presented as fact, such as medicine doses or cures you cannot stand behind",
  "Other people's private information, such as a phone number or ID posted without their agreement",
  "Spam, and anything that has nothing to do with poultry farming"
];
