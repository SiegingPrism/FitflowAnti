-- Add primary_goals array column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_goals TEXT[];

-- Update primary_goals to match the current primary_goal
UPDATE public.profiles SET primary_goals = ARRAY[primary_goal] WHERE primary_goal IS NOT NULL AND primary_goals IS NULL;
