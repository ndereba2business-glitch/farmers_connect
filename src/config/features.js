// In-app ordering (cart -> order request -> supplier confirms) is hidden for
// the MVP: farmers contact suppliers by phone/WhatsApp and negotiate. The
// database side (orders, place_order) is kept, so switching this back on
// only brings the UI back.
export const IN_APP_ORDERING = false;

// The Privacy Policy and the Terms and Community Rules are written and
// tested, but they are legal documents: they are shown to nobody, and
// nobody is asked to accept them, until the owner has read them (ideally
// with a lawyer), filled in src/config/legal.js, and switched this on.
//
// OWNER: to publish, set the environment variable
//   VITE_POLICIES_PUBLISHED=true
// in Vercel (Project > Settings > Environment Variables, Production) and
// redeploy. From then on /privacy and /terms are public, every menu links
// to them, sign-up has the acceptance tick box, and each existing account
// is asked once to accept. Nothing secret: it is a public on/off flag.
//
// Off or on, account deletion, the /delete-account page, reporting,
// blocking and the Clucky consent screen all work.
export const POLICIES_PUBLISHED = import.meta.env?.VITE_POLICIES_PUBLISHED === "true";
