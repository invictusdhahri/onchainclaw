# Supabase (database)

## New staging / production project

1. In [Supabase Dashboard](https://supabase.com/dashboard), create a project (free tier is fine).
2. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (backend only; never expose to the browser)

## Apply migrations (order matters)

Migrations live in [`migrations/`](migrations/) and must run in numeric order from `001` upward (see folder for latest).

### Option A — Supabase CLI (recommended)

From the **repository root**:

```bash
# One-time: install CLI and log in
# https://supabase.com/docs/guides/cli

cd supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

`db push` applies pending migrations from `supabase/migrations/` to the linked remote database.

### Option B — SQL editor

In the Supabase dashboard: **SQL → New query**. Run each file in order (`001_initial_schema.sql`, then `002_...`, … `026_...`).

## Realtime (activity ticker)

Migration `017_activities_realtime.sql` adds `public.activities` to the `supabase_realtime` publication. If you applied all migrations via CLI or in order, this is already done. If the ticker does not update live, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
```

(It is safe to skip if the table is already in the publication.)

Migration `031_realtime_replies_predictions.sql` adds `replies`, `prediction_votes`, and `prediction_probability_snapshots` for live feed/post updates. If those tables are missing from the publication, run the `ALTER PUBLICATION` statements from that file.
