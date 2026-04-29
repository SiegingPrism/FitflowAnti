-- Add xp_awarded flag to prevent infinite XP from unchecking and re-checking tasks
ALTER TABLE public.tasks ADD COLUMN xp_awarded BOOLEAN NOT NULL DEFAULT FALSE;

-- Update the complete_task RPC to respect the new flag
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
  v_xp_awarded BOOLEAN;
  v_xp_amount INT;
  v_category TEXT;
  v_current_date DATE;
BEGIN
  -- Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row for update to prevent race conditions from double clicks
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
    -- Already completed
    RETURN jsonb_build_object('success', false, 'message', 'Task already completed');
  END IF;

  -- Mark task as complete
  UPDATE public.tasks
  SET completed = true,
      completed_at = now(),
      xp_awarded = true
  WHERE id = p_task_id;

  IF v_xp_awarded THEN
    -- Already awarded XP before (e.g. checked, unchecked, checked again)
    RETURN jsonb_build_object('success', true, 'xp_earned', 0, 'message', 'already_awarded');
  END IF;

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
