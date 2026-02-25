-- Add admin code IMWRA143 if not exists
INSERT INTO public.subscription_codes (code, is_admin)
VALUES ('IMWRA143', true)
ON CONFLICT (code) DO UPDATE SET is_admin = true;