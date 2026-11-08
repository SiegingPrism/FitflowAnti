-- ==============================================================================
-- Migration: 20260826000000_realtime_and_habit_uncheck.sql
--   1. Publish every synced table to Supabase Realtime (only tasks/habits/profiles
--      were published, so check-ins, focus, health and XP never streamed live).
--   2. uncheck_habit RPC — un-ticking a habit now syncs and reverses its XP.
--   3. reset_my_progress RPC — Settings → Reset can't touch total_xp directly
--      any more (protect_profile_system_fields), so it runs server-side.
-- ==============================================================================

-- 1. Realtime publication (idempotent)
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY ARRAY['tasks','habits','habit_checkins','focus_sessions','health_logs','xp_events','profiles']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;

-- 2. uncheck_habit
CREATE OR REPLACE FUNCTION public.uncheck_habit(p_habit_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_deleted   INT;
  v_xp_amount INT := 15; -- must match checkin_habit
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.habit_checkins
  WHERE habit_id = p_habit_id AND date = p_date AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No check-in to remove');
  END IF;

  UPDATE public.profiles
  SET total_xp = GREATEST(total_xp - v_xp_amount, 0)
  WHERE user_id = v_user_id;

  UPDATE public.daily_stats
  SET habits_completed = GREATEST(habits_completed - 1, 0),
      xp_earned        = GREATEST(xp_earned - v_xp_amount, 0)
  WHERE user_id = v_user_id AND date = p_date;

  RETURN jsonb_build_object('success', true, 'xp_removed', v_xp_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.uncheck_habit(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uncheck_habit(UUID, DATE) TO authenticated;

-- 3. reset_my_progress
CREATE OR REPLACE FUNCTION public.reset_my_progress()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.habit_checkins WHERE user_id = v_user_id;
  DELETE FROM public.tasks          WHERE user_id = v_user_id;
  DELETE FROM public.habits         WHERE user_id = v_user_id;
  DELETE FROM public.focus_sessions WHERE user_id = v_user_id;
  DELETE FROM public.health_logs    WHERE user_id = v_user_id;
  DELETE FROM public.xp_events      WHERE user_id = v_user_id;
  DELETE FROM public.daily_stats    WHERE user_id = v_user_id;

  UPDATE public.profiles
  SET total_xp = 0, onboarded_at = NULL, primary_goal = NULL, primary_goals = NULL
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_my_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_my_progress() TO authenticated;
