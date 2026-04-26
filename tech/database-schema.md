# Database schema

Target schema for v2 (Lovable Cloud / Supabase). v1 is local-only via Zustand `persist`; v1 → v2 migration path lives in `tech/api-design.md §Migration`.

All tables: `id uuid pk default gen_random_uuid()`, `user_id uuid not null`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` with a shared `update_updated_at_column()` trigger. Every table has RLS enabled with the policy `auth.uid() = user_id` for select/insert/update/delete.

---

## `profiles` — one row per auth user
| Column | Type | Notes |
|---|---|---|
| user_id | uuid unique, FK auth.users | |
| display_name | text | from onboarding |
| primary_goal | text check (in 'ship','fit','learn','recover') | |
| daily_focus_target_min | int default 50 | |
| theme | text default 'midnight' | unlockable themes |
| dopamine_control | bool default false | caps daily XP, mutes animations |
| onboarded_at | timestamptz | null = show onboarding |

## `tasks`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| title | text not null | |
| notes | text | |
| priority | text check (in 'low','medium','high','urgent') | |
| category | text check (in 'work','personal','health','learning','other') | |
| duration_min | int default 25 | |
| xp | int not null | snapshotted at creation |
| due_date | date | nullable = no due date |
| completed | bool default false | |
| completed_at | timestamptz | null when not completed |

Indexes: `(user_id, completed, due_date)`, `(user_id, completed_at desc)`.

## `habits`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| name | text not null | |
| emoji | text | |
| color | text | semantic token name |
| target_per_week | int default 7 | |
| archived_at | timestamptz | soft delete |

## `habit_checkins`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| habit_id | uuid FK habits | on delete cascade |
| date | date not null | |

Unique `(habit_id, date)`. Index `(user_id, date desc)`.

## `focus_sessions`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| task_id | uuid FK tasks | nullable, on delete set null |
| duration_min | int not null | |
| completed_at | timestamptz default now() | |

Index `(user_id, completed_at desc)`.

## `health_logs`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| date | date not null | |
| water_ml | int default 0 | |
| steps | int default 0 | |
| workouts | int default 0 | |
| mood | int check (between 1 and 5) | |
| sleep_hours | numeric(3,1) | |

Unique `(user_id, date)`.

## `xp_events` — the audit trail powering the gamification engine
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| amount | int not null | post-multipliers |
| reason | text not null | "Completed: Ship docs" etc. |
| branch | text check (in 'focus','health','learning','craft') | for skill trees |
| source_type | text | 'task' / 'habit' / 'focus' / 'health' / 'login' |
| source_id | uuid | nullable FK to source row |
| at | timestamptz default now() | |

Index `(user_id, at desc)`, `(user_id, branch, at desc)`.

## `rewards` — catalog (global, no user_id, RLS allows read for all authenticated)
| Column | Type | Notes |
|---|---|---|
| id | text pk | 'theme.aurora', 'boost.weekly_plan' |
| kind | text | 'theme' / 'boost' / 'sound' |
| label | text | |
| unlock_rule | jsonb | `{ "type":"level", "min":3 }` or `{ "type":"branch", "branch":"focus", "min":5 }` |
| cost_xp | int default 0 | shop items |

## `user_unlocks`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| reward_id | text FK rewards | |
| unlocked_at | timestamptz default now() | |

Unique `(user_id, reward_id)`.

## `coach_responses` — cache + history for the AI Coach
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| requested_at | timestamptz default now() | |
| snapshot_hash | text | dedupe identical requests |
| payload | jsonb not null | `{ headline, insights[], suggested_tasks[] }` |
| accepted_suggestions | jsonb default '[]'::jsonb | feedback loop |

Index `(user_id, requested_at desc)`.

---

## RLS policy template (apply to every user-owned table)
```sql
alter table public.<t> enable row level security;

create policy "own select" on public.<t> for select using (auth.uid() = user_id);
create policy "own insert" on public.<t> for insert with check (auth.uid() = user_id);
create policy "own update" on public.<t> for update using (auth.uid() = user_id);
create policy "own delete" on public.<t> for delete using (auth.uid() = user_id);
```

## Roles (for admin tooling later)
Per Lovable rules, roles live in `user_roles` + `has_role()` security-definer function — **never** on `profiles`. See `lovable-docs` for the canonical pattern.

## Realtime publications (planned)
```sql
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.habit_checkins;
alter publication supabase_realtime add table public.xp_events;
```

## Why this schema
- **Append-only `xp_events`** lets us re-derive levels, branches, and analytics without trusting a cached `total_xp`.
- **Soft delete on `habits`** preserves streak history when a user retires a habit.
- **`coach_responses` cache** avoids hitting the AI Gateway when the snapshot hasn't changed.
- **No `streak` column anywhere** — streaks are derived from `habit_checkins` / `xp_events` so they can never go out of sync.
