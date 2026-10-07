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
- **Admin** — verifications, community moderation (reports, paused members, blocked words), platform stats

Things that are easy to get wrong because they were deliberately changed:
- **Community is one group chat** (`community_chat`, at `/community`). The old posts feed and the separate "Messages" chat are gone; `community_posts` and `community_comments` are unused. Members only insert; the database sets the sender's name, badge and reply preview, refuses blocked words, and removal goes through `community_remove_message()`
- **Notifications are created by the database**, not the browser: triggers for events, and `sync_my_reminders()` (called by the bell) for vaccinations, tasks and visits that are due. The browser may only write to the signed-in person's own inbox, so a notification for someone else must be a trigger. Each person's switches live in `notification_preferences` and are enforced by an insert guard. In-app only: no push, no SMS
- **Clucky is a real AI model** behind the `clucky` edge function (`supabase/functions/clucky/`). The Anthropic key is the function secret `ANTHROPIC_API_KEY`; the model is `claude-opus-5-5` unless `CLUCKY_MODEL` says otherwise, and `CLUCKY_DAILY_LIMIT` (default 30) caps questions per account per day
- **Google sign-in** only shows once the Google provider is enabled in Supabase; the button checks `/auth/v1/settings`
- **Feed amounts** come from week-by-week tables in `src/lib/feedPlan.js`. Don't replace them with a flat amount per phase

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
- Styling: plain CSS files and inline styles — there is no Tailwind
- Icons: lucide-react. Charts: recharts (farmer dashboard only)
- Backend: Supabase (auth, Postgres with row-level security, storage, realtime, edge functions — no separate backend framework)
- Deploy: Vercel (merging to `main` deploys to production)

## Non-negotiable rules
- No offline fallback infrastructure (service workers, queued-sync, etc.) — see Project overview. Instead: handle network failures gracefully (retry-capable error states, no silent data loss on submit) and keep payloads/initial loads light for slow mobile data.
- Supabase schema changes always go through `supabase\migrations\` as versioned files — never edit schema directly in the dashboard and call it done
- Never edit or delete an existing migration. Add a new one
- Dry-run every migration inside a transaction that rolls back before applying it to the linked project
- Every new table gets row-level security in the same migration, plus a check in `supabase/tests/security.sql`
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
- `src/config/features.js` — feature switches
- `src/styles/responsive.css` — the one global stylesheet (reset, font scale, shared utilities)
- `supabase/migrations/` — schema history. `supabase/functions/` — edge functions. `supabase/tests/security.sql` — access-rule checks
- `tests/unit/` — pure logic. `tests/e2e/` — the real app in Chromium against a mock Supabase

## Commands
- Dev server: `npm run dev`
- Build (run before every Vercel push): `npm run build`
- Tests (no database needed): `npm test` = `npm run test:unit` (pure logic in `src/lib` and the Clucky prompt) + `npm run test:e2e` (the real app in Chromium against an in-memory mock of Supabase, including 320/360/768/1280px layout and accessibility checks). A new end-to-end file must be added to the `test:e2e` script in `package.json`; the mock (`tests/e2e/mockBackend.js`) serves any table seeded in `backend.db.tables`
- Security rules against the linked database (rolls back, leaves no data): `npm run test:security`
- Real-login journeys against the live project: `npm run test:live` (skips until `.env.test.local` holds `TEST_SUPPLIER_EMAIL`, `TEST_SUPPLIER_PASSWORD`, `TEST_FARMER_EMAIL`, `TEST_FARMER_PASSWORD`)
- Secret leak check of the production build: `npm run check:secrets`
- Apply migrations to the linked project: `supabase db push` (after a rolled-back dry run of the SQL)
- Deploy an edge function without Docker: `supabase functions deploy clucky --use-api`. Set its secrets with `supabase secrets set NAME=value` or in the dashboard, never in `.env`
- No TypeScript types file exists (JS project), so there is nothing to regenerate after schema changes

## Git commit conventions
Follow conventional commits, since this repo is also a portfolio piece:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change with no behavior change
- `style:` responsiveness/CSS-only changes
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
- **Stopping tracking a file deletes it for everyone who pulls.** `git rm --cached` followed by a pull removed `supabase/.temp` and unlinked the CLI; restore untracked files after such a change

## Style
- Pages and components are PascalCase `.jsx`; helpers and hooks are camelCase `.js` (`useX` for hooks)
- New screens get their own CSS file with a short class prefix (`ss-` supplier shell, `sf-` supplier forms, `fc-` shared layout, `ot-` onboarding tour) instead of long inline style objects
- Fetch in an effect with a cancelled flag, track `loading` and `error` state, and render a retry button on failure (see `SupplierShell.jsx` for the pattern)
- Form fields need a real `<label>` or `aria-label`; a placeholder is not a label
