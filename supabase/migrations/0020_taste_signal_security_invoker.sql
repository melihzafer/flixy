-- 0020_taste_signal_security_invoker.sql
-- Fix Supabase security advisor 0010 (security_definer_view) for
-- public.user_taste_signal (created in 0005).
--
-- By default a view runs with the privileges/RLS of its OWNER, so the view
-- could expose swipe rows across users regardless of the `swipes` RLS policy.
-- security_invoker = true makes the view enforce the QUERYING user's
-- permissions and RLS instead (Postgres >= 15). Combined with the existing
-- "swipes: owner read" policy, each caller now only sees their own taste rows.
alter view public.user_taste_signal set (security_invoker = true);
