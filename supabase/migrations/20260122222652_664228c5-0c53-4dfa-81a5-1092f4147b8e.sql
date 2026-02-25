-- إضافة قيد UNIQUE على session_code لمنع تكرار الجلسات
ALTER TABLE public.game_sessions 
ADD CONSTRAINT game_sessions_session_code_unique UNIQUE (session_code);