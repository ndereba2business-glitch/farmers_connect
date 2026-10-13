# Store listing preparation

Drafts and checklists for the Play Console listing. Everything here is a suggestion for the owner to edit.
Nothing has been entered in Play Console, and there is no developer account yet as far as this repository
knows.

Items marked **CONFIRM** must be checked or supplied by the owner before publication. Nothing below claims
a number of users, a rating, a review, a registration or a veterinary endorsement, because none is known.

## 1. Title and descriptions

| Field | Limit | Draft |
| --- | --- | --- |
| App name | 30 characters | `Farmers Connect: Poultry` (24) |
| Short description | 80 characters | `Flock records, vets, suppliers and other poultry farmers, in one place.` (71) |

**CONFIRM** the name is free on Google Play and is the name you want. "Farmers Connect" is a common phrase:
search the store before settling, and consider whether it is a name you can protect.

### Full description (draft, about 1,500 of 4,000 characters)

```
Farmers Connect is for poultry farmers in Kenya who keep broilers, layers or kienyeji chickens, and for
the vets and suppliers who serve them.

KEEP YOUR FLOCK RECORDS
• Record each batch: type, number of birds, hatch date.
• Get a vaccination schedule for each batch and tick vaccinations off as you give them.
• Log deaths, expenses and sales, and see what each batch cost and earned.
• Plan feed with a week-by-week feed calculator.
• Keep tasks and a photo gallery of your farm.

REACH A VET
• Ask a question and attach a photo.
• Use the Emergency button when birds are dying or falling ill fast.
• Book a farm visit with a vet whose profile our team has reviewed and approved.
• Keep the visit reports and prescriptions your vet writes, in one place.

FIND SUPPLIERS AND SELL
• Browse feeds, chicks, medicine and equipment listed by suppliers and other farmers.
• Call or WhatsApp the seller directly. You agree the price and delivery with them: no money moves
  through the app.
• List your own birds, eggs or products.

LEARN FROM OTHER FARMERS
• One community group for poultry farmers, with clear rules.
• Report anything that does not belong, and block members you do not want to hear from.

ASK CLUCKY
• Clucky is an AI assistant for poultry questions: feeding, housing, vaccination, costs.
• Clucky is a computer program, not a vet. Its answers can be wrong. For sick or dying birds, ask a vet.

GOOD TO KNOW
• Needs an internet connection.
• Built for small Android phones and slow mobile data.
• You can delete your account and your data at any time from your profile.
• No adverts.
```

Rules this draft follows, and that edits should keep to:

- Every feature named exists in the app today. In-app ordering and payments are **not** mentioned: they are
  switched off.
- "Reviewed and approved by our team" is what verification is. Do not write "certified", "licensed by" or
  "guaranteed".
- The Clucky lines say it can be wrong. Google's policy on misleading claims and on AI content both point
  the same way: do not describe it as a vet, a diagnosis tool or as accurate.
- No "best", "#1", "trusted by thousands", user counts or testimonials.

## 2. Graphics

| Asset | Requirement (**CONFIRM** against Play Console when uploading) | State |
| --- | --- | --- |
| App icon | 512 x 512 px, 32-bit PNG, up to 1 MB | Exists: `public/icons/icon-512.png` (the rooster mark). Regenerate with `node scripts/build-icons.mjs` |
| Feature graphic | 1024 x 500 px, JPEG or 24-bit PNG, no transparency | **To make.** Use the brand mark and the name on the brand green; no photograph is needed |
| Phone screenshots | At least 2, up to 8. JPEG or 24-bit PNG, each side between 320 and 3,840 px, the long side no more than twice the short side | **To make.** See below |
| 7-inch and 10-inch tablet screenshots | Optional, recommended if you list tablet support | Optional |

### Screenshots

Take them from the real app on a real phone, signed in to an account with real or realistic records.
Suggested set of six, in this order:

1. Farmer dashboard with active batches and vaccines due.
2. My Farm: a batch with its vaccination schedule.
3. Ask Vet: the vets list or a question with its answer.
4. Marketplace: listings with Call and WhatsApp.
5. Community group.
6. Clucky answering a feeding question.

Do not use a screenshot that shows another real person's name, phone number, message or photo without
their agreement. Use a test account, or blur. Do not add badges such as "No. 1" or prices that are not real.

## 3. Categorisation and contact details

| Field | Suggestion |
| --- | --- |
| App or game | App |
| Category | Business (alternative: Productivity). **CONFIRM** |
| Tags | Agriculture-related tags offered by Play Console |
| Email address (public, required) | **CONFIRM: owner to supply.** It is shown on the listing |
| Phone number, website | Optional. The website can be the production address |
| Privacy policy URL | `https://<production domain>/privacy`, once published |

### Support contact checklist

- [ ] An email inbox that is read at least every working day. It will be public.
- [ ] The same address in `CONTACT_EMAIL` in `src/config/legal.js`, so the policy pages show it.
- [ ] Someone checks Admin > Requests (deletion and privacy requests) and Admin > Community (reports):
      see `moderation-runbook.md`.
- [ ] A decision on who answers when the owner is away.

## 4. Content rating questionnaire (preparation)

The questionnaire is filled in inside Play Console and produces the rating; these are the facts to answer
from. Answer the questions as they are worded on the day, not from this table.

| Topic | Fact about the app |
| --- | --- |
| Violence, blood, gore | None produced by the app. Farmers may describe or photograph sick or dead poultry in questions to vets and in the community |
| Sexual content, nudity | None. Prohibited by the terms |
| Profanity | Not produced by the app. User content is moderated; some words are refused automatically |
| Drugs, alcohol, tobacco | None. Veterinary medicines for poultry are discussed and listed for sale by suppliers. Mention this if a question asks about references to drugs |
| Gambling | None. Betting adverts are prohibited and blocked |
| Users can interact or exchange content | **Yes**: a community group, marketplace listings, messages between farmers and vets |
| Users can share their location | **No.** A county is typed as text |
| Users can make purchases | **No** digital purchases; no payments in the app |
| Unrestricted internet access | No general browser. Links open outside the app |
| AI-generated content | **Yes**: Clucky, a text assistant limited to poultry farming, with reporting |

Expect a low age rating with an interactive-elements notice ("Users Interact"). **CONFIRM** the result
Play Console shows.

## 5. Target audience

- **Target age: 18 and over.** The terms require it, and the app is a work tool for people running farms.
- Do not select any age band under 18. Doing so brings in the Families policy, which the app is not
  designed for.
- The store listing and screenshots should not be designed to appeal to children. A cartoon chicken alone
  can count against this: the current brand mark is a plain rooster's head, which is fine. Keep Clucky's
  presentation adult and practical in the screenshots.

## 6. Ads

**Does the app contain ads? No.** There is no advertising SDK and no advert placement. Supplier listings
are marketplace content that suppliers enter themselves, not paid advertising, and nobody pays to be
listed. If paid placement is ever introduced, this declaration changes.

## 7. Permissions and SDK inventory

### Android permissions

A Trusted Web Activity built from `android/twa-manifest.json` requests **no dangerous permission**.
**CONFIRM** by reading the generated `AndroidManifest.xml` (`android-release.md`).

| Capability | How the app does it | Android permission |
| --- | --- | --- |
| Internet | Chrome loads the site | None declared by the app beyond what a TWA needs |
| Add a photo | The browser's file picker, which can offer the camera | None for the app |
| Notifications | In-app only | None. Notification delegation is off |
| Location | Not used | None |
| Contacts, SMS, phone, microphone, storage | Not used | None |

### Code that ships to the device

| Library | Purpose | Sends data anywhere by itself? |
| --- | --- | --- |
| `@supabase/supabase-js` | Talks to the project's own backend | Only to the project's Supabase address |
| `react`, `react-dom`, `react-router-dom` | The interface | No |
| `lucide-react` | Icons | No |
| `recharts` | The dashboard chart | No |
| Google Fonts (a stylesheet link in `index.html`) | The typeface | The browser fetches it from Google, which sees the IP address |
| `androidbrowserhelper` (added by Bubblewrap to the Android project) | Launches the TWA | No user data |

No analytics, crash reporting, advertising or payment SDK. Services used on the server side (Supabase,
Vercel, Google Gemini) are in `data-audit.md`.

## 8. Reviewer access

Every feature is behind sign-in, so Google's reviewers need accounts. In Play Console: App content > App
access > "All or some functionality is restricted", then add instructions. Up to five sets are allowed.

**Owner to create these accounts on the production project, with passwords of your own choosing, and never
commit them to the repository:**

| Account | How to make it | What the reviewer should see |
| --- | --- | --- |
| Farmer | Sign up with an email you control, role Farmer. Add one batch, so the dashboard is not empty | Dashboard, My Farm, Ask Vet, Marketplace, Community, Clucky, Profile > Delete my account |
| Vet | Sign up as Vet, complete the vet profile, then approve it from your admin account | Vet dashboard, appointments, community |
| Supplier | Sign up as Supplier, complete the supplier profile, approve it as admin, add one product | Supplier dashboard, products, community |

Notes to give the reviewer (edit to match):

```
Farmers Connect is a web app shown in a Trusted Web Activity. All features need a sign-in.
Farmer:   <email> / <password>
Vet:      <email> / <password>
Supplier: <email> / <password>
No one-time code or second factor is required. Sign-in with Google is also offered but is not needed.
Account deletion: Profile > Delete my account, or https://<production domain>/delete-account.
Reporting and blocking: tap any message in Community; "Report this listing" on a Marketplace listing;
"Report this answer" under an answer from Clucky.
Clucky (AI assistant) asks for consent before the first question, then answers poultry questions only.
```

Do not give reviewers the admin account. If Google asks to see moderation, describe it and offer a video.

Keep these accounts working for as long as the app is listed: reviews happen again with every update.

## 9. Testing and production access

Depends on the developer account, which does not exist yet as far as this repository knows.

| Step | Detail |
| --- | --- |
| Create the developer account | A one-time registration fee and identity verification. **Owner only** |
| Choose personal or organisation | An organisation account needs a D-U-N-S number and avoids the closed-test rule below |
| If personal and created after 13 November 2023 | A closed test with at least 12 testers opted in continuously for at least 14 days, before applying for production access |
| Recruiting testers | Each needs a Google account and an Android phone. Farmers, vets and suppliers who already use the web app are the natural group. Send them the opt-in link from Play Console |
| What to record during the test | How testers were found, which features they used, what they reported, what was changed. The production-access form asks for exactly this |
| Then | Apply for production access, answer the form, wait for Google's review |

A sensible order: internal testing (the owner's own phones) > closed testing (12 or more people, 14 days) >
production.
