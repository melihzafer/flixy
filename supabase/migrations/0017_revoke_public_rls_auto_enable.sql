-- 0017_revoke_public_rls_auto_enable.sql
-- Advisor hardening: this SECURITY DEFINER helper must not be callable via the public API.

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
