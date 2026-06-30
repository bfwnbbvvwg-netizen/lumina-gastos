# Lumina Operations

Last reviewed: 2026-06-30

## Production URL

Primary app URL:

https://lumina-gastos.vercel.app

## Supabase Auth Configuration

In Supabase, open Authentication settings and confirm:

- Site URL: `https://lumina-gastos.vercel.app`
- Redirect URLs include: `https://lumina-gastos.vercel.app/**`

This prevents confirmation emails from sending users back to `localhost`.

## Vercel Environment Variables

In Vercel, keep these variables under the Production environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After changing these values, redeploy the project so Vite rebuilds the app with the updated configuration.

## Database Changes

For an empty Supabase project, run:

- `supabase/schema.sql`

For an existing project, prefer files under:

- `supabase/migrations/`

The current migration history includes:

- `001_add_incomes.sql`: adds incomes, income views, cashflow view, and updates the budget alert to use monthly income.

## Field Test

Before sharing a release widely:

- Create a brand-new account.
- Confirm the email from the production URL.
- Verify the dashboard starts at zero income and zero expense.
- Add one income.
- Add one expense.
- Confirm the available balance equals income minus expenses.
- Install from Safari on iOS using Share, then Add to Home Screen.
