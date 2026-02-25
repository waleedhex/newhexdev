-- ============================================================
-- هجرة كاملة لقاعدة بيانات حروف (Hexa Grid) إلى Supabase خارجي
-- يتضمن: الجداول، الأنواع، الوظائف، المحفزات، وسياسات RLS
-- ============================================================

-- 1. إنشاء نوع player_role
CREATE TYPE public.player_role AS ENUM ('host', 'contestant', 'display');

-- ============================================================
-- 2. الجداول
-- ============================================================

-- subscription_codes
CREATE TABLE public.subscription_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- announcements
CREATE TABLE public.announcements (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT,
  link TEXT,
  button_text TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- general_questions
CREATE TABLE public.general_questions (
  id SERIAL PRIMARY KEY,
  letter TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  lang TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- game_sessions
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE,
  host_name TEXT,
  hexagons JSONB DEFAULT '{}'::jsonb,
  teams JSONB DEFAULT '{"red": [], "green": []}'::jsonb,
  buzzer JSONB DEFAULT '{"team": null, "active": false, "player": ""}'::jsonb,
  buzzer_locked BOOLEAN DEFAULT false,
  color_set_index INTEGER DEFAULT 0,
  is_swapped BOOLEAN DEFAULT false,
  party_mode BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  golden_letter TEXT,
  winning_path JSONB,
  letters_order TEXT[] DEFAULT ARRAY['أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT game_sessions_session_code_fkey FOREIGN KEY (session_code) REFERENCES public.subscription_codes(code)
);

-- session_players
CREATE TABLE public.session_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.game_sessions(id),
  player_name TEXT NOT NULL,
  role public.player_role NOT NULL,
  token UUID DEFAULT gen_random_uuid(),
  team TEXT,
  is_connected BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (session_id, player_name, role)
);

-- session_questions
CREATE TABLE public.session_questions (
  id SERIAL PRIMARY KEY,
  session_code TEXT NOT NULL,
  letter TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- 3. تفعيل Realtime (إن لزم)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;

-- ============================================================
-- 4. الوظائف (Functions)
-- ============================================================

-- safe_check_code: التحقق الآمن من الرمز
CREATE OR REPLACE FUNCTION public.safe_check_code(p_code text)
RETURNS TABLE(code_value text, code_exists boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sc.code, true
  FROM public.subscription_codes sc
  WHERE UPPER(sc.code) = UPPER(p_code)
  LIMIT 1;
$$;

-- protect_special_codes: حماية الرمز IMWRA143 من الحذف
CREATE OR REPLACE FUNCTION public.protect_special_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.code = 'IMWRA143' THEN
    RAISE EXCEPTION 'لا يمكن حذف هذا الرمز المحمي: %', OLD.code;
  END IF;
  RETURN OLD;
END;
$$;

-- prevent_duplicate_protected_codes: منع تكرار الرمز المحمي
CREATE OR REPLACE FUNCTION public.prevent_duplicate_protected_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF UPPER(NEW.code) = 'IMWRA143' THEN
    IF EXISTS (SELECT 1 FROM public.subscription_codes WHERE UPPER(code) = 'IMWRA143') THEN
      RAISE EXCEPTION 'هذا الرمز محمي ولا يمكن تكراره: %', NEW.code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- register_host: تسجيل المقدم مع قفل ذري
CREATE OR REPLACE FUNCTION public.register_host(p_session_code text, p_player_name text, p_token uuid)
RETURNS TABLE(success boolean, player_id uuid, error_message text, existing_host_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id UUID;
  v_existing_host RECORD;
  v_player_id UUID;
  v_inactive_threshold INTERVAL := INTERVAL '60 seconds';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(upper(p_session_code)));

  SELECT id INTO v_session_id
  FROM public.game_sessions
  WHERE UPPER(session_code) = UPPER(p_session_code);

  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'الجلسة غير موجودة'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT id, player_name, last_seen, is_connected
  INTO v_existing_host
  FROM public.session_players
  WHERE session_id = v_session_id
    AND role = 'host'
    AND is_connected = TRUE
    AND (last_seen IS NULL OR last_seen > NOW() - v_inactive_threshold)
  ORDER BY last_seen DESC NULLS FIRST
  LIMIT 1;

  IF v_existing_host.id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'يوجد مقدم نشط بالفعل'::TEXT, v_existing_host.player_name;
    RETURN;
  END IF;

  UPDATE public.session_players
  SET is_connected = FALSE
  WHERE session_id = v_session_id AND role = 'host';

  INSERT INTO public.session_players (session_id, player_name, role, token, is_connected, last_seen)
  VALUES (v_session_id, p_player_name, 'host', p_token, TRUE, NOW())
  ON CONFLICT (session_id, player_name, role)
  DO UPDATE SET token = EXCLUDED.token, is_connected = TRUE, last_seen = NOW()
  RETURNING id INTO v_player_id;

  RETURN QUERY SELECT TRUE, v_player_id, NULL::TEXT, NULL::TEXT;
END;
$$;

-- claim_buzzer: حجز الجرس ذرياً
CREATE OR REPLACE FUNCTION public.claim_buzzer(p_session_id uuid, p_player_name text, p_team text)
RETURNS TABLE(success boolean, already_claimed_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_buzzer JSONB;
  v_is_active BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text || '_buzzer'));

  SELECT buzzer::jsonb INTO v_current_buzzer
  FROM public.game_sessions WHERE id = p_session_id;

  IF v_current_buzzer IS NULL THEN
    RETURN QUERY SELECT FALSE, ''::TEXT;
    RETURN;
  END IF;

  v_is_active := COALESCE((v_current_buzzer->>'active')::boolean, false);

  IF v_is_active THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_current_buzzer->>'player', '')::TEXT;
    RETURN;
  END IF;

  UPDATE public.game_sessions
  SET buzzer = jsonb_build_object('active', true, 'player', p_player_name, 'team', p_team, 'timestamp', extract(epoch from now()) * 1000),
      last_activity = now()
  WHERE id = p_session_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

-- reset_buzzer: إعادة تعيين الجرس
CREATE OR REPLACE FUNCTION public.reset_buzzer(p_session_id uuid, p_is_timeout boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text || '_buzzer'));

  IF p_is_timeout THEN
    UPDATE public.game_sessions
    SET buzzer = jsonb_build_object('active', false, 'player', '', 'team', null, 'isTimeOut', true),
        last_activity = now()
    WHERE id = p_session_id;
  ELSE
    UPDATE public.game_sessions
    SET buzzer = jsonb_build_object('active', false, 'player', '', 'team', null),
        last_activity = now()
    WHERE id = p_session_id;
  END IF;
END;
$$;

-- ============================================================
-- 5. المحفزات (Triggers)
-- ============================================================

CREATE TRIGGER protect_special_codes_trigger
  BEFORE DELETE ON public.subscription_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_special_codes();

CREATE TRIGGER prevent_duplicate_protected_codes_trigger
  BEFORE INSERT ON public.subscription_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_protected_codes();

-- ============================================================
-- 6. تفعيل RLS وسياسات الأمان
-- ============================================================

-- subscription_codes: لا سياسات عامة (الوصول فقط عبر safe_check_code و service_role)
ALTER TABLE public.subscription_codes ENABLE ROW LEVEL SECURITY;

-- announcements: قراءة الإعلانات النشطة فقط
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true);

-- general_questions: قراءة فقط
ALTER TABLE public.general_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read general questions"
  ON public.general_questions FOR SELECT
  USING (true);

-- game_sessions: قراءة + إنشاء + تحديث (بدون حذف)
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sessions"
  ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sessions"
  ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sessions"
  ON public.game_sessions FOR UPDATE USING (true);

-- session_players: CRUD كامل
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read players"
  ON public.session_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join as player"
  ON public.session_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update player status"
  ON public.session_players FOR UPDATE USING (true);
CREATE POLICY "Anyone can leave session"
  ON public.session_players FOR DELETE USING (true);

-- session_questions: قراءة + إضافة فقط
ALTER TABLE public.session_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read session questions"
  ON public.session_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can add session questions"
  ON public.session_questions FOR INSERT WITH CHECK (true);

-- ============================================================
-- 7. إدخال الرمز المحمي الأولي
-- ============================================================
INSERT INTO public.subscription_codes (code, is_admin) VALUES ('IMWRA143', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- تم! 🎉
-- الخطوة التالية: انشر Edge Functions الثلاث في مشروعك الخارجي
-- (admin-actions, verify-code, cleanup-stale-sessions)
-- ============================================================
