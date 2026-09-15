# CLAUDE.md — farmers_connect

## Before doing anything: analyze current state
At the start of every session, before writing or changing code:
1. Run `git status` and `git log --oneline -10` to see what's in progress and what shipped recently
2. Check `src/app/router.jsx` to confirm which routes/features currently exist
3. Check `supabase\migrations\` for the latest schema — don't assume the schema from memory, read it
4. If asked to build a feature, check whether a stub or partial version already exists (e.g. `src/components/common/Button.jsx` and `Card.jsx` are currently empty — don't recreate them blindly, check first whether that's intentional or abandoned work)
5. Summarize what you found in 2-3 sentences before proposing changes, so I can correct you if your read is wrong

## Project overview
Offline-first web app for rural farmers with limited/no internet connectivity.
Core principle: **every feature must degrade gracefully offline.**

## Stack
- Frontend: React, react-router-dom v7, Redux Toolkit + React-Redux
- Backend: Supabase (auth, database, storage — no separate backend framework)
- Deploy: Vercel

## Non-negotiable rules
- Every new feature must have an offline fallback plan — service worker caching, optimistic local state, or a queued-sync pattern. If a feature genuinely can't work offline (e.g. live vet chat), say so explicitly rather than silently skipping the offline case.
- Supabase schema changes always go through `supabase\migrations\` as versioned files — never edit schema directly in the dashboard and call it done
- After any schema change, regenerate TypeScript types and confirm the frontend types file is updated in the same commit
- Every new screen/component must be checked for responsiveness — see Responsiveness section below — before it's considered done

## Responsiveness requirements
This app is for farmers likely using mid-range/low-end Android phones on mobile data. Every component must be built mobile-first, not desktop-first with breakpoints bolted on.
- Test at minimum: 360px (small Android), 768px (tablet), 1280px (desktop)
- No fixed-width layouts, no horizontal scroll on mobile
- Touch targets minimum 44px — this is a field-use app, not a mouse-driven dashboard
- Before marking any UI task complete, explicitly state which breakpoints you checked and flag anything you couldn't verify visually

## Frontend routing
- React Router v7 (`react-router-dom` ^7.15.1)
- Route definitions: `src/app/router.jsx`
- Auth-gated routes wrapped in `src/components/auth/ProtectedRoute.jsx`
- Layout shell: `src/app/layout/MainLayout.jsx` (+ `Sidebar.jsx`, `Navbar.jsx`)

## Feature structure
- `src/components/askvet/` — vet Q&A / supplier discovery
- `src/components/dashboard/` — analytics, orders
- `src/components/forms/` — produce entry forms
- `src/components/suppliers/` — supplier cards/filters
- `src/components/common/` — shared UI primitives (currently stubbed out — confirm before assuming they're implemented)

## Commands
- Dev server: [confirm exact script from package.json]
- Supabase local: `supabase start` / `supabase db push`
- Type generation: `supabase gen types typescript --local > [confirm path]`
- Build (run before every Vercel push): `npm run build`

## Git commit conventions
Follow conventional commits, since this repo is also a portfolio piece:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change with no behavior change
- `style:` responsiveness/CSS-only changes
- `docs:` README/comments only
- Commit logically, not in one giant dump — e.g. schema migration and its related UI change are two commits, not one
- Never commit directly to `main` on a feature you're not confident in — use a branch, even solo
- Write commit messages that explain *why*, not just what, when the reasoning isn't obvious from the diff

## Known failure patterns (so Claude Code checks these first)
- [To be filled in as real React/Supabase bugs come up — this project has no confirmed recurring bugs yet]

## Style
- [Component naming conventions, hook patterns — fill in once established]