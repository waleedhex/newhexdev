
-- ===== SUBSCRIPTION CODES: Remove public write access =====
DROP POLICY IF EXISTS "Anyone can insert codes" ON public.subscription_codes;
DROP POLICY IF EXISTS "Anyone can delete codes" ON public.subscription_codes;

-- ===== GENERAL QUESTIONS: Remove public write access =====
DROP POLICY IF EXISTS "Anyone can insert questions" ON public.general_questions;
DROP POLICY IF EXISTS "Anyone can delete questions" ON public.general_questions;

-- ===== ANNOUNCEMENTS: Remove public write access =====
DROP POLICY IF EXISTS "Anyone can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can delete announcements" ON public.announcements;

-- ===== SESSION QUESTIONS: Remove public delete access (admin only) =====
DROP POLICY IF EXISTS "Anyone can delete session questions" ON public.session_questions;
