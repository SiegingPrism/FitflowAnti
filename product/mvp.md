# MVP definition

> The version we ship and stop adding to. Everything else moves to a backlog.

## MVP scope (v1.0 — what's in the box)
1. **Tasks** — create, complete, delete, priority, category, due date, today filter.
2. **Habits** — create, daily check-in, current streak, 30-day heatmap.
3. **Focus** — Pomodoro 25/5, auto-XP on completion, session log.
4. **Daily Dashboard** — greeting, productivity score, level bar, today's tasks, today's habits, quick health (water/steps/mood).
5. **Gamification engine v1** — XP per action, sqrt level curve, streak multiplier (capped 1.6×), daily-bonus first 3 actions, no decay, freeze tokens.
6. **AI Coach (single endpoint)** — "Get insights" button → returns headline + 3 insights + 3 suggested tasks via Lovable AI Gateway. Suggestions are one-tap addable.
7. **Theme switch** — light / dark / system. (Unlockable themes deferred.)
8. **JSON export** in Settings (data ownership).

That's it. Eight items. If something isn't on this list, it doesn't ship in v1.

## What is explicitly OUT of v1
- ❌ Auth + cloud sync (local-only is the v1 contract)
- ❌ Skill trees UI (engine routes XP into branches under the hood, but no visualization)
- ❌ Weekly plan generator
- ❌ Burnout detection / Recovery Missions
- ❌ Unlockable themes / XP shop
- ❌ Notifications / push / cron
- ❌ Calendar integration
- ❌ Voice capture
- ❌ Friends, social, leaderboards
- ❌ Mobile native wrapper

These all have homes in `product/core_features.md` Tier 2/3 — they ship in v1.1 and v2 once v1 has real users.

## Definition of "done" for MVP
- [ ] All 8 features pass an end-to-end manual test on mobile (375px) and desktop (1280px).
- [ ] First paint < 1.5s on a throttled 4G profile.
- [ ] No console errors. No accessibility violations on Dashboard / Tasks / Habits / Focus.
- [ ] localStorage payload survives a full reload + a tab restart.
- [ ] AI Coach handles: empty state, success, gateway timeout, 429.
- [ ] README has a 30-second demo GIF and a published URL.

## Why this MVP
- **Tests the core loop end-to-end** with the smallest possible surface.
- **No backend = no auth = no infra cost = no churn from "create an account".**
- **AI Coach is the differentiator** — even at v1 we can ship a real one because Lovable AI Gateway is in the box.
- **Everything cut is recoverable** — the Tier 2/3 features build *on top* of these primitives, not next to them.

## Post-MVP order (v1.1, v1.2, v2)
1. **v1.1** — Onboarding wizard + browser notifications + Skill Tree page (visualizes XP we already track).
2. **v1.2** — Weekly plan generator + Burnout watch + Recovery Missions.
3. **v2** — Auth + cloud sync + realtime + unlockable themes + XP shop + PWA install.

## How to say no
When tempted to add a feature mid-MVP, ask: *Does this shorten one of the five arrows in `core-loop.md`?* If no → backlog.
