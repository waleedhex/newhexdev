-- Create a function to protect specific codes from deletion
CREATE OR REPLACE FUNCTION public.protect_special_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Protect IMWRA143 from deletion
  IF OLD.code = 'IMWRA143' THEN
    RAISE EXCEPTION 'لا يمكن حذف هذا الرمز المحمي: %', OLD.code;
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger to prevent deletion of protected codes
CREATE TRIGGER prevent_protected_code_deletion
  BEFORE DELETE ON public.subscription_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_special_codes();

-- Create a function to prevent inserting duplicate protected codes
CREATE OR REPLACE FUNCTION public.prevent_duplicate_protected_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent inserting IMWRA143 if it already exists (case-insensitive)
  IF UPPER(NEW.code) = 'IMWRA143' THEN
    IF EXISTS (SELECT 1 FROM public.subscription_codes WHERE UPPER(code) = 'IMWRA143') THEN
      RAISE EXCEPTION 'هذا الرمز محمي ولا يمكن تكراره: %', NEW.code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to prevent duplicate protected codes
CREATE TRIGGER prevent_duplicate_protected_code_insert
  BEFORE INSERT ON public.subscription_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_protected_codes();