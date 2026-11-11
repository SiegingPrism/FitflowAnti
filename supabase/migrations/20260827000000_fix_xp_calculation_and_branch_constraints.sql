-- ==============================================================================
-- Migration: 20260827000000_fix_xp_calculation_and_branch_constraints.sql
-- Description:
--   1. Fix complete_task:
--      - Accept optional p_xp_earned (bounded 1..250) to preserve client multipliers.
--      - Safely map task categories (including 'personal') to valid xp_events branches
--        ('focus','health','learning','craft','fitness','study','mental_health','work','other')
--        preventing check constraint violations on xp_events.branch.
--   2. Fix checkin_habit & uncheck_habit:
--      - Align base habit XP to 8 (matching gamification spec & HABIT_BASE_XP) instead of hardcoded 15.
--      - Accept optional p_xp_earned / p_xp_to_remove to keep client and cloud in exact sync.
--   3. Fix record_xp_event:
--      - Support all 8 core branches + other, rather than collapsing non-craft branches into 'craft'.
--      - Sanitize source_type against xp_events_source_type_check.
-- ==============================================================================

-- 1. complete_task
CREATE OR REPLACE FUNCTION public.complete_task(p_task_id UUID, p_xp_earned INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_is_completed BOOLEAN;
  v_xp_awarded   BOOLEAN;
  v_xp_amount    INT;
  v_actual_xp    INT;
  v_category     TEXT;
  v_branch       TEXT := 'craft';
  v_current_date DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, completed, xp_awarded, xp, category
  INTO v_user_id, v_is_completed, v_xp_awarded, v_xp_amount, v_category
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_is_completed THEN
    RETURN jsonb_build_object('success', false, 'message', 'Task already completed');
  END IF;

  -- Mark task complete
  UPDATE public.tasks
  SET completed    = true,
      completed_at = now(),
      xp_awarded   = true
  WHERE id = p_task_id;

  IF v_xp_awarded THEN
    RETURN jsonb_build_object('success', true, 'xp_earned', 0, 'message', 'already_awarded');
  END IF;

  -- Use client computed XP if valid (bounded between 1 and 250), fallback to task.xp
  IF p_xp_earned IS NOT NULL AND p_xp_earned > 0 AND p_xp_earned <= 250 THEN
    v_actual_xp := p_xp_earned;
  ELSE
    v_actual_xp := COALESCE(v_xp_amount, 10);
  END IF;

  -- Map category to valid branch for xp_events
  IF v_category IN ('focus', 'work') THEN v_branch := 'focus';
  ELSIF v_category IN ('health', 'fitness') THEN v_branch := 'health';
  ELSIF v_category IN ('learning', 'study') THEN v_branch := 'learning';
  ELSIF v_category = 'mental_health' THEN v_branch := 'mental_health';
  ELSIF v_category IN ('craft', 'personal') THEN v_branch := 'craft';
  ELSE v_branch := 'other';
  END IF;

  -- Record XP event
  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, v_actual_xp, 'Completed task', v_branch, 'task');

  -- Atomically add to profile total
  PERFORM public.atomic_add_xp(v_user_id, v_actual_xp);

  -- Upsert daily stats strictly in IST
  v_current_date := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
  INSERT INTO public.daily_stats (user_id, date, tasks_completed, xp_earned)
  VALUES (v_user_id, v_current_date, 1, v_actual_xp)
  ON CONFLICT (user_id, date) DO UPDATE SET
    tasks_completed = public.daily_stats.tasks_completed + 1,
    xp_earned       = public.daily_stats.xp_earned + EXCLUDED.xp_earned;

  RETURN jsonb_build_object('success', true, 'xp_earned', v_actual_xp);
END;
$$;

-- Allow complete_task with 1 or 2 parameters for backward compatibility
CREATE OR REPLACE FUNCTION public.complete_task(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.complete_task(p_task_id, NULL);
END;
$$;

-- 2. checkin_habit & uncheck_habit
CREATE OR REPLACE FUNCTION public.checkin_habit(p_habit_id UUID, p_date DATE, p_xp_earned INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_category  TEXT;
  v_actual_xp INT;
  v_branch    TEXT := 'craft';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, category
  INTO v_user_id, v_category
  FROM public.habits
  WHERE id = p_habit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  BEGIN
    INSERT INTO public.habit_checkins (user_id, habit_id, date)
    VALUES (v_user_id, p_habit_id, p_date);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Habit already checked in for today');
  END;

  IF p_xp_earned IS NOT NULL AND p_xp_earned > 0 AND p_xp_earned <= 100 THEN
    v_actual_xp := p_xp_earned;
  ELSE
    v_actual_xp := 8; -- Align with HABIT_BASE_XP
  END IF;

  IF v_category IN ('focus', 'work') THEN v_branch := 'focus';
  ELSIF v_category IN ('health', 'fitness') THEN v_branch := 'health';
  ELSIF v_category IN ('learning', 'study') THEN v_branch := 'learning';
  ELSIF v_category = 'mental_health' THEN v_branch := 'mental_health';
  ELSIF v_category IN ('craft', 'personal') THEN v_branch := 'craft';
  ELSE v_branch := 'craft';
  END IF;

  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, v_actual_xp, 'Completed habit', v_branch, 'habit');

  PERFORM public.atomic_add_xp(v_user_id, v_actual_xp);

  INSERT INTO public.daily_stats (user_id, date, habits_completed, xp_earned)
  VALUES (v_user_id, p_date, 1, v_actual_xp)
  ON CONFLICT (user_id, date) DO UPDATE SET
    habits_completed = public.daily_stats.habits_completed + 1,
    xp_earned        = public.daily_stats.xp_earned + EXCLUDED.xp_earned;

  RETURN jsonb_build_object('success', true, 'xp_earned', v_actual_xp);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_habit(p_habit_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.checkin_habit(p_habit_id, p_date, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.uncheck_habit(p_habit_id UUID, p_date DATE, p_xp_to_remove INT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_deleted   INT;
  v_xp_amount INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_xp_amount := COALESCE(p_xp_to_remove, 8);

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

CREATE OR REPLACE FUNCTION public.uncheck_habit(p_habit_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.uncheck_habit(p_habit_id, p_date, NULL);
END;
$$;

-- 3. record_xp_event
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

  -- Support all branches
  IF p_branch NOT IN ('craft', 'health', 'focus', 'learning', 'fitness', 'study', 'mental_health', 'work', 'other') THEN
    p_branch := 'craft';
  END IF;

  -- Sanitize source type
  IF p_source_type NOT IN ('task', 'habit', 'focus', 'health', 'login') THEN
    p_source_type := 'task';
  END IF;

  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, p_amount, p_reason, p_branch, p_source_type);

  v_new_total := public.atomic_add_xp(v_user_id, p_amount);

  RETURN jsonb_build_object('success', true, 'total_xp', v_new_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_task(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_task(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_habit(UUID, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_habit(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncheck_habit(UUID, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncheck_habit(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_xp_event(INT, TEXT, TEXT, TEXT) TO authenticated;
