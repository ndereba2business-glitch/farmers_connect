# Farmers Connect

A web app for Kenyan poultry farmers, the vets who treat their flocks and the suppliers who sell to them.
Built mobile-first for mid-range and low-end Android phones on slow, unreliable mobile data.

Live at **https://farmers-connect-azure.vercel.app**

## What it does

| For | What they get |
| --- | --- |
| Farmers | Batches, vaccination schedules, daily tasks, income and costs, a week-by-week feed calculator, a photo gallery, a marketplace, vet bookings, one community group chat, and Clucky, an AI assistant for poultry questions |
| Vets | Appointments, the farmers they look after, medical records and lab results, a profile an admin verifies |
| Suppliers | A product catalogue and a profile an admin verifies. Farmers reach them by phone or WhatsApp; nothing is bought or paid for inside the app |
| Admins | Verification of vets and suppliers, community moderation, reports, listing removal, account requests, Clucky usage |

Light and dark themes. In-app notifications only: no push, no SMS. Not an offline app: it is built to stay
usable on a bad connection, not without one.

## Built with

React 19 and Vite (plain JavaScript), react-router, plain CSS, lucide icons and recharts. Supabase for
sign-in, the Postgres database with row-level security, file storage, realtime and edge functions. Deployed
on Vercel; merging to `main` deploys to production.

## Running it

```bash
npm ci
npm run dev
```

It needs a `.env` file with the project's public address and public key. Both are safe to ship to a
browser; nothing secret ever goes in a `VITE_` variable.

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<the project's public (anon) key>
```

Secrets, such as the AI service key, live only in Supabase function secrets.

## Checking it

```bash
npm test                  # unit tests, then the real app in Chromium against an in-memory backend
npm run lint
npm run build
npm run check:secrets     # no secret in the built app
npm run check:repo        # no login or key file in the repository
npm run test:security     # access rules against the linked database, rolled back
```

The end-to-end tests need no database and include layout checks at 320, 360, 768 and 1280px and a contrast
check of every page in both themes.

## Where things are

| Path | What |
| --- | --- |
| `src/App.jsx` | Every route |
| `src/pages/`, `src/components/` | Screens and shared pieces |
| `src/lib/` | The logic behind each feature, kept free of React so it can be unit tested |
| `src/styles/tokens.css` | The visual system |
| `supabase/migrations/` | The database's history. Schema changes happen only here |
| `supabase/functions/` | Edge functions: `clucky`, `delete-account`, `account-request` |
| `supabase/tests/security.sql` | Who can read and change what, checked |
| `docs/play-store/` | The Google Play release pack: security review, policy matrix, data audit, Android build guide |
| `CLAUDE.md` | Working rules and the mistakes already made once |

## Google Play

The app is being prepared for Google Play as a Trusted Web Activity. No Android build exists yet and
nothing has been submitted. [docs/play-store/README.md](docs/play-store/README.md) says exactly what is
done, what is not, and what only the owner can do.

## Screenshots

Some of these predate the current design.

<img width="958" height="470" alt="dashboard21" src="https://github.com/user-attachments/assets/bbfc04fd-5a3b-416f-9755-f1050a6a6162" />
<img width="482" height="437" alt="dashboard2" src="https://github.com/user-attachments/assets/213915b0-47ca-4689-84c7-0a7959d26877" />
<img width="476" height="454" alt="dashboard3" src="https://github.com/user-attachments/assets/516dd187-0af8-4c6d-a9e7-329a3ae93cdf" />
<img width="958" height="476" alt="sidebar" src="https://github.com/user-attachments/assets/2b215b30-5f08-4251-b7a2-c04871fc8d05" />
<img width="485" height="437" alt="marketplace1" src="https://github.com/user-attachments/assets/2e662330-f0fd-4f51-a399-84f0d484dddc" />
<img width="479" height="437" alt="marketplace2" src="https://github.com/user-attachments/assets/31108690-5b85-4b12-835a-bffc721b9a68" />
<img width="484" height="438" alt="my farm" src="https://github.com/user-attachments/assets/ed21f60b-3540-460d-a288-732b76a94628" />
<img width="482" height="441" alt="askvet" src="https://github.com/user-attachments/assets/3b76b340-3170-4415-8fde-21ac432c28fd" />
<img width="579" height="475" alt="community" src="https://github.com/user-attachments/assets/877739b5-25b2-4d62-9bef-b8a5a9d2d400" />
<img width="478" height="476" alt="profile" src="https://github.com/user-attachments/assets/82f9e892-a2f0-41ad-82c2-a688cb60f9a9" />
