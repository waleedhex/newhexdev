-- إضافة قيد UNIQUE المطلوب لدالة register_host
-- هذا يمنع تكرار نفس اللاعب بنفس الدور في نفس الجلسة

ALTER TABLE public.session_players
ADD CONSTRAINT session_players_unique_player_role 
UNIQUE (session_id, player_name, role);