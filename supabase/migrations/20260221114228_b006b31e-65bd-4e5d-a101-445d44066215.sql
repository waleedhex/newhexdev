
-- Atomic buzzer claim: only first player can claim when buzzer is inactive
CREATE OR REPLACE FUNCTION public.claim_buzzer(
  p_session_id UUID,
  p_player_name TEXT,
  p_team TEXT
)
RETURNS TABLE(success BOOLEAN, already_claimed_by TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_buzzer JSONB;
  v_is_active BOOLEAN;
BEGIN
  -- Advisory lock per session to serialize buzzer claims
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text || '_buzzer'));

  -- Read current buzzer state
  SELECT buzzer::jsonb INTO v_current_buzzer
  FROM public.game_sessions
  WHERE id = p_session_id;

  IF v_current_buzzer IS NULL THEN
    RETURN QUERY SELECT FALSE, ''::TEXT;
    RETURN;
  END IF;

  v_is_active := COALESCE((v_current_buzzer->>'active')::boolean, false);

  -- If buzzer already active, reject
  IF v_is_active THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_current_buzzer->>'player', '')::TEXT;
    RETURN;
  END IF;

  -- Claim the buzzer atomically
  UPDATE public.game_sessions
  SET buzzer = jsonb_build_object(
    'active', true,
    'player', p_player_name,
    'team', p_team,
    'timestamp', extract(epoch from now()) * 1000
  ),
  last_activity = now()
  WHERE id = p_session_id;

  RETURN QUERY SELECT TRUE, ''::TEXT;
END;
$$;

-- Atomic buzzer reset
CREATE OR REPLACE FUNCTION public.reset_buzzer(
  p_session_id UUID,
  p_is_timeout BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text || '_buzzer'));

  IF p_is_timeout THEN
    -- First set timeout state
    UPDATE public.game_sessions
    SET buzzer = jsonb_build_object(
      'active', false,
      'player', '',
      'team', null,
      'isTimeOut', true
    ),
    last_activity = now()
    WHERE id = p_session_id;
  ELSE
    UPDATE public.game_sessions
    SET buzzer = jsonb_build_object(
      'active', false,
      'player', '',
      'team', null
    ),
    last_activity = now()
    WHERE id = p_session_id;
  END IF;
END;
$$;
