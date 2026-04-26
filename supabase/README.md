# Supabase

This directory holds the Postgres schema for Flixy as plain SQL migrations.

## Layout

- `migrations/NNNN_<name>.sql` — append-only, numerically ordered. Never edit a
  migration after it has been applied to a shared environment; add a new one.

## Apply

If using the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Or via `psql` directly:

```bash
psql "$SUPABASE_DB_URL" -f migrations/0001_init_profiles.sql
```

## Conventions

- snake_case for tables / columns
- All user-owned tables have RLS enabled and self-only policies by default
- `updated_at` columns are wired to the shared `tg_set_updated_at()` trigger
- New auth.users automatically get a `public.profiles` row via `handle_new_user()`

See `docs/FSD.md § 2` for the full data architecture context.
