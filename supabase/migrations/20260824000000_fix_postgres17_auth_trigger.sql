-- ==============================================================================
-- Migration: Fix Google Auth trigger for Supabase PostgreSQL 17.6.1.164+
-- Fixes:
-- 1. search_path setting for Postgres 17 (includes pg_catalog, extensions, auth)
-- 2. Extracting Google OAuth raw_user_meta_data fields (full_name, name, given_name)
-- 3. Exception handling inside handle_new_user() so user creation in auth.users
--    never fails or rolls back during Google login.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions, auth
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  -- Extract display name defensively from Google or Email metadata
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    v_display_name := COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'given_name'
    );
  END IF;

  -- Fallback to email username or 'Friend'
  IF v_display_name IS NULL OR length(trim(v_display_name)) = 0 THEN
    IF NEW.email IS NOT NULL AND position('@' in NEW.email) > 0 THEN
      v_display_name := split_part(NEW.email, '@', 1);
    ELSE
      v_display_name := 'Friend';
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, v_display_name)
    ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name
    WHERE public.profiles.display_name = 'Friend' OR public.profiles.display_name IS NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Log exception without failing the auth.users transaction
    RAISE LOG 'Warning: Exception in handle_new_user for user_id %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Re-create trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure execution permissions for auth service role and public roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated, service_role, postgres;
