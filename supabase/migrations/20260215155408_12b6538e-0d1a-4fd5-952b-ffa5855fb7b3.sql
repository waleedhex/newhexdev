
-- Create a secure function to check codes without exposing is_admin
CREATE OR REPLACE FUNCTION public.safe_check_code(p_code text)
RETURNS TABLE(code_value text, code_exists boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.code, true
  FROM public.subscription_codes sc
  WHERE UPPER(sc.code) = UPPER(p_code)
  LIMIT 1;
$$;
