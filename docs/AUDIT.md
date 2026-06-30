# Lumina Technical Audit

Last reviewed: 2026-06-30

Audit reference: local checkout of `obra/Superpowers` at `tools/superpowers`.

## Scope

Reviewed the current Lumina project structure, Supabase schema and migration, frontend service boundaries, PWA deployment assets, and production deployment assumptions.

## Current Status

Lumina is deployed on Vercel, connected to GitHub, and configured with Supabase environment variables. The app uses authenticated persistence when Supabase is available and a demo fallback when credentials are absent.

Recent production-facing improvements include:

- Authenticated users no longer inherit demo transactions as their production dataset.
- Monthly balance now uses registered incomes minus expenses instead of a fixed monthly budget.
- Supabase has an `incomes` table plus `monthly_income` and `monthly_cashflow` views.

## Findings

### P1: Email Confirmation Redirect Depends on Supabase Settings

Supabase confirmation emails can still point to `localhost` if the project Auth URL settings are not updated. The frontend sign-up flow also does not explicitly pass a production redirect URL.

Impact: new users may confirm their account and land on a page that does not load.

Recommended action:

- In Supabase Auth URL Configuration, set Site URL to `https://lumina-gastos.vercel.app`.
- Add `https://lumina-gastos.vercel.app/**` to allowed redirect URLs.
- Consider updating `src/services/auth.js` to pass `emailRedirectTo: window.location.origin`.

### P2: Initial Schema Is Not Fully Rerunnable

`supabase/schema.sql` uses `create table if not exists`, but policy creation uses plain `create policy`. Running the full schema more than once in the same Supabase project can fail once policies already exist.

Impact: future setup or recovery work may be confusing if the operator reruns the whole schema.

Recommended action:

- Keep using focused migration files for existing projects.
- For the next cleanup pass, make policy creation idempotent through guarded `do $$` blocks, matching the pattern in `supabase/migrations/001_add_incomes.sql`.

### P2: No Automated Test Suite Yet

The current verification path is build-based. That catches compilation and bundling errors, but not auth redirects, RLS behavior, or create/read flows.

Impact: regressions in the core money-entry flow could reach production if they still compile.

Recommended action:

- Add a lightweight test layer for formatting/calculation helpers first.
- Add one browser smoke test for sign-up screen rendering and quick-add behavior.
- Add a manual release checklist for Supabase URL settings and Vercel environment variables.

### P3: App Logic Is Concentrated in `src/App.jsx`

`src/App.jsx` owns most of the data loading, calculations, modal logic, navigation state, and dashboard rendering.

Impact: it is still manageable, but future features such as budgets by category, imports, or OCR will raise change risk.

Recommended action:

- Split only when the next feature forces it.
- Good first extractions: dashboard metrics, quick-add form, movement lists, and chart/category summaries.

## Strengths

- Clear service modules isolate Supabase reads and writes.
- RLS policies protect all user-owned financial tables.
- The production app degrades gracefully when Supabase is not configured.
- PWA assets, manifest, offline fallback, and deployment headers are already in place.
- Income-based cashflow is now a better product model than a fixed monthly budget.

## Release Checklist

- Run `npm run build`.
- Confirm Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Confirm Supabase Site URL points to the Vercel production URL.
- Confirm Supabase redirect allow-list includes the Vercel production URL.
- Run any new Supabase migration before deploying frontend code that depends on it.
- Create a new user and verify the first dashboard state starts at zero.
