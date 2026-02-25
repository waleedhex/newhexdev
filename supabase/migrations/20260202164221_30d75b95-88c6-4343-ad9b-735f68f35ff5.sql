-- إضافة سياسة حذف لأسئلة الجلسات
CREATE POLICY "Anyone can delete session questions"
ON public.session_questions
FOR DELETE
USING (true);