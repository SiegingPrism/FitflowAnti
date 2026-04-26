# API design

v1 is **client-only** (Zustand + localStorage). This document specifies the cloud API for v2 (when sync + auth ship).

## Conventions
- Postgres schema via Lovable Cloud (Supabase). Access through the auto-generated client — never raw SQL from the frontend.
- Every user-owned table has `user_id uuid not null` and an RLS policy: `auth.uid() = user_id`.
- Roles via `user_roles` table + `has_role(uid, role)` security-definer function (see Lovable docs). **Never** store roles on profiles.
- Timestamps: `created_at timestamptz default now()`, `updated_at timestamptz default now()` with shared trigger `update_updated_at_column()`.

## Tables (target schema)

### `profiles`
| Column | Type |
|---|---|
| user_id | uuid (FK auth.users, unique) |
| display_name | text |
| primary_goal | text  -- ship / fit / learn / recover |
| daily_focus_target_min | int default 50 |
| theme | text default 'midnight' |
| dopamine_control | bool default false |

### `tasks`
title, notes, priority, category, duration_min, xp, due_date, completed, completed_at

### `habits`
name, emoji, color, target_per_week

### `habit_checkins`
habit_id, date  -- unique(habit_id, date)

### `focus_sessions`
task_id (nullable), duration_min, completed_at

### `health_logs`
date (unique per user), water_ml, steps, mood, workouts, sleep_hours

### `xp_events`
amount, reason, branch (focus|health|learning|craft), at

### `coach_responses` (cache)
requested_at, payload jsonb, snapshot_hash text

## Edge functions

### `ai-coach` (shipped)
**POST** `/functions/v1/ai-coach`
```jsonc
// request
{ "snapshot": { "tasks": [...], "habits": [...], "health": [...], "focus": [...], "level": 4, "totalXp": 1240 } }
// response
{ "headline": "...", "insights": ["..."], "suggested_tasks": [{ "title": "...", "priority": "high", "durationMin": 25, "rationale": "..." }] }
```
- Reads `LOVABLE_API_KEY` from env
- Forces tool-call schema (`deliver_coaching`) so output is always parseable
- No DB writes — pure pass-through

### `weekly-plan` (planned)
Same shape, model = `google/gemini-2.5-pro`, returns 7-day plan.

### `burnout-watch` (planned)
Daily cron. Reads last 14 days of mood + completion + sleep, writes a row to `coach_responses` if `burnout_risk > 0.6`.

## Realtime channels
| Channel | Publishes |
|---|---|
| `tasks:{user_id}` | INSERT/UPDATE/DELETE on tasks |
| `habit_checkins:{user_id}` | INSERT for cross-device streak sync |

Enable via `ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;` etc.

## Security checklist
- [ ] RLS on every user-owned table
- [ ] `has_role()` security-definer function for any admin gating
- [ ] No private API keys in the client — only the Supabase publishable/anon key
- [ ] Edge functions verify JWT by default; only `ai-coach` may run with `verify_jwt = false` if we want pre-auth coaching demos

## Migration path from v1 → v2
1. User signs up — onboarding wizard runs.
2. On first sign-in, push the entire `localStorage` payload to cloud via a one-shot import edge function.
3. Switch the Zustand store to a Supabase-backed adapter (subscribe to realtime + write-through to local cache).
4. localStorage becomes the offline cache; Supabase becomes the source of truth.
