# Farmers Connect

A web app for Kenyan poultry farmers, the vets who look after their flocks and
the suppliers who sell them feed, chicks and equipment. It is built mobile-first
for mid-range and low-end Android phones on slow or unreliable mobile data.

Live at **https://farmers-connect-azure.vercel.app**

## Who it is for

| Role | What they can do |
| --- | --- |
| **Farmer** | Track batches and vaccinations, plan tasks, work out feed with the feed calculator, keep a farm photo gallery, find suppliers in the marketplace, book and message a vet (Ask Vet), join the community chat and ask Clucky, the AI farm assistant |
| **Vet** | Vet dashboard, appointments (accept or decline visits), the farmers they work with and their medical records, and a vet profile that an admin verifies |
| **Supplier** | Their own dashboard, product listings with photos, stock and prices, and a supplier profile that an admin verifies |
| **Admin** | Approve vets and suppliers, moderate the community (reports, paused members, blocked words), take down marketplace listings, answer reports and account requests, and see Clucky usage and platform stats |

## Features

- **My Farm** – batches, vaccination schedules and medical records, with reminders when something is due.
- **Feed calculator** – week-by-week feed amounts for broilers, layers and kienyeji birds, not a flat figure per phase.
- **Tasks** – a to-do list for the farm.
- **Marketplace (contact-first)** – farmers browse listings from suppliers and other farmers and contact the seller by phone or WhatsApp. In-app ordering exists in the code but is switched off (`IN_APP_ORDERING` in `src/config/features.js`).
- **Ask Vet** – find a vet, request a farm visit, filter by county, and see real suppliers and their listings.
- **Community** – one group chat for everyone, with replies, reactions, reporting and moderation. Blocked words are refused by the database.
- **Clucky AI** – a poultry assistant backed by a real AI model (Google Gemini) through a Supabase edge function. It asks for the farmer's agreement before the first question, sees only their county, batches and overdue vaccines – never their name, email or phone number – and is limited to 15 questions per account per day.
- **Reporting and blocking** – members can report a message, a listing, a member or an answer from Clucky, and block members they do not want to hear from.
- **Notifications** – an in-app bell for new events and for vaccinations, tasks and visits that are due. Each person chooses which ones they get. There is no push or SMS.
- **Sign-in** – email, phone number or Google, with password recovery by email.
- **Your account, your data** – anyone can delete their account and what it holds from their profile, or from `/delete-account` on the web.
- **Light and dark themes** – chosen in the app and remembered with the account.

No money moves through the app yet. Payments, in-app ordering and the revenue
pages are planned for version 2.1.

This is not an offline app. It is built to stay usable on a bad connection
(small pages, clear loading states, a retry button instead of lost input), not
to work with no connection at all.

## Tech stack

- **Frontend:** React 19, Vite, React Router 7, plain JavaScript
- **Styling:** plain CSS with a small design system in `src/styles/tokens.css`; icons from lucide-react; charts from recharts
- **Backend:** Supabase – Postgres with row-level security, auth, storage, realtime and edge functions
- **AI:** Google Gemini, called only from the `clucky` edge function
- **Hosting:** Vercel (merging to `main` deploys to production)

## Getting started

You need Node.js 20 or newer and a Supabase project.

```bash
git clone https://github.com/ndereba2business-glitch/farmers_connect.git
cd farmers_connect
npm ci
```

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

These two values are public by design. Never put a secret in a `VITE_`
variable: everything with that prefix is shipped to every browser.

Then start the dev server:

```bash
npm run dev
```

### Setting up the database

The whole schema history lives in `supabase/migrations/`. The Supabase CLI is
installed with the project's dev dependencies; once it is linked to your
project:

```bash
npx supabase db push
```

### Setting up the edge functions

Three functions run on Supabase. Their secrets stay there and never reach the
browser.

```bash
npx supabase functions deploy clucky --use-api
npx supabase functions deploy delete-account --use-api
npx supabase functions deploy account-request --use-api

npx supabase secrets set GEMINI_API_KEY=<your-key>
# optional
npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite
npx supabase secrets set CLUCKY_DAILY_LIMIT=15
```

Merging to `main` deploys the web app, not the functions: redeploy a function
whenever its code changes.

### Google sign-in

The Google button appears on its own once the Google provider is enabled in
the Supabase dashboard (Authentication → Providers). Where people land after
signing in is decided by Supabase's URL Configuration; `npm run check:auth-urls`
reports whether it is right.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests and end-to-end tests (no database needed) |
| `npm run test:unit` | Pure logic in `src/lib` and the Clucky prompt |
| `npm run test:e2e` | The real app in Chromium against an in-memory mock of Supabase, including 320, 360, 768 and 1280px layout checks and a contrast check of every page in both themes |
| `npm run test:security` | Access rules against the linked database (rolls back, leaves no data) |
| `npm run test:live` | Real sign-in journeys against the live project (needs test accounts in `.env.test.local`) |
| `npm run test:clucky-live` | Checks the deployed Clucky function |
| `npm run test:account-live` | Checks account deletion on the live project, on throwaway accounts it creates and removes |
| `npm run check:secrets` | Builds the app and checks the bundle for leaked secrets |
| `npm run check:repo` | Checks that no login, API key or key file is tracked in the repository |
| `npm run check:auth-urls` | Checks where sign-in returns people |

## Project structure

```
src/
  pages/            one file per route (routes are defined in src/App.jsx)
    legal/          privacy policy, terms, delete-account page
  components/       shared pieces: layout, route guard, notifications bell, dialogs, onboarding tour
    supplier/       supplier shell, hooks, form validation
    landing/        public landing page sections and photo credits
  context/          AuthContext (session, role, identity), ThemeContext and ToastContext
  lib/              Supabase client and feature logic (feed plan, community, Clucky, notifications, account, safety)
  config/           feature switches and the operator details the policy pages print
  styles/           design tokens, theme palette and responsive utilities
supabase/
  migrations/       schema history
  functions/        edge functions (clucky, delete-account, account-request)
  tests/            security checks
tests/
  unit/             pure logic tests
  e2e/              browser tests against a mock backend
  live/             checks against the deployed project
scripts/            icon and photo builders, security and secret checks
docs/play-store/    the Google Play release pack
android/            settings for the Android wrapper (no Android project or key is kept here)
```

`CLAUDE.md` holds the working rules for the codebase and the mistakes already
made once.

## Security

- Every table uses row-level security. Visitors who are not signed in have no
  database access, and anonymous sessions are refused everywhere.
- Admin rights come only from `app_metadata`, which users cannot edit. Vets
  and suppliers are trusted only after an admin verifies them.
- API keys for the AI service live only in Supabase function secrets.
- Uploaded photos can be opened by their address but not listed; lab results
  are private.
- Deleting an account removes its rows, its files and its login.

The full review, with what was fixed and what is still open, is
[docs/play-store/security-audit.md](docs/play-store/security-audit.md).

## Google Play

The app is being prepared for Google Play as a Trusted Web Activity. No Android
build exists yet and nothing has been submitted.
[docs/play-store/README.md](docs/play-store/README.md) says exactly what is
done, what is not, and what only the owner can do.

## Roadmap

- **Version 2.1** – in-app payments, ordering and the revenue and vet earnings pages.

## Screenshots

> These screenshots are from an earlier version of the app and will be
> replaced with current ones.

<img width="958" height="470" alt="Farmer dashboard" src="https://github.com/user-attachments/assets/bbfc04fd-5a3b-416f-9755-f1050a6a6162" />
<img width="482" height="437" alt="Farmer dashboard on a phone" src="https://github.com/user-attachments/assets/213915b0-47ca-4689-84c7-0a7959d26877" />
<img width="476" height="454" alt="Farmer dashboard on a phone, continued" src="https://github.com/user-attachments/assets/516dd187-0af8-4c6d-a9e7-329a3ae93cdf" />
<img width="958" height="476" alt="Sidebar menu" src="https://github.com/user-attachments/assets/2b215b30-5f08-4251-b7a2-c04871fc8d05" />
<img width="485" height="437" alt="Marketplace" src="https://github.com/user-attachments/assets/2e662330-f0fd-4f51-a399-84f0d484dddc" />
<img width="479" height="437" alt="Marketplace listing" src="https://github.com/user-attachments/assets/31108690-5b85-4b12-835a-bffc721b9a68" />
<img width="484" height="438" alt="My Farm" src="https://github.com/user-attachments/assets/ed21f60b-3540-460d-a288-732b76a94628" />
<img width="482" height="441" alt="Ask Vet" src="https://github.com/user-attachments/assets/3b76b340-3170-4415-8fde-21ac432c28fd" />
<img width="579" height="475" alt="Community" src="https://github.com/user-attachments/assets/877739b5-25b2-4d62-9bef-b8a5a9d2d400" />
<img width="478" height="476" alt="Profile" src="https://github.com/user-attachments/assets/82f9e892-a2f0-41ad-82c2-a688cb60f9a9" />
