# UI → Action → State → Data map

> Removes the "the UI isn't connected to logic" gap. For every interactive control in v1, this doc names the component, the store action it calls, the state it mutates, and the data event it produces.

Today (v1) the "data layer" is `localStorage` via Zustand `persist`. Each row in the table also lists the v2 cloud table that will own the same data.

| # | UI control | File | Store action (`useAppStore`) | State mutated | XP / event emitted | v2 table |
|---|---|---|---|---|---|---|
| 1 | Tap checkbox on a task | `dashboard/TodayTasks.tsx`, `pages/Tasks.tsx` | `toggleTask(id)` | `tasks[i].completed`, `tasks[i].completedAt` | `awardXP(task.xp, "Completed: ...")` → `xpHistory` + `totalXP` | `tasks` + `xp_events` |
| 2 | Submit "new task" form | `pages/Tasks.tsx` (and `+` on Dashboard) | `addTask({ title, priority, category, durationMin, dueDate })` | `tasks` prepended | none on creation | `tasks` |
| 3 | Edit task fields inline | `pages/Tasks.tsx` | `updateTask(id, patch)` | `tasks[i]` merged | none | `tasks` |
| 4 | Delete a task | `pages/Tasks.tsx` | `removeTask(id)` | `tasks` filtered | none | `tasks` (hard delete, or soft via `archived_at` in v2) |
| 5 | Tap a habit chip today | `dashboard/HabitsStrip.tsx`, `pages/Habits.tsx` | `toggleHabitToday(id)` | `habits[i].history` adds/removes today's date | `awardXP(8, "Habit: ...")` on add | `habit_checkins` + `xp_events` |
| 6 | Add new habit | `pages/Habits.tsx` | `addHabit({ name, emoji, color, targetPerWeek })` | `habits` appended | none | `habits` |
| 7 | Remove habit | `pages/Habits.tsx` | `removeHabit(id)` | `habits` filtered | none | `habits` (soft delete in v2) |
| 8 | "Start focus" → ring completes | `pages/Focus.tsx` | `logFocusSession({ durationMin, taskId? })` | `focusSessions` prepended | `awardXP(round(min/5)*5, "Focus: Nm")` | `focus_sessions` + `xp_events` |
| 9 | +250ml water / +500 steps / +1 workout | `dashboard/QuickHealth.tsx`, `pages/Health.tsx` (planned) | `logHealth({ waterMl?, steps?, workouts? })` | `healthLogs[today]` upserted | none in v1; v2 awards XP at goal threshold | `health_logs` |
| 10 | Pick a mood (1–5) | `dashboard/QuickHealth.tsx` | `setMood(mood)` → `logHealth({ mood })` | `healthLogs[today].mood` | none | `health_logs` |
| 11 | "Get fresh insights" on Coach | `pages/Coach.tsx` | inline: `supabase.functions.invoke('ai-coach', { snapshot })` | local React state | none (logs `coach.requested` in v2) | `coach_responses` (v2) |
| 12 | Accept a coach suggestion | `pages/Coach.tsx` | `addTask(...)` from suggestion payload | `tasks` prepended | none on creation | `tasks` |
| 13 | Switch theme | `pages/Settings.tsx` → `lib/theme.ts` | `applyTheme(t)` + persist to `localStorage['theme']` | `<html>` data-theme + class | none | `profiles.theme` (v2) |
| 14 | Edit display name | `pages/Settings.tsx` | `setUserName(name)` | `userName` | none | `profiles.display_name` (v2) |
| 15 | Export JSON | `pages/Settings.tsx` | inline: `JSON.stringify(useAppStore.getState())` | none | none | n/a (always client) |

## Derived values (read-only, computed on render)
| Value | Where computed | From |
|---|---|---|
| Daily productivity score | `dashboard/HeroCard.tsx` | `tasks` (today filter) + `focusSessions` (today) + `totalXP` |
| Level + xp-in-level + xp-to-next | `lib/store.ts → getLevel(totalXP)` | `totalXP` |
| Habit current streak | `pages/Habits.tsx` | walk back from today over `habit.history` |
| 30-day heatmap | `pages/Habits.tsx` | bucket `habit.history` by date |
| Peak hour chart | `dashboard/SideCards.tsx → PeakHourCard` | `tasks.completedAt` histogram |
| 7-day activity bars | `pages/Insights.tsx` | last 7 days of `tasks` + `focusSessions` |
| Priority distribution donut | `pages/Insights.tsx` | grouping over `tasks` |

## Invariants the store guarantees
1. **`totalXP` only ever grows.** It is never decremented (no decay).
2. **`xpHistory` keeps the last 50 events.** Full history is reconstructable from `tasks.completedAt` + `habit.history` + `focusSessions`.
3. **`healthLogs` has at most one entry per `date`** — `logHealth` upserts.
4. **`tasks[i].completed` and `completedAt` are written together** in the same `set()` call.
5. **Toggling a habit twice in one day is a no-op for streaks** but does award/revoke the XP cleanly via `toggleHabitToday`.

## Why this map matters
- It's the contract between design and engineering. New UI cannot ship without naming its row in this table.
- It maps 1:1 to v2 cloud tables, so when sync ships we change the **action implementation**, not the call sites.
- Every "what happens when I click this?" question now has an answer in one place.
