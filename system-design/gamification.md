# Gamification Engine

The engine that turns FlowSphere from a productivity app into a Life RPG.

## 1. XP economy

### Base XP table
| Action | Base XP |
|---|---|
| Complete task — low priority | 5 |
| Complete task — medium | 10 |
| Complete task — high | 20 |
| Complete task — urgent | 35 |
| Habit check-in | 8 |
| Focus session | `round(minutes / 5) * 5` (so 25m = 25 XP, 50m = 50) |
| Daily mood log | 3 |
| Hit water goal | 5 |
| Hit step goal | 10 |
| Daily login (first action of day) | 5 |

### Multipliers
```
final_xp = base_xp
        * streak_multiplier(current_streak)
        * difficulty_multiplier(user_level, action_difficulty)
        * daily_bonus_multiplier(actions_today)
```

- `streak_multiplier`: `1 + min(streak_days, 30) * 0.02`  → caps at **1.6×** at 30-day streak
- `difficulty_multiplier`: `1.0` baseline; `0.9` if action is far below user's level (anti-grinding); `1.15` if at or above level
- `daily_bonus_multiplier`: first 3 actions of the day = `1.25×` (encourages opening the app)

## 2. Levels
```
level = floor(sqrt(total_xp / 60))
xp_to_next_level = ((level + 1)^2 * 60) - total_xp
```
- Level 1 reached at 60 XP
- Level 5 at 1,500 XP
- Level 10 at 6,000 XP
- Level 25 at 37,500 XP — "Ascended" tier

The current implementation in `src/lib/store.ts` uses a stepped 120 → ×1.15 curve. This spec is the **target** curve for v2 (smoother, predictable, sqrt-based).

## 3. Streaks
- **Habit streak** — consecutive days a habit was checked.
- **Daily streak** — consecutive days the user completed *any* meaningful action.
- **Focus streak** — consecutive days with ≥ 1 focus session.

### Loss & grace
- One **freeze token** per 7-day streak earned (auto-applied).
- Beyond freeze: streak resets to 0, but the *longest streak ever* is preserved as a badge.

## 4. Skill trees
Every XP event routes into one of four branches based on category:

| Branch | Feeds from |
|---|---|
| ⚡ Focus | Pomodoro sessions, "work" tasks |
| 🌱 Health | Habits with health emoji, water, steps, workouts, mood logs |
| 📚 Learning | "learning" category tasks, reading habits |
| 🎨 Craft | "personal" + "other" creative work |

Each branch has its own level. The user's **overall level** is the average. Branch levels unlock branch-specific perks.

## 5. Rewards & unlocks
| Unlock | Cost / condition |
|---|---|
| Theme: "Aurora" | Reach overall level 3 |
| Theme: "Carbon" | Reach overall level 7 |
| Theme: "Solar" | Reach overall level 12 |
| AI Coach: weekly plan generation | Focus branch L5 |
| AI Coach: burnout watch | Health branch L5 |
| Custom habit colors | Craft branch L3 |
| Sound packs (focus chimes) | 500 XP shop purchase |
| Streak freeze tokens (extra) | 200 XP each |

XP is **spent** on shop items but **never lost** from the level total — separate `total_xp` (lifetime) and `xp_balance` (spendable) ledgers.

## 6. Penalties (gentle)
- **No XP decay.** Decay punishes life events (illness, travel) and kills retention.
- **Streak loss** is the only penalty, and freeze tokens cushion it.
- Missed-day shame is replaced by Coach's "welcome back" nudge.

## 7. Daily Productivity Score

```
score = clamp(0, 100,
    (completed_tasks / max(planned_tasks, 1)) * 50
  + (focus_minutes / focus_target_minutes)    * 30
  + streak_factor                             * 20
)

streak_factor = min(daily_streak / 30, 1)
```

Visualized as:
- The big number on the Dashboard hero
- A bar that fills toward 100
- Color: red < 40, amber 40–70, green > 70, gradient-glow > 90

## 8. Anti-burnout & dopamine control
- If `mood ≤ 2` for 3+ days OR `score ≥ 80` for 7+ days, the engine auto-suggests a **Recovery Mission**: 3 small, restorative tasks worth 2× XP each.
- **Dopamine Control mode** (opt-in setting): caps daily XP at user-defined limit, reduces animations to subtle, hides the level bar.

## 9. Implementation notes
- Engine lives in `src/lib/store.ts` (`awardXP`, `getLevel`).
- All multipliers should move into a pure `src/lib/gamification.ts` module so they're unit-testable.
- All XP events are logged to `xpHistory` (last 50) — keep this for the Insights page and AI context.
