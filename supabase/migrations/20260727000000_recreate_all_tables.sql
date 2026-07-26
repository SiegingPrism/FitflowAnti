-- ==============================================================================
-- FitflowAnti — Canonical Schema Recreation
-- Consolidates: initial schema + cross-life + xp_awarded + primary_goals
-- Run in Supabase SQL Editor to fully reset the schema.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. TEARDOWN — drop everything in reverse-dependency order
-- ------------------------------------------------------------------------------

-- Functions / Triggers that reference tables
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.complete_task(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.checkin_habit(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.atomic_add_xp(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Tables (reverse FK order)
DROP TABLE IF EXISTS public.daily_stats CASCADE;
DROP TABLE IF EXISTS public.xp_events CASCADE;
DROP TABLE IF EXISTS public.health_logs CASCADE;
DROP TABLE IF EXISTS public.focus_sessions CASCADE;
DROP TABLE IF EXISTS public.habit_checkins CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ------------------------------------------------------------------------------
-- 1. SHARED TRIGGER FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. profiles
-- ------------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT        NOT NULL DEFAULT 'Friend',
  primary_goal          TEXT        CHECK (primary_goal IN ('ship','fit','learn','recover')),
  primary_goals         TEXT[],
  daily_focus_target_min INT        NOT NULL DEFAULT 50,
  theme                 TEXT        NOT NULL DEFAULT 'ember',
  onboarded_at          TIMESTAMPTZ,
  total_xp              INT         NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Friend')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. tasks
-- ------------------------------------------------------------------------------

CREATE TABLE public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  notes        TEXT,
  priority     TEXT        NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high','urgent')),
  category     TEXT        NOT NULL DEFAULT 'other'
                           CHECK (category IN ('work','personal','health','learning','fitness','study','mental_health','other')),
  duration_min INT         NOT NULL DEFAULT 25,
  xp           INT         NOT NULL DEFAULT 10,
  xp_awarded   BOOLEAN     NOT NULL DEFAULT FALSE,
  due_date     DATE,
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tasks select" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tasks insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tasks update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tasks delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_due ON public.tasks(user_id, completed, due_date);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. habits
-- ------------------------------------------------------------------------------

CREATE TABLE public.habits (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  emoji          TEXT        NOT NULL DEFAULT '✨',
  color          TEXT        NOT NULL DEFAULT 'primary',
  target_per_week INT        NOT NULL DEFAULT 7,
  category       TEXT        CHECK (category IN ('work','personal','health','learning','fitness','study','mental_health','other')),
  archived_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own habits select" ON public.habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own habits insert" ON public.habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own habits update" ON public.habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own habits delete" ON public.habits FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER habits_updated_at BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. habit_checkins
-- ------------------------------------------------------------------------------

CREATE TABLE public.habit_checkins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   UUID        NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);

ALTER TABLE public.habit_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own checkins select" ON public.habit_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own checkins insert" ON public.habit_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checkins delete" ON public.habit_checkins FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_checkins_user_date ON public.habit_checkins(user_id, date DESC);

-- ------------------------------------------------------------------------------
-- 6. focus_sessions
-- ------------------------------------------------------------------------------

CREATE TABLE public.focus_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      UUID        REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_min INT         NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own focus select" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own focus insert" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own focus delete" ON public.focus_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_focus_user_date ON public.focus_sessions(user_id, completed_at DESC);

-- ------------------------------------------------------------------------------
-- 7. health_logs
-- ------------------------------------------------------------------------------

CREATE TABLE public.health_logs (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE           NOT NULL,
  water_ml    INT            NOT NULL DEFAULT 0,
  steps       INT            NOT NULL DEFAULT 0,
  workouts    INT            NOT NULL DEFAULT 0,
  mood        INT            CHECK (mood BETWEEN 1 AND 5),
  sleep_hours NUMERIC(3,1),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own health select" ON public.health_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own health insert" ON public.health_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own health update" ON public.health_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER health_logs_updated_at BEFORE UPDATE ON public.health_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. xp_events
-- ------------------------------------------------------------------------------

CREATE TABLE public.xp_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INT         NOT NULL,
  reason      TEXT        NOT NULL,
  branch      TEXT        NOT NULL
              CHECK (branch IN ('focus','health','learning','craft','fitness','study','mental_health','work','other')),
  source_type TEXT        NOT NULL
              CHECK (source_type IN ('task','habit','focus','health','login')),
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own xp select" ON public.xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own xp insert" ON public.xp_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_xp_user_at ON public.xp_events(user_id, at DESC);

-- ------------------------------------------------------------------------------
-- 9. daily_stats
-- ------------------------------------------------------------------------------

CREATE TABLE public.daily_stats (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date               DATE        NOT NULL,
  productivity_score INT         DEFAULT 0,
  tasks_completed    INT         DEFAULT 0,
  habits_completed   INT         DEFAULT 0,
  xp_earned          INT         DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own daily_stats select" ON public.daily_stats FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER daily_stats_updated_at BEFORE UPDATE ON public.daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. ATOMIC RPCs
-- ------------------------------------------------------------------------------

-- 10a. atomic_add_xp — race-safe XP increment using row-level lock
CREATE OR REPLACE FUNCTION public.atomic_add_xp(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total INT;
BEGIN
  UPDATE public.profiles
  SET total_xp = total_xp + p_amount
  WHERE user_id = p_user_id
  RETURNING total_xp INTO v_new_total;

  RETURN v_new_total;
END;
$$;

-- 10b. complete_task — atomic task completion with XP guard and daily stats upsert
CREATE OR REPLACE FUNCTION public.complete_task(p_task_id UUID)
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
  v_category     TEXT;
  v_current_date DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock row to prevent race conditions from double-clicks
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

  -- XP already awarded on a previous toggle cycle — skip re-awarding
  IF v_xp_awarded THEN
    RETURN jsonb_build_object('success', true, 'xp_earned', 0, 'message', 'already_awarded');
  END IF;

  -- Record XP event
  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, v_xp_amount, 'Completed task', COALESCE(v_category, 'other'), 'task');

  -- Atomically add to profile total
  PERFORM public.atomic_add_xp(v_user_id, v_xp_amount);

  -- Upsert daily stats
  v_current_date := CURRENT_DATE;
  INSERT INTO public.daily_stats (user_id, date, tasks_completed, xp_earned)
  VALUES (v_user_id, v_current_date, 1, v_xp_amount)
  ON CONFLICT (user_id, date) DO UPDATE SET
    tasks_completed = public.daily_stats.tasks_completed + 1,
    xp_earned       = public.daily_stats.xp_earned + EXCLUDED.xp_earned;

  RETURN jsonb_build_object('success', true, 'xp_earned', v_xp_amount);
END;
$$;

-- 10c. checkin_habit — atomic habit check-in with duplicate guard and daily stats upsert
CREATE OR REPLACE FUNCTION public.checkin_habit(p_habit_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_category  TEXT;
  v_xp_amount INT := 15;
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

  -- UNIQUE(habit_id, date) intercepts duplicates
  BEGIN
    INSERT INTO public.habit_checkins (user_id, habit_id, date)
    VALUES (v_user_id, p_habit_id, p_date);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Habit already checked in for today');
  END;

  -- Record XP event
  INSERT INTO public.xp_events (user_id, amount, reason, branch, source_type)
  VALUES (v_user_id, v_xp_amount, 'Completed habit', COALESCE(v_category, 'other'), 'habit');

  -- Atomically add to profile total
  PERFORM public.atomic_add_xp(v_user_id, v_xp_amount);

  -- Upsert daily stats
  INSERT INTO public.daily_stats (user_id, date, habits_completed, xp_earned)
  VALUES (v_user_id, p_date, 1, v_xp_amount)
  ON CONFLICT (user_id, date) DO UPDATE SET
    habits_completed = public.daily_stats.habits_completed + 1,
    xp_earned        = public.daily_stats.xp_earned + EXCLUDED.xp_earned;

  RETURN jsonb_build_object('success', true, 'xp_earned', v_xp_amount);
END;
$$;
