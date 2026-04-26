# Data Tracking — what we record and why

Everything below is local-first (`localStorage` via Zustand `persist`). Cloud sync is opt-in (Tier 2).

## Event ledger
Every state change emits one of these events. They feed both the gamification engine and the AI Coach.

| Event | Payload | Purpose |
|---|---|---|
| `task.created` | id, priority, category, durationMin, dueDate | Planning volume |
| `task.completed` | id, completedAt, xpAwarded | Core loop signal |
| `task.deleted` | id | Detect over-planning |
| `habit.checked` | id, date, streak | Streak engine |
| `focus.completed` | duration, taskId, completedAt | Deep work signal |
| `health.logged` | date, field, value | Body signal |
| `mood.logged` | date, value (1–5) | Burnout signal |
| `xp.awarded` | amount, reason, at | Audit trail |
| `level.up` | newLevel | Reward trigger |
| `coach.requested` | timestamp | Engagement signal |
| `coach.accepted` | suggestionId | Coach quality feedback |

## Derived metrics (computed, not stored)
- **Daily score** — see `system-design/gamification.md §7`
- **Peak hours** — for each completed task, take `hour(completedAt)`; histogram over last 30 days
- **Completion rate** — `completed / planned` for a window
- **Burnout risk** — see `ai/recommendation-engine.md §Phase 2`
- **Branch levels** — XP grouped by category mapped to skill tree

## Retention
- Tasks/habits/health logs: forever (until user clears)
- `xpHistory`: last 50 events (UI only — full history is reconstructable from task/habit/focus tables)
- `focusSessions`: last 365 days

## Export
Settings page exposes JSON export. The same JSON is the cloud-sync payload when that ships.
