# CLAUDE.md — farmers_connect

## Project overview
Offline-first app for rural farmers with limited/no internet connectivity.
Core principle: **every feature must degrade gracefully offline.**

## Stack
- Frontend: React (Vite or CRA — [confirm which]), react-router-dom v7
- State: Redux Toolkit + React-Redux
- Backend: Supabase (see `supabase\` directory — migrations, config, edge functions live here)
- No Django. No separate backend framework — Supabase is the entire backend.

## Non-negotiable rules
- Default to PWA support for every new feature — service workers, local caching, offline fallbacks
- Never assume network availability; queue actions locally and sync when back online
- Supabase schema changes go through `supabase\migrations\`, not the dashboard directly — keep schema in version control

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
- `src/components/common/` — shared UI (Button, Card, Input — currently empty stubs)

## Commands
- Dev server: [confirm — `npm run dev` for Vite, or similar]
- Supabase local: `supabase start` / `supabase db push`
- Type generation: `supabase gen types typescript --local > src/types/supabase.ts` [confirm actual path]

## Known failure patterns (so Claude Code checks these first)
- [Previous Django-specific errors (ModuleNotFoundError, missing urls.py) don't apply here — remove]
- [Fill in with actual React/Supabase errors you've hit, once you have some]

## Style
- [Any code style conventions — naming patterns for components/hooks?]