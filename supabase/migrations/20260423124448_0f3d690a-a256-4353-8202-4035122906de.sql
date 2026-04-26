-- Shared updated_at trigger
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

-- ============== profiles ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Friend',
  primary_goal TEXT CHECK (primary_goal IN ('ship','fit','learn','recover')),
  daily_focus_target_min INT NOT NULL DEFAULT 50,
  theme TEXT NOT NULL DEFAULT 'ember',
  onboarded_at TIMESTAMPTZ,
  total_xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- ============== tasks ==============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('work','personal','health','learning','other')),
  duration_min INT NOT NULL DEFAULT 25,
  xp INT NOT NULL DEFAULT 10,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks select" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tasks insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tasks update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tasks delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_tasks_user_due ON public.tasks(user_id, completed, due_date);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== habits ==============
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  color TEXT NOT NULL DEFAULT 'primary',
  target_per_week INT NOT NULL DEFAULT 7,
  category TEXT CHECK (category IN ('work','personal','health','learning','other')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits select" ON public.habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own habits insert" ON public.habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own habits update" ON public.habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own habits delete" ON public.habits FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER habits_updated_at BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== habit_checkins ==============
CREATE TABLE public.habit_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);
ALTER TABLE public.habit_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins select" ON public.habit_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own checkins insert" ON public.habit_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checkins delete" ON public.habit_checkins FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_checkins_user_date ON public.habit_checkins(user_id, date DESC);

-- ============== focus_sessions ==============
CREATE TABLE public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_min INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own focus select" ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own focus insert" ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own focus delete" ON public.focus_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_focus_user_date ON public.focus_sessions(user_id, completed_at DESC);

-- ============== health_logs ==============
CREATE TABLE public.health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  water_ml INT NOT NULL DEFAULT 0,
  steps INT NOT NULL DEFAULT 0,
  workouts INT NOT NULL DEFAULT 0,
  mood INT CHECK (mood BETWEEN 1 AND 5),
  sleep_hours NUMERIC(3,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health select" ON public.health_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own health insert" ON public.health_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own health update" ON public.health_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER health_logs_updated_at BEFORE UPDATE ON public.health_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== xp_events ==============
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  branch TEXT NOT NULL CHECK (branch IN ('focus','health','learning','craft')),
  source_type TEXT NOT NULL CHECK (source_type IN ('task','habit','focus','health','login')),
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own xp select" ON public.xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own xp insert" ON public.xp_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_xp_user_at ON public.xp_events(user_id, at DESC);