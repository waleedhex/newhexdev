-- Add RLS policies for announcements management (admin only operations via application logic)
CREATE POLICY "Anyone can insert announcements" 
ON public.announcements 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update announcements" 
ON public.announcements 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete announcements" 
ON public.announcements 
FOR DELETE 
USING (true);

-- Add RLS policies for subscription_codes
CREATE POLICY "Anyone can insert codes" 
ON public.subscription_codes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete codes" 
ON public.subscription_codes 
FOR DELETE 
USING (true);

-- Add RLS policies for general_questions
CREATE POLICY "Anyone can insert questions" 
ON public.general_questions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete questions" 
ON public.general_questions 
FOR DELETE 
USING (true);