-- ==============================================================================
-- Migration: 20260825000000_security_and_xp_hardening.sql
-- Description:
--   1. Harden atomic_add_xp: restrict execution to postgres/service_role (REVOKE from PUBLIC/anon/authenticated),
--      and verify auth.uid() == p_user_id to prevent cross-user XP tampering.
--   2. Protect public.profiles.total_xp from direct client updates via BEFORE UPDATE trigger.
--   3. Add public.record_xp_event RPC for safe, verified client XP awards (focus, mood, etc.).
-- ==============================================================================

-- 1. Prevent direct updates to total_xp from client sessions
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Disallow direct updates to total_xp from authenticated / anon clients
  IF NEW.total_xp IS DISTINCT FROM OLD.total_xp AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Direct update to total_xp is forbidden. XP must be earned through verified actions.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_system_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_system_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_system_fields();

-- 2. Harden atomic_add_xp
CREATE OR REPLACE FUNCTION public.atomic_add_xp(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total INT;
BEGIN
  -- Prevent modifying other users' XP if called with auth session
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot award XP to another user';
  END IF;

  IF p_amount <= 0 OR p_amount > 1000 THEN
    RAISE EXCEPTION 'Invalid XP amount: %', p_amount;
  END IF;

  UPDATE public.profiles
  SET total_xp = total_xp + p_amount
  WHERE user_id = p_user_id
  RETURNING total_xp INTO v_new_total;

  RETURN v_new_total;
END;
$$;

-- Revoke direct execution from anon & authenticated clients
REVOKE EXECUTE ON FUNCTION public.atomic_add_xp(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_add_xp(UUID, INT) TO service_role, postgres;

-- 3. Controlled RPC for authorized client XP events (focus sessions, mood tracking)
CREATE OR REPLACE FUNCTION public.record_xp_event(
  p_amount INT,
  p_reason TEXT,
  p_branch TEXT,
  p_source_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_total INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 OR p_amount > 250 THEN
    RAISE EXCEPTION 'XP amount out of allowed bounds: %', p_amount;
  END IF;

  IF p_branch NOT IN ('craft', 'health', 'focus', 'learning') THEN
    p_branch := 'craft';
  END IF;

  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, p_amount, p_reason, p_branch, p_source_type);

  v_new_total := public.atomic_add_xp(v_user_id, p_amount);

  RETURN jsonb_build_object('success', true, 'total_xp', v_new_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_xp_event(INT, TEXT, TEXT, TEXT) TO authenticated;

