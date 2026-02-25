
-- 1. subscription_codes: Remove open SELECT, keep only safe_check_code access
DROP POLICY IF EXISTS "Anyone can verify codes" ON public.subscription_codes;

-- No public SELECT at all - verification goes through safe_check_code (SECURITY DEFINER)
-- Admin operations go through admin-actions edge function (service_role)

-- 2. announcements: Already has no INSERT/UPDATE/DELETE policies, but let's be explicit
-- Keep the existing SELECT for active announcements only
-- All write operations go through admin-actions edge function (service_role)
