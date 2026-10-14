# CLAUDE.md — farmers_connect

## Before doing anything: analyze current state
At the start of every session, before writing or changing code:
1. Run `git status` and `git log --oneline -10` to see what's in progress and what shipped recently
2. Check `src/App.jsx` to confirm which routes/features currently exist — it is the only router
3. Check `supabase\migrations\` for the latest schema — don't assume the schema from memory, read it. When a column or policy matters, confirm it against the linked database (`supabase db query --linked`), because a few early tables were created before migrations were tracked
4. If asked to build a feature, check whether a partial version already exists before creating a new file. This codebase once carried a whole second, unused copy of the app; don't start another one
5. Summarize what you found in 2-3 sentences before proposing changes, so I can correct you if your read is wrong

## Project overview
Web app for Kenyan poultry farmers, vets and suppliers, built mobile-first
for mid-range/low-end Android phones on unreliable mobile data.

Three signed-in roles plus admin:
- **Farmer** — batches, vaccinations, tasks, finance, feed calculator, gallery, marketplace, Ask Vet, community, Clucky
- **Vet** — dashboard, appointments, farmers, vet profile (verified by an admin)
- **Supplier** — own dashboard shell, products, supplier profile (verified by an admin)
- **Admin** — verifications, community moderation (reports, paused members, blocked words), listing removal, reports and account requests, Clucky usage, platform stats

Things that are easy to get wrong because they were deliberately changed:
- **Community is one group chat** (`community_chat`, at `/community`). The old posts feed and the separate "Messages" chat are gone, and their tables were dropped. Members only insert; the database sets the sender's name, badge and reply preview, refuses blocked words, and removal goes through `community_remove_message()`
- **Notifications are created by the database**, not the browser: triggers for events, and `sync_my_reminders()` (called by the bell) for vaccinations, tasks and visits that are due. The browser may only write to the signed-in person's own inbox, so a notification for someone else must be a trigger. Each person's switches live in `notification_preferences` and are enforced by an insert guard. In-app only: no push, no SMS
- **Clucky is a real AI model** behind the `clucky` edge function (`supabase/functions/clucky/`), currently Google Gemini through the Interactions API of `@google/genai`. The key is the function secret `GEMINI_API_KEY`; the model is `gemini-3.5-flash-lite` unless `GEMINI_MODEL` says otherwise, and `CLUCKY_DAILY_LIMIT` (default 15) caps questions per account per day. The browser never calls the AI service and never holds its key. The vendor is isolated in `providers/` (`AiProvider` in `providers/types.ts`): to change it, add a provider file and select it in `providers/index.ts`; `index.ts`, `prompt.ts`, the page and the database stay as they are. The daily count lives in `clucky_usage`, which only the function can touch (`clucky_take_question()`), so clearing the chat does not reset it. Only county, batches and overdue vaccines are sent as farm context: no name, email or phone number
- **Clucky runs on the AI service's free plan for now**, which every farmer shares and which refuses everyone once its daily allowance is used. The function tells a brief per-minute refusal (it waits and retries once) from a used-up day (`quota`: it tells the farmer to come back later, code `service_limit`, and stops calling the service for 10 minutes). `CLUCKY_GLOBAL_DAILY_LIMIT` (unset = no cap) can stop politely before the service does. Every answer's token count and every refusal is recorded (`clucky_usage`, `clucky_service_days`); the admin dashboard's Clucky tab shows them through `clucky_usage_summary()` with the paid-plan cost of the same use and a plain recommendation. Moving to the paid plan is a billing change in Google's console: no code changes. The paid prices used for the estimate are in `src/lib/cluckyUsage.js`
- **Google sign-in** only shows once the Google provider is enabled in Supabase; the button checks `/auth/v1/settings`. Where people land afterwards is decided by Supabase (Authentication > URL Configuration), not by the code: see "Sign-in returns to the wrong address" below. A refused sign-in comes back with the reason in the address; `src/lib/signInReturn.js` turns it into a message on the login page
- **Feed amounts** come from week-by-week tables in `src/lib/feedPlan.js`. Don't replace them with a flat amount per phase
- **Visitors who are not signed in have no database access at all**, and anonymous sign-in sessions are refused on every table by a restrictive rule named `block_anonymous_sessions`. The public landing page must not query Supabase
- **The Revenue page and the vet "earnings" figure were removed**: no money moves through the app. They are planned to return with payments (version 2.1)
- **Deleting an account really deletes it**, and only through the `delete-account` edge function: it checks the typed word and the password (or a sign-in in the last ten minutes for Google accounts), calls `delete_account_data()`, removes the person's files, then the login. `/delete-account` is the public page Google Play links to; a signed-out person's request goes through the public `account-request` function to Admin > Requests. Never delete an account in the Supabase dashboard: that removes the login and leaves every row keyed by email behind. A new table that holds anything about a person must be added to `delete_account_data()` in the same migration, with a `D` check in `supabase/tests/security.sql`
- **The Privacy Policy and Terms are written but not published.** `/privacy`, `/terms`, the terms agreement after sign-in and the policy links exist only when `VITE_POLICIES_PUBLISHED=true` (`POLICIES_PUBLISHED` in `src/config/features.js`). They are legal documents the owner has not yet reviewed, and `src/config/legal.js` still has an empty operator name and contact email. Don't switch them on, and don't fill those in with invented details. When a change alters what is collected, who receives it or what members can post, update the policy page and `docs/play-store/data-audit.md` in the same pull request
- **Clucky needs the farmer's agreement first.** The page asks once and the edge function refuses with `consent_required` until `farmer_profiles.clucky_consent_at` is set, so the check cannot be skipped from the browser
- **Members can report and block.** Listings, Clucky answers and members are reported into `content_reports` (`src/lib/safety.js`, `ReportDialog`); blocks live in `user_blocks` and hide that person's listings and chat messages for the blocker only. An admin removes a listing through Admin > Products, which notifies the owner by trigger
- **Uploaded photos can be opened by address but not listed.** The four photo buckets are public so images load without a signed request each; the read rule on `storage.objects` lets a signed-in person list only their own folder and a visitor nothing. Don't add a "public can view" rule back: it lets anyone list every file. Lab results are in a private bucket
- **Email confirmation is on** (since 14 October 2026). A new email account gets no session until its link is opened; `Signup.jsx` shows "Check your email" and `src/lib/authMessages.js` holds the wording. Never write code that assumes `signUp` returns a session. Anything that creates a real account on the live project (tests included) sends a real email: don't do it with made-up addresses. Phone sign-ups are still confirmed automatically
- **There are two themes.** See Stack and Style

The marketplace is **contact-first**: farmers contact suppliers by phone or
WhatsApp. In-app ordering and payments exist in code but are switched off by
`IN_APP_ORDERING` in `src/config/features.js`. Don't remove that code and don't
turn the switch on without being asked.

This is **not** an offline-first app, and it's not going to become one — no service
worker, optimistic local state, or queued-sync pattern exists anywhere in the
codebase, and building that infrastructure is a deliberate non-goal, not a gap to
fill. For this audience, the complexity and failure modes of a real offline layer
(stale writes, sync conflicts, cache invalidation bugs) are a worse tradeoff than
just making the online experience fast and resilient on bad connections. Build for
slow/unreliable networks, not for zero connectivity: fast initial loads, small
payloads, clear loading states, and error states that let someone retry instead of
losing their input.

## Stack
- Frontend: React 19 + Vite, react-router-dom v7, plain JavaScript (no TypeScript)
- State: React context only (`AuthContext`, `ToastContext`) — there is no Redux
- Styling: plain CSS files and inline styles — there is no Tailwind. The visual system (colours, three radii, one card shadow, type and icon rules, shared `fc-card` / `fc-btn` / `fc-stats` / `fc-quick` classes) is written down in `src/styles/tokens.css`; read its header before styling anything. Light and dark themes are both real: `data-theme` on `<html>` (set before first paint by the script in `index.html`), chosen with `ThemeToggle`, remembered by `src/lib/theme.js` (the saved profile choice wins over this browser's, which wins over the phone's setting). Never write a colour as a hex value in a component: use the semantic variables in `tokens.css` (`--fc-surface`, `--fc-ink`, `--fc-line`, `--fc-link` for green text, `--fc-primary` for a green fill), or a palette variable from `src/styles/theme.css` to match an older screen
- Icons: lucide-react only, never emoji as icons (reaction emoji in the community chat are content and stay). Charts: recharts (farmer dashboard only)
- Brand mark: a rooster's head on a maize-yellow tile, drawn by `src/components/BrandMark.jsx`. The artwork has one copy, `src/components/brandMarkArt.js`; `public/favicon.svg` and the PNGs in `public/icons/` are generated from it with `node scripts/build-icons.mjs`, so run that after changing it
- Backend: Supabase (auth, Postgres with row-level security, storage, realtime, edge functions — no separate backend framework)
- Deploy: Vercel (merging to `main` deploys to production). The public address is `https://farmers-connect-azure.vercel.app`. Every other `*-fidelis-ndereba-s-projects.vercel.app` address is a per-branch or per-deployment copy that Vercel can lock to the team: never share one, and never use one as Supabase's Site URL. `vercel.json` forwards `farmers-connect-fidelis-ndereba-s-projects.vercel.app` (the copy that was once shared and set as the Site URL) to the public address; that only helps while Vercel Authentication leaves that copy open, so it is a safety net, not the fix

## Non-negotiable rules
- No offline fallback infrastructure (service workers, queued-sync, etc.) — see Project overview. Instead: handle network failures gracefully (retry-capable error states, no silent data loss on submit) and keep payloads/initial loads light for slow mobile data.
- Supabase schema changes always go through `supabase\migrations\` as versioned files — never edit schema directly in the dashboard and call it done
- Never edit or delete an existing migration. Add a new one
- Dry-run every migration inside a transaction that rolls back before applying it to the linked project
- Every new table gets, in the same migration: row-level security, the `block_anonymous_sessions` restrictive policy (copy it from `20261010090000_security_hardening.sql`), rules written `to authenticated` with `(select auth.uid())` / `(select public.request_identity())`, a `comment on table`, and a check in `supabase/tests/security.sql`. Check H14 there fails if a table is missing the first two
- New database functions are not callable by anyone until granted: grant `execute` to `authenticated` only for functions the app calls. A `security definer` function must set `search_path = ''` and check who is calling
- Secrets (API keys for AI, SMS, etc.) live only in Supabase function secrets. Anything prefixed `VITE_` is shipped to every browser, so it must never hold a secret
- Every new screen/component must be checked for responsiveness — see Responsiveness section below — before it's considered done
- Don't drop unused database tables or rename route paths without being asked

## Responsiveness requirements
This app is for farmers likely using mid-range/low-end Android phones on mobile data. Every component must be built mobile-first, not desktop-first with breakpoints bolted on.
- Test at minimum: 320px and 360px (small Android), 768px (tablet), 1280px (desktop)
- No fixed-width layouts, no horizontal scroll on mobile
- Touch targets minimum 44px — this is a field-use app, not a mouse-driven dashboard. For compact controls, add the `fc-tap` class (`src/styles/responsive.css`)
- Before marking any UI task complete, explicitly state which breakpoints you checked and flag anything you couldn't verify visually

## Frontend routing and auth
- Route definitions: `src/App.jsx` (pages are lazy-loaded, one chunk each)
- Role guard: `src/components/ProtectedRoute.jsx` (`allowedRoles`)
- Layout shell for farmers, vets and admins: `src/components/Layout.jsx` (menus are per role: `FARMER_NAV`, `VET_NAV`, `ADMIN_NAV`)
- Layout shell for suppliers: `src/components/supplier/SupplierShell.jsx`
- Session, role and identity: `src/context/AuthContext.jsx` (`useAuth()`)
  - `role` is `admin` only when `app_metadata.role` says so; a self-declared admin in `user_metadata` is treated as a farmer
  - `userEmail` is the account's **identity**: the email, or the phone number for phone-only accounts. Use it instead of reading `user.email`

## Code structure
- `src/pages/` — one file per route
- `src/components/` — shared pieces (`Layout`, `ProtectedRoute`, `NotificationsBell`, `OnboardingTour`, messaging and medical-record modals)
- `src/components/supplier/` — supplier shell, hooks, form validation and formatting
- `src/components/landing/` — public landing page sections
- `src/lib/` — Supabase client (`supabaseClient.js`) and the logic behind each feature, kept free of React where possible so it can be unit tested: `feedPlan.js`, `community.js`, `clucky.js`, `notificationHelpers.js`, `googleSignIn.js`, image upload, supplier contact links, product listing
- `src/pages/legal/` — privacy policy, terms, the public delete-account page and the page shown after deletion
- `src/config/features.js` — feature switches. `src/config/legal.js` — the operator's name, contact details and terms version the policy pages print
- `docs/play-store/` — the Google Play release pack (start at its `README.md`): security review, policy matrix, data audit, Data safety answers, Android build guide, store listing draft, moderation runbook, photo licences
- `android/` — settings for the Android wrapper (a Trusted Web Activity built with Bubblewrap). No Android project, key store or app bundle is kept in the repository
- `src/styles/tokens.css` — the visual system: variables and the shared building-block classes
- `src/styles/responsive.css` — the global reset, font scale and responsive utilities
- `supabase/migrations/` — schema history. `supabase/functions/` — edge functions. `supabase/tests/security.sql` — access-rule checks
- `tests/unit/` — pure logic. `tests/e2e/` — the real app in Chromium against a mock Supabase

## Commands
- Dev server: `npm run dev`
- Build (run before every Vercel push): `npm run build`
- Tests (no database needed): `npm test` = `npm run test:unit` (pure logic in `src/lib` and the Clucky prompt) + `npm run test:e2e` (the real app in Chromium against an in-memory mock of Supabase, including 320/360/768/1280px layout and accessibility checks). A new end-to-end file must be added to the `test:e2e` script in `package.json`; the mock (`tests/e2e/mockBackend.js`) serves any table seeded in `backend.db.tables`
- Security rules against the linked database (rolls back, leaves no data): `npm run test:security`
- Supabase's own security and performance advisor: `supabase db advisors --linked`. Run it after any migration that adds tables, functions or policies
- Real-login journeys against the live project: `npm run test:live` (skips until `.env.test.local` holds `TEST_SUPPLIER_EMAIL`, `TEST_SUPPLIER_PASSWORD`, `TEST_FARMER_EMAIL`, `TEST_FARMER_PASSWORD`)
- Secret leak check of the production build: `npm run check:secrets`. The same for the repository itself (a login, an API key, a private key or a key store in a tracked file): `npm run check:repo`
- Account deletion against the live project, on throwaway accounts it creates and removes itself: `npm run test:account-live`. The full deletion check skips itself while email confirmation is on, rather than email a made-up address
- Landing page photographs, resized from the originals: `node scripts/build-landing-images.mjs`
- Sign-in return addresses of the linked Supabase project (read-only; run after changing a domain or Supabase's URL Configuration): `npm run check:auth-urls`
- Apply migrations to the linked project: `supabase db push` (after a rolled-back dry run of the SQL)
- Deploy an edge function without Docker: `supabase functions deploy clucky --use-api`. Set its secrets with `supabase secrets set NAME=value` or in the dashboard, never in `.env`
- Check the deployed Clucky function (sign-in required; with `TEST_FARMER_EMAIL` and `TEST_FARMER_PASSWORD` in `.env.test.local` also empty and over-long questions, a real answer and a follow-up): `npm run test:clucky-live`
- No TypeScript types file exists (JS project), so there is nothing to regenerate after schema changes

## Git commit conventions
Follow conventional commits, since this repo is also a portfolio piece:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change with no behavior change
- `style:` responsiveness/CSS-only changes
- `design:` visual identity and look-and-feel changes
- `docs:` README/comments only
- `chore:` tooling, dependencies, deletions
- Commit logically, not in one giant dump — e.g. schema migration and its related UI change are two commits, not one
- Never commit directly to `main` on a feature you're not confident in — use a branch, even solo
- Write commit messages that explain *why*, not just what, when the reasoning isn't obvious from the diff
- Push after each commit rather than saving them up

## Known failure patterns (so Claude Code checks these first)
- **Phone-only accounts.** Their `email` is empty. Code that reads `user.email` (or SQL that uses `auth.email()`) silently treats them as nobody: empty lists, failed saves. In the app use `userEmail` from `useAuth()`; in SQL use `(select public.request_identity())`
- **Row-level security hides failures.** An update or delete on a row you don't own returns no error and changes nothing. Counters stored on someone else's row (the old post "likes" column) can never work from the client; use a row per user with a unique constraint, or a function
- **Unchecked Supabase errors.** Many older calls ignore `error`, so a failed save looks like success. Always read `error`, keep the user's input, and show a retry-capable message (`useToast()`), not `alert()`
- **Inline styles beat stylesheets.** A `gridTemplateColumns` or fixed `height` written in a `style={{}}` prop overrides any `@media` rule in a CSS file. Put responsive layout in a class
- **Self-declared roles.** `user_metadata` is editable by the user. Never grant anything on it; admin comes from `app_metadata`, vet and supplier trust comes from `verification_status`
- **`select("*")` with no limit** on tables that grow (posts, messages, notifications). Select the columns needed and add a limit
- **Realtime needs the table in the publication.** Subscribing to a table that isn't in `supabase_realtime` fails silently: the page loads and never updates. Add the table in a migration
- **A white icon on a white bar.** The notification bell was invisible on three of the four layouts for this reason. Shared components must carry their own contrast, and a screenshot check beats a measurement
- **One value, three gatekeepers.** Vets could never decline a visit: the app saved `rejected` while a check constraint and a trigger only knew `declined`. When adding or renaming a status, change the app, the check constraint and the transition trigger together, and test the write against the database
- **A rule on a table cannot read that same table** (Postgres reports infinite recursion). Put the lookup in a `security definer` helper function
- **Sign-in returns to the wrong address.** `startGoogleSignIn` asks to come back to the address the person started from, but Supabase only honours an address on its Redirect URLs list and otherwise uses its Site URL without any error. With the Site URL set to a team-only Vercel address, farmers who chose "Continue with Google" landed on Vercel's "request access" page. No code change can fix this: correct the two settings in Supabase, then run `npm run check:auth-urls`. A role picked at sign-up is parked in the browser per address, so landing on a different address also loses it
- **`git add <path>` fails on a file whose deletion is already staged**, and the commit is silently skipped while later commands carry on. Use `git add -u`, and check `git status` is clean and the build passes before merging
- **Stopping tracking a file deletes it for everyone who pulls.** `git rm --cached` followed by a pull removed `supabase/.temp` and unlinked the CLI; restore untracked files after such a change
- **Test scripts with real logins.** A folder of throwaway browser scripts was committed with the admin's password in it, in a public repository. Logins for tests live only in `.env.test.local`; run `npm run check:repo` before pushing anything that signs in
- **A fixed element inside a transformed card.** A confirmation dialog rendered inside a card with a CSS transform was positioned against the card, not the screen, and fell off a 320px phone. Dialogs go through `ConfirmDialog` (or `.fc-dialog`), which is rendered into `<body>`
- **A colour that only works in one theme.** A hex value in an inline style, or a button with no text colour of its own, looks right in light and unreadable in dark. `tests/e2e/theme.test.js` measures contrast on every page in both themes; add a new page to `PAGES` in `tests/e2e/themeFixtures.js`
- **Two sessions in one working folder.** When another session is editing this folder, work in a separate git worktree with its own `node_modules` (`npm ci` there): a shared `node_modules` breaks as soon as either side changes a dependency
- **Remote migration history ahead of the branch.** `supabase db push` refuses when the linked project has a migration this branch does not; merge `main` (or the branch that added it) first rather than repairing the history

## Style
- Pages and components are PascalCase `.jsx`; helpers and hooks are camelCase `.js` (`useX` for hooks)
- New screens get their own CSS file with a short class prefix (`ss-` supplier shell, `sf-` supplier forms, `fc-` shared layout, `ot-` onboarding tour) instead of long inline style objects
- Fetch in an effect with a cancelled flag, track `loading` and `error` state, and render a retry button on failure (see `SupplierShell.jsx` for the pattern)
- Form fields need a real `<label>` or `aria-label`; a placeholder is not a label
- Look: ink on white (and its mirror in the dark theme), one primary green (`#15803d`) for the main action, radii 8/12/16, hairline cards, solid buttons. No gradients on buttons or cards, no coloured glows, no frosted glass, no weight above 700, no icon tile beside every heading. Green is not applied to something just because it is about farming
- A row of figures is `fc-stats`, not one card per number
- Landing page photographs are real photographs of real farms with a licence that allows this use, no identifiable people, and a record: each has an entry in `src/components/landing/photos.js` (source, author, licence) and in `docs/play-store/image-licences.md`, and is served from `public/landing/`, never hotlinked. Never stock-looking, generated, or "found on Pinterest" images. No invented testimonials, member counts or success stories anywhere on the page
