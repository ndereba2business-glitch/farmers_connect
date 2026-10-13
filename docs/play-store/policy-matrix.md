# Google Play policy matrix

What each policy asks, whether it applies to Farmers Connect, what in the code answers it, and what is left.
Policies were read from Google's own pages on 12 and 13 October 2026; the wording quoted is theirs.

**This is a review of source code against published policy. It is not a prediction of what Google's review
will decide, and nothing here means the app has been approved.** Policies change: re-read the linked page
before submitting.

Status words used below:

- **Verified**: implemented and covered by a test that ran.
- **Built, not live**: implemented and tested, waiting on a deployment or a switch.
- **Owner**: needs a decision, a detail or an action only the owner can give.
- **Console**: can only be done in Play Console.
- **Legal**: should be reviewed by someone qualified.

## 1. User Data

Source: <https://support.google.com/googleplay/android-developer/answer/10144311>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| "All apps must post a privacy policy link in the designated field within Play Console" and a link or text within the app | Yes | `/privacy` (`src/pages/legal/PrivacyPolicy.jsx`); linked from every signed-in menu, the login page and the landing page | **Built, not live**: behind `POLICIES_PUBLISHED` | Publish it (set `VITE_POLICIES_PUBLISHED=true`), then enter the URL in Play Console | Yes: review, fill in legal name and contact, publish. **Legal** |
| The policy must name the developer and "a privacy point of contact or inquiry mechanism" | Yes | The request form on `/delete-account` is the inquiry mechanism and works today. `OPERATOR_LEGAL_NAME` and `CONTACT_EMAIL` are empty in `src/config/legal.js` | **Owner** | Fill in both | Yes |
| It must disclose data "accessed, collected, used, and shared", who it is shared with, secure handling, and "retention and deletion policy" | Yes | Policy sections 2 to 9; `data-audit.md` | Verified against the code | Confirm provider facts marked P in `data-safety-worksheet.md` | Yes (two provider facts) |
| Hosted on "an active, publicly accessible, non-geofenced URL"; "PDFs are not allowed" | Yes | An ordinary page of the web app | Built, not live | After publishing, open it in a private window, signed out | Yes |
| Prominent disclosure and consent "when access, collection, use, or sharing may fall outside the user's reasonable expectations"; consent must be an affirmative action and "data collection cannot begin until consent is granted" | Yes, for Clucky: a farm summary is attached to each question and sent to Google | "Before you ask Clucky" screen (`CluckyAI.jsx`); `clucky_consent_at`; the edge function refuses with `consent_required` | **Verified** in the app (`tests/e2e/safety.test.js`) and on the deployed function, which refused an account that had not agreed (`npm run test:clucky-live`, 13 October 2026) | None in code | No |
| "These requirements also apply to third-party AI integrations" | Yes: Gemini | The consent screen; policy section 6; no name, email or phone is sent (`buildFarmContext`) | Verified | Confirm which Gemini plan is in use | Yes |
| Third-party code and SDKs must comply and must not sell data | Limited | Six runtime dependencies, none collects data on its own account (`data-audit.md` section 2) | Verified by reading `package.json` | Re-check if a dependency is added | No |
| Account deletion in the app and by web link | Yes | Section 2 below | Verified | | |

## 2. Account deletion

Source: <https://support.google.com/googleplay/android-developer/answer/13327111>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| "provide users with an in-app path to delete their app accounts and associated data", prominent, such as in account settings | Yes: the app creates accounts | Profile > Delete my account, for every role (`DeleteAccountSection.jsx`) | **Verified**: `tests/e2e/account.test.js`; live on a throwaway account by `npm run test:account-live` | None | No |
| "provide a web link resource where users can request app account deletion and associated data deletion", usable "without sending the user back to the app", naming the app or developer | Yes | `/delete-account`: delete after signing in on the web, or send the request form if unable to sign in | **Verified** by tests; deployed with the app. Not behind the publish switch | Enter the URL in Play Console; check it signed out on a phone | **Console** |
| Deleting the account means deleting the data: "Temporary account deactivation, disabling, or 'freezing' the app account does not qualify" | Yes | `delete_account_data()` removes every row the account owns, then its files, then the login. The previous button only signed the person out | **Verified**: database checks D0 to D9; the live test shows the same email re-registers with nothing inherited | None | No |
| Retention for "security, fraud prevention, or regulatory compliance" must be disclosed | Yes | Four kept items, listed in the app before deletion, on `/delete-account` and in policy section 9 | Verified in text | **Legal**: confirm keeping a vet's reports in the farmer's record is acceptable under Kenyan veterinary and data law | Yes |
| Complete the data deletion questions in the Data safety form | Yes | `data-safety-worksheet.md` section 1 | **Console** | Fill in the form | Yes |

## 3. Data safety form

Source: <https://support.google.com/googleplay/android-developer/answer/10787469>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| Declare every data type collected or shared, including by libraries and web views | Yes | `data-safety-worksheet.md`, built from `data-audit.md` | Worksheet prepared, nothing submitted | Enter it in Play Console | **Console** |
| Answers must match the privacy policy | Yes | Both come from the same audit | Verified by cross-reading | Keep them in step when features change | No |
| Encryption in transit | Yes | All endpoints HTTPS | Verified | None | No |

## 4. User-generated content

Source: <https://support.google.com/googleplay/android-developer/answer/9876937>

The app has public UGC: a community group, marketplace listings, profiles and photos, visible to all
signed-in members.

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| "Requires users accept the app's terms of use and/or user policy before users can create or upload UGC" | Yes | Tick box at sign-up; `TermsGate` for existing and Google accounts; `terms_accepted_at` | **Built, not live** (publish switch) | Publish the terms | Yes |
| "Defines objectionable content and behaviors" and prohibits them in the terms | Yes | Terms section 3 (`PROHIBITED` in `src/config/legal.js`); group rules shown in the community | Built, not live | Review the list | Yes. **Legal** |
| "Conducts UGC moderation, as is reasonable" | Yes | Blocked words refused on send; rate limit; admin removal of messages and listings; posting pauses; verification of vets and suppliers | Verified (`security.sql` C and L checks) | Somebody has to do the reviewing: see `moderation-runbook.md` | **Yes, ongoing** |
| "in-app functionality to report users and content, and to block users" (public UGC apps) | Yes | Report a message, a listing, a member; block a member (`safety.js`, `ReportDialog.jsx`, `user_blocks`) | **Verified**: `tests/e2e/safety.test.js`, database checks R1 to R7 and B1 to B3 | None | No |
| Blocking for 1:1 features | Partly: farmer and vet messages are 1:1 | Blocking currently hides community messages and listings only | **Outstanding (minor)** | Decide whether a farmer should be able to block a vet in messages. A vet relationship starts with the farmer's own booking, which limits the risk | Decision |
| Safeguards so monetisation does not encourage bad behaviour | No | Nothing is paid for in the app | Not applicable | | |
| "Apps that continually fail to address user complaints" is a violation | Yes | Admin > Requests and Admin > Community show open reports | Tools verified | Review reports regularly | **Yes, ongoing** |
| Accurate content-rating answers about UGC | Yes | `store-listing.md` | **Console** | Answer "users can interact / share content": yes | Yes |

## 5. AI-generated content

Source: <https://support.google.com/googleplay/android-developer/answer/14094294>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| "Developers are responsible for ensuring that their generative AI apps do not generate offensive content" | Probably: the policy covers "Text-to-text AI chatbot apps, in which the AI generated chatbot interaction is a central feature". Clucky is one feature among many, so it may be out of scope; treat it as in scope | Clucky is limited to poultry farming and refuses other topics (`prompt.ts`); Google's own safety filters apply; an empty or filtered answer is shown as "couldn't answer" | Verified by unit tests and 8 real answers read on 12 October | None | No |
| A way for users to report offensive AI output without leaving the app | The page read on 13 October does not state this, though earlier versions of Google's guidance did. Built anyway | "Report this answer" under every answer (`content_reports`, kind `clucky_answer`) | **Verified** | None | No |
| Not misleading users | Yes | "AI answers can be wrong" under the chat; consent screen; terms section 7; no diagnosis, no doses, no seller recommendations | Verified in the prompt tests | None | No |

## 6. Target API level

Source: <https://support.google.com/googleplay/android-developer/answer/11926878>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| "New apps and app updates must target Android 16 (API level 36) or higher" from 31 August 2026 | Yes: a new submission after that date | Bubblewrap's current project template sets `compileSdkVersion 36` and `targetSdkVersion 36` (checked in its source on 13 October 2026) | **Not built**: no Android project exists yet and this machine has no Android tools | Generate the project and confirm the value in `app/build.gradle` (`android-release.md`) | Yes |

## 7. Testing requirement for new personal accounts

Source: <https://support.google.com/googleplay/android-developer/answer/14151465>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| Personal developer accounts created after 13 November 2023 must run a closed test with "a minimum of 12 testers who have been opted in continuously for at least 14 days" before applying for production | Yes, if the account is a personal one. Not if it is an organisation account | Nothing in code | **Console** | Decide the account type; recruit 12 testers with Google accounts; keep notes of their feedback for the production-access form | **Yes** |

## 8. Preparing for review

Source: <https://support.google.com/googleplay/android-developer/answer/9859455>

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| App access: "you must provide all required details to enable access" when sign-in is needed | Yes | All features are behind sign-in | **Owner** | Create a reviewer account for each role and enter them (`store-listing.md`, reviewer access) | **Yes** |
| Ads declaration | Yes | No ads, no ad SDK | Answer "No" | | Console |
| Target audience | Yes | Adults; 18+ stated in the terms | Select 18 and over | | Console |
| Content rating questionnaire | Yes | `store-listing.md` | Console | | Yes |
| Server-side consent check for Clucky | Internal item | The check is in `supabase/functions/clucky/index.ts` and is deployed | **Verified** live on 13 October 2026: `npm run test:clucky-live`, 6 of 6 | Redeploy the function whenever its code changes; merging to `main` does not deploy edge functions | No |

## 9. Trusted Web Activity

Source: <https://developer.chrome.com/docs/android/trusted-web-activity> (the developer.android.com address
in the brief returned "not found" on 13 October 2026)

| Requirement | Applies? | Evidence | Status | Left to do | Owner action? |
| --- | --- | --- | --- | --- | --- |
| The site and the app must be proven to belong to the same developer with Digital Asset Links | Yes | Needs the signing certificate's fingerprint, which exists only once a key does | **Not built** | Publish `/.well-known/assetlinks.json` with the fingerprint from Play Console | **Yes** |
| The site should meet the install criteria (a manifest with icons, served over HTTPS) | Yes | `public/manifest.webmanifest` with 192 and 512px icons and a maskable icon; HTTPS on Vercel | Verified by reading | Run Lighthouse's installability check on the production address | No |
| Chrome 72 or later; otherwise "Chrome will fall back to a simple toolbar using a Custom Tab" | Yes | Nothing to build | Understood | None | No |
| A service worker or offline support | Not stated as a requirement on the page read | The project deliberately has none (`CLAUDE.md`) | No conflict found | If Play review asks for offline behaviour, the app shows retry-capable error states, not a blank page | No |
