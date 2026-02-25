-- إضافة عمود winning_path لتخزين مسار الفوز ومزامنته بين جميع الشاشات
ALTER TABLE public.game_sessions 
ADD COLUMN winning_path jsonb DEFAULT NULL;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.game_sessions.winning_path IS 'مسار الفوز - مصفوفة من الإحداثيات [[row, col], ...] أو null إذا لم يفز أحد';