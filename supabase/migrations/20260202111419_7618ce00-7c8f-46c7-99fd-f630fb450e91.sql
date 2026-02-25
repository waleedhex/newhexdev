-- إصلاح منع دخول أكثر من مقدم لنفس الجلسة عبر قفل ذري على مستوى الجلسة
-- نستخدم pg_advisory_xact_lock لتسلسل عمليات التسجيل لنفس session_code

CREATE OR REPLACE FUNCTION public.register_host(p_session_code text, p_player_name text, p_token uuid)
RETURNS TABLE(success boolean, player_id uuid, error_message text, existing_host_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id UUID;
  v_existing_host RECORD;
  v_player_id UUID;
  v_inactive_threshold INTERVAL := INTERVAL '60 seconds';
BEGIN
  -- 0) قفل ذري خاص بهذه الجلسة لمنع أي Race Condition
  -- نستخدم نص موحّد (UPPER) حتى لا تختلف الأقفال بسبب اختلاف حالة الأحرف
  PERFORM pg_advisory_xact_lock(hashtext(upper(p_session_code)));

  -- 1) الحصول على session_id
  SELECT id INTO v_session_id
  FROM public.game_sessions
  WHERE UPPER(session_code) = UPPER(p_session_code);

  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'الجلسة غير موجودة'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 2) البحث عن مقدم نشط (متصل + آخر ظهور أقل من 60 ثانية)
  SELECT id, player_name, last_seen, is_connected
  INTO v_existing_host
  FROM public.session_players
  WHERE session_id = v_session_id
    AND role = 'host'
    AND is_connected = TRUE
    AND (last_seen IS NULL OR last_seen > NOW() - v_inactive_threshold)
  ORDER BY last_seen DESC NULLS FIRST
  LIMIT 1;

  -- 3) إذا وجد مقدم نشط، نرفض التسجيل
  IF v_existing_host.id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'يوجد مقدم نشط بالفعل'::TEXT, v_existing_host.player_name;
    RETURN;
  END IF;

  -- 4) تعطيل أي مقدمين قدامى غير نشطين
  UPDATE public.session_players
  SET is_connected = FALSE
  WHERE session_id = v_session_id
    AND role = 'host';

  -- 5) تسجيل المقدم الجديد (upsert)
  INSERT INTO public.session_players (session_id, player_name, role, token, is_connected, last_seen)
  VALUES (v_session_id, p_player_name, 'host', p_token, TRUE, NOW())
  ON CONFLICT (session_id, player_name, role)
  DO UPDATE SET
    token = EXCLUDED.token,
    is_connected = TRUE,
    last_seen = NOW()
  RETURNING id INTO v_player_id;

  -- 6) إرجاع النجاح
  RETURN QUERY SELECT TRUE, v_player_id, NULL::TEXT, NULL::TEXT;
END;
$function$;