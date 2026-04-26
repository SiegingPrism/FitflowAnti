# App Flow

Textual flow diagrams. Render with Mermaid in any markdown viewer.

## 1. First-run onboarding (≤ 60s)
```mermaid
flowchart TD
  A[Open app] --> B[Pick your name]
  B --> C[Choose 1 primary goal: Ship more / Get fit / Learn / Recover]
  C --> D[Pick 2-3 starter habits from goal-aware list]
  D --> E[Set daily focus target: 25 / 50 / 90 min]
  E --> F[Tour: Dashboard tour with 3 highlights]
  F --> G[Land on Dashboard, AI Coach card pre-loaded with first nudge]
```

## 2. Daily core loop
```mermaid
flowchart LR
  Open[Open Dashboard] --> Score[See today's score + streak]
  Score --> Coach[Read AI nudge]
  Coach --> Pick[Pick a task]
  Pick --> Focus[Start Pomodoro]
  Focus --> Done[Mark task done → +XP, +score, animation]
  Done --> Habit[Tick habit when relevant]
  Habit --> Score
```

## 3. Task creation
```mermaid
flowchart TD
  A[+ button anywhere] --> B[Quick capture: title only]
  B --> C{AI suggests priority + category + duration?}
  C -- yes --> D[Pre-fill, user can edit]
  C -- no --> E[Default: medium / personal / 25m]
  D --> F[Save → appears in Today + Tasks]
  E --> F
```

## 4. Gamification loop
```mermaid
flowchart LR
  Action[Any action: task, habit, focus, health log] --> XP[Award XP]
  XP --> Level{Level up?}
  Level -- yes --> Unlock[Check rewards: theme / boost / feature]
  Level -- no --> Streak[Update streak counters]
  Unlock --> Streak
  Streak --> Score[Recompute daily productivity score]
  Score --> Feedback[Visual feedback: confetti / glow / number rise]
```

## 5. AI suggestion loop
```mermaid
flowchart TD
  Trigger[Open Coach OR daily 8am cron] --> Gather[Gather: tasks, habits, focus, mood, energy]
  Gather --> Send[Send to Lovable AI Gateway / Gemini with tool schema]
  Send --> Parse[Parse structured response: headline, insights[], suggested_tasks[]]
  Parse --> Render[Render coach card + actionable buttons]
  Render --> Act{User accepts a suggestion?}
  Act -- yes --> Create[Create task / start focus / log mood]
  Act -- no --> Snooze[Snooze nudge, learn from rejection]
  Create --> Feedback[Feed outcome back into next prompt]
  Snooze --> Feedback
```

## 6. Burnout detection (Tier 2)
```mermaid
flowchart TD
  Daily[Daily aggregator] --> Check{Last 7 days: avg mood < 3 OR completion < 30% OR sleep < 6h?}
  Check -- yes --> Trigger[Trigger Recovery Mission]
  Check -- no --> Normal[Normal coaching]
  Trigger --> Card[Coach card: 'Take today lighter — here's a 3-task recovery plan']
  Card --> Reward[Completing recovery awards 2x XP — rest is productive]
```

## 7. Progress analytics (daily → yearly)
```mermaid
flowchart LR
  Daily[Daily score] --> Week[7-day rolling chart on Insights]
  Week --> Month[Monthly heatmap]
  Month --> Year[Yearly contribution graph + level history]
```
