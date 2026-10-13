# Data audit: what Farmers Connect holds about people

Written from the code and the live database schema on 12 October 2026. This is the evidence behind the
privacy policy (`src/pages/legal/PrivacyPolicy.jsx`) and the Data safety worksheet
(`data-safety-worksheet.md`). If a feature changes what is collected or who receives it, update this file,
the policy and the worksheet in the same pull request.

Each row says where the fact comes from, so it can be checked again.

## 1. How people are identified

- Accounts live in Supabase Auth. A person signs up with an email and password, a phone number and
  password, or Google.
- Rows in the database are owned in two ways: by the auth user id (`user_id`, `farmer_id`, `vet_id`), and,
  in most of the older tables, by the **account identity**: the email address, or the phone number for
  phone-only accounts (`user_email`). `public.request_identity()` returns it inside the database.
- Consequence: deleting only the login leaves most of a person's data behind, and a later sign-up with the
  same email would inherit it. Account deletion therefore removes both kinds
  (`delete_account_data()`, migration `20261013100000`).

## 2. What is collected

| # | Data | Where it is stored | Required? | Why | Who can read it (database rules) |
| --- | --- | --- | --- | --- | --- |
| 1 | Name, email or phone, hashed password, chosen role; for Google sign-in the name, email and photo Google returns | `auth.users` (+ `auth.identities`) | Yes | To have an account | The person; admins through the Supabase dashboard only |
| 2 | Profile: name, phone, county, farm name, farm type and size, bio, avatar; onboarding, notification, terms and Clucky consent flags | `farmer_profiles` (every role has one) | Name yes; the rest optional | Personalising the app; contact; consent records | Owner; admins; verified vets; a vet with an appointment with that farmer |
| 3 | Flock records: batches, vaccination tasks, mortality logs, expenses, sales (free-text buyer name), tasks, finances, feed calculations | `farm_batches`, `vaccination_tasks`, `mortality_logs`, `batch_expenses`, `batch_sales`, `farm_tasks`, `farm_finances`, `feed_calculations` | Optional | The record-keeping the app exists for | Owner only |
| 4 | Gallery photos and captions | `farm_gallery` + bucket `farm-gallery` | Optional | Farm photo record | Rows: owner only. **Files: public bucket**, readable by anyone holding the URL |
| 5 | Questions to vets (text, optional photo, emergency flag), answers | `vet_questions` | Optional | Ask Vet | Owner; verified vets for emergency questions |
| 6 | Vet bookings: farm name, county, bird count, date, reason, fee, status | `vet_appointments` | Optional | Booking a visit | The farmer and the vet involved |
| 7 | Visit reports (symptoms, diagnosis, treatment, medicines), prescriptions and lab results, including an uploaded file | `visit_records`, `vet_medical_records` + private bucket `lab-results` | Optional | The farmer's flock-health history | The farmer and the vet involved |
| 8 | Messages between a farmer and a vet | `vet_farmer_messages` | Optional | Follow-up on a visit | The two parties |
| 9 | Vet profile: name, bio, photo, licence number, counties, specialisms, fee, hours, email | `vet_profiles`, `vet_blocked_dates` | Required to act as a vet | Verification and discovery | Owner and admins; verified profiles to signed-in users |
| 10 | Supplier profile: business name, phone, WhatsApp, county, location, hours, logo, description, categories | `supplier_profiles` | Required to list as a supplier | Verification and discovery | Owner and admins; verified profiles to signed-in users |
| 11 | Marketplace listings: name, category, price, stock, photo, county, location, seller phone, description | `products` + bucket `marketplace-images` | Optional | The marketplace | Any signed-in user (active listings); files public by URL |
| 12 | Community messages, photos, reactions | `community_chat`, `message_reactions` + bucket `community-posts` | Optional | The community group | Any signed-in user; files public by URL |
| 13 | Reports and moderation: reports on messages, on listings, answers and members; pauses; blocked words; a person's own block list | `community_reports`, `content_reports`, `community_mutes`, `community_blocked_terms`, `user_blocks` | Created by use | Safety and moderation | Reporter sees own reports; admins see all; a block list is visible only to its owner |
| 14 | Clucky conversation: questions and answers | `clucky_messages` | Optional, after consent | So the conversation can be read again and followed up | Owner only (written by the edge function) |
| 15 | Clucky usage: questions and token counts per day | `clucky_usage`, `clucky_service_days` | Created by use | Daily limit and cost control | Nobody through the app; edge function only |
| 16 | Contact events: that a user tapped Call or WhatsApp on a listing or supplier, on which day | `contact_events` | Created by use | Counts shown to suppliers and admins | Nobody can read rows; suppliers and admins get counts only |
| 17 | Notifications and preferences | `notifications`, `notification_preferences` | Created by use | In-app notifications | Owner only |
| 18 | Orders: product, quantity, customer name, phone, county | `orders` | **Not collected today** (`IN_APP_ORDERING = false`) | Future in-app ordering | Buyer and supplier |
| 19 | Deletion and privacy requests from the public form: the email or phone typed, an optional message | `account_requests` | Only if the form is used | So someone who cannot sign in can be helped | Admins only |
| 20 | Deletion log: date, method, role, row counts. No identity | `account_deletions` | Created on deletion | Evidence that deletions happen | Admins only |
| 21 | Session token | The browser's `localStorage` | Yes | Staying signed in | The device |
| 22 | Server logs: IP address, user agent, request path, time | Supabase and Vercel | Unavoidable | Security and fault-finding | Project owner through provider dashboards |

### Not collected

Checked by searching the source for the relevant browser APIs and SDKs:

- **Precise or approximate location.** No `navigator.geolocation` call anywhere. "County" is typed by the user.
- **Contacts, SMS, call logs, calendar, microphone, files outside a chosen photo.**
- **Payment data.** No payment provider is integrated; no card or M-Pesa data is taken.
- **Advertising ID, analytics, crash reporting.** `package.json` has six runtime dependencies
  (`@supabase/supabase-js`, `react`, `react-dom`, `react-router-dom`, `lucide-react`, `recharts`); none is an
  analytics, advertising or crash SDK.
- **Cookies for tracking.** None set by the app.

## 3. Where data goes outside the project

| Recipient | What it receives | When | Evidence |
| --- | --- | --- | --- |
| **Supabase** (database, auth, file storage, edge functions) | Everything in section 2 | Always | `src/lib/supabaseClient.js`; all tables |
| **Vercel** (hosting) | Request logs: IP address, user agent | Always | `vercel.json`; merge to `main` deploys |
| **Google Gemini API** | The question typed; up to 12 earlier messages of the conversation; the county; active batches (name, type, count, age); overdue vaccinations. **Not** the name, email, phone or farm name | Only when a person asks Clucky, and only after they have agreed | `supabase/functions/clucky/index.ts` (`buildFarmContext`, consent check); `prompt.ts`; request sent with `store: false` |
| **Google sign-in** | That the person signed in to this app (standard OAuth) | Only if the person chooses Google | `src/components/GoogleButton.jsx` |
| **Google Fonts** | IP address and user agent, when the stylesheet and font files are fetched | Every first load | `index.html` (`fonts.googleapis.com`) |
| **WhatsApp / the phone dialler** | Whatever the person does there. The app opens `wa.me` or `tel:` with a pre-written message | Only when the person taps Call or WhatsApp | `src/lib/contactSupplier.js` |

Nothing is sold, and nothing is sent to an advertising or analytics company.

### The Gemini integration in detail

- Personal data sent by design: none. County and flock data are about the farm, not directly identifying,
  but combined with a small county they could narrow down a person, so they are disclosed as shared.
- Personal data sent by accident: anything the person types into the question. The consent screen and the
  policy both say not to type private details.
- Consent: recorded as `farmer_profiles.clucky_consent_at`. The edge function returns `consent_required`
  (HTTP 403) while it is null, before the daily allowance is touched. Tested in
  `tests/e2e/safety.test.js` and `tests/live/clucky.live.test.js`.
- **Needs the owner's confirmation:** which Gemini plan the key is on. On Google's unpaid tier, Google's
  terms allow prompts and answers to be used to improve its products and to be read by reviewers; on the
  paid tier they are not used that way. The privacy policy is written to cover the unpaid case. If you move
  to the paid tier you may soften that paragraph; do not soften it before.

## 4. Protection

| Question | Answer | Status |
| --- | --- | --- |
| Encrypted in transit? | Yes. The app, Supabase and the Gemini API are HTTPS only | Verified: all endpoints are `https://`; Vercel and Supabase do not serve plain HTTP |
| Encrypted at rest? | Supabase states that it encrypts databases and storage at rest | **Provider claim: confirm in Supabase's current security documentation** before declaring it |
| Access control | Row-level security on every table, a restrictive rule refusing anonymous sessions, no access for visitors | Verified by `supabase/tests/security.sql` (check H14 fails if any table lacks it) |
| Secrets | The Gemini key and the service-role key exist only as edge function secrets | Verified by `npm run check:secrets` |
| Where is it stored? | The Supabase project's region | **Owner to confirm** in the Supabase dashboard (Project settings > General) and state it in the policy if it is outside Kenya |

## 5. Retention and deletion

| Data | Kept until |
| --- | --- |
| Account and everything it owns | The person deletes it, or deletes the account |
| A removed community message | Text and photo erased at once; an empty marker stays so replies make sense |
| A removed listing | Deleted at once, with its photo |
| Clucky conversation | The person taps "New chat", or deletes the account |
| Resolved deletion and privacy requests | 90 days after being resolved (cleared by the `account-request` function) |
| Deletion log | Indefinitely; it holds no identity |
| Provider logs and backups | The provider's own schedule. **Confirm the backup retention of your Supabase plan** |

Account deletion (`delete-account` edge function, then `delete_account_data()`):

1. Deletes every row the account owns, in one transaction.
2. Deletes the account's files from storage.
3. Deletes the login.

Kept deliberately, and disclosed: a visit report, prescription or lab result a vet wrote stays in the
farmer's records when the vet leaves, with the vet's id and email removed; answers a vet gave stay with the
farmer's question; other members' replies stay without the quoted text; the deletion log.

Known limit: an access token already issued stays valid for up to one hour after deletion. The data is
gone, so there is nothing to read, but a second device could in theory write a new row in that hour. It
would be orphaned and harmless; see `security-audit.md`.

## 6. Where people are told, and where they agree

| Moment | What they are told | Where |
| --- | --- | --- |
| Creating an account | Terms and Community Rules, Privacy Policy, age 18+; a required tick box | `src/pages/Signup.jsx` |
| First use for an existing or Google account | The same, in a dialog that cannot be skipped | `src/components/TermsGate.jsx` |
| First question to Clucky | That answers come from Google's Gemini, what is sent, what is not, that it can be wrong; a button to agree | `src/pages/CluckyAI.jsx` (the `ac-consent` section) |
| Uploading a photo | The policy states photos have unlisted public links | `/privacy` section 4 |
| Any time | Privacy and Terms links at the foot of every signed-in menu, on the login page and the landing page | `Layout.jsx`, `SupplierShell.jsx`, `Login.jsx`, `LandingFooter.jsx` |
