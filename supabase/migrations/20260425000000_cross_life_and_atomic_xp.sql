-- ==============================================================================
-- Migration: Cross-Life Integration & Atomic Transactions
-- Purpose: 
-- 1. Extend categories for Cross-Life Tracking (Mental Health, Fitness, etc.)
-- 2. Create the Daily Stats tracking table
-- 3. Create Atomic RPCs for Task & Habit completion to prevent duplicate XP
-- ==============================================================================

-- 1. Extend categories for Cross-Life Integration
-- We update the constraints to natively support the new Behavior Engine pillars.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_category_check 
  CHECK (category IN ('work','personal','health','learning','fitness','study','mental_health','other'));

ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_category_check;
ALTER TABLE public.habits ADD CONSTRAINT habits_category_check 
  CHECK (category IN ('work','personal','health','learning','fitness','study','mental_health','other'));

ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_branch_check;
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_branch_check 
  CHECK (branch IN ('focus','health','learning','craft','fitness','study','mental_health','work','other'));

-- 2. Create 'daily_stats' table for daily loop and productivity score
CREATE TABLE IF NOT EXISTS public.daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  productivity_score INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  habits_completed INT DEFAULT 0,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily_stats select" ON public.daily_stats FOR SELECT USING (auth.uid() = user_id);
-- Trigger for updated_at
DROP TRIGGER IF EXISTS daily_stats_updated_at ON public.daily_stats;
CREATE TRIGGER daily_stats_updated_at BEFORE UPDATE ON public.daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- XP System Core Logic
-- Handles concurrent updates safely to avoid lost updates during rapid check-ins
CREATE OR REPLACE FUNCTION public.atomic_add_xp(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_total INT;
BEGIN
    -- This entirely prevents the "spam click XP" bug by using row-level locking (FOR UPDATE)
    UPDATE public.profiles
    SET total_xp = total_xp + p_amount
    WHERE user_id = p_user_id
    RETURNING total_xp INTO v_new_total;

    RETURN v_new_total;
END;
$$;

-- 3. Atomic Task Completion RPC
-- This entirely prevents the "spam click XP" bug by using row-level locking (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.complete_task(
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_completed BOOLEAN;
  v_xp_amount INT;
  v_category TEXT;
  v_current_date DATE;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row for update to prevent race conditions from double clicks
  SELECT user_id, completed, xp, category
  INTO v_user_id, v_is_completed, v_xp_amount, v_category
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
    -- Already completed, safely return without awarding duplicate XP
    RETURN jsonb_build_object('success', false, 'message', 'Task already completed');
  END IF;

  -- Mark task as complete
  UPDATE public.tasks
  SET completed = true,
      completed_at = now()
  WHERE id = p_task_id;

  -- Insert XP event for analytics/Behavior Engine
  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, v_xp_amount, 'Completed task', COALESCE(v_category, 'other'), 'task');

  -- Update Total XP in user profile securely using the new atomic function
  PERFORM public.atomic_add_xp(v_user_id, v_xp_amount);
  
  -- Update Daily Stats Atomically
  v_current_date := CURRENT_DATE;
  INSERT INTO public.daily_stats (user_id, date, tasks_completed, xp_earned)
  VALUES (v_user_id, v_current_date, 1, v_xp_amount)
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    tasks_completed = public.daily_stats.tasks_completed + 1,
    xp_earned = public.daily_stats.xp_earned + EXCLUDED.xp_earned;

  RETURN jsonb_build_object('success', true, 'xp_earned', v_xp_amount);
END;
$$;

-- 4. Atomic Habit Check-in RPC
-- Relies on UNIQUE constraint to catch duplicates
CREATE OR REPLACE FUNCTION public.checkin_habit(
  p_habit_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_category TEXT;
  v_xp_amount INT := 15; -- Base XP for a habit (can be dynamic later via Behavior Engine)
BEGIN
  -- Verify authentication
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

  -- Attempt to insert check-in. The UNIQUE(habit_id, date) constraint will intercept duplicates.
  BEGIN
    INSERT INTO public.habit_checkins (user_id, habit_id, date)
    VALUES (v_user_id, p_habit_id, p_date);
  EXCEPTION WHEN unique_violation THEN
    -- Double click / already checked in for this date
    RETURN jsonb_build_object('success', false, 'message', 'Habit already checked in for today');
  END;

  -- Insert XP Event
  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, v_xp_amount, 'Completed habit', COALESCE(v_category, 'other'), 'habit');

  -- Update Total XP in profile securely using the new atomic function
  PERFORM public.atomic_add_xp(v_user_id, v_xp_amount);

  -- Update Daily Stats Atomically
  INSERT INTO public.daily_stats (user_id, date, habits_completed, xp_earned)
  VALUES (v_user_id, p_date, 1, v_xp_amount)
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    habits_completed = public.daily_stats.habits_completed + 1,
    xp_earned = public.daily_stats.xp_earned + EXCLUDED.xp_earned;

  RETURN jsonb_build_object('success', true, 'xp_earned', v_xp_amount);
END;
$$;
