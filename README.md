# FlowSphere

> **A Life RPG for productivity.** Tasks, habits, focus, health, and an AI coach in one adaptive command center. Built to replace the Notion + Todoist + Habitica + Apple Health stack.

![Status](https://img.shields.io/badge/status-MVP-blue) ![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20Vite%20%2B%20Tailwind-1f2937) ![Backend](https://img.shields.io/badge/backend-Lovable%20Cloud-7c3aed) ![AI](https://img.shields.io/badge/AI-Lovable%20Gateway%20%C2%B7%20Gemini-22c55e)

---

## The problem
Self-directed people (creators, devs, students, knowledge workers) bounce between 4–6 productivity apps. None of them talk to each other. None of them adapt. Streaks die. Burnout wins.

## The solution
**One adaptive surface** with three layers:
1. **Capture** — tasks, habits, focus, health, mood
2. **Game** — XP, levels, skill trees, unlockable themes & boosts
3. **Intelligence** — an AI Coach that reads your patterns and tells you the next right move

Every action earns XP. Every XP routes into a skill tree (Focus / Health / Learning / Craft). The Coach watches everything and proposes 3 tasks a day.

## Demo
Open the published preview from your Lovable project and try this 30-second tour:
1. Tick a task on the Dashboard → watch the level bar move.
2. Hit "Start focus" → 25-minute Pomodoro with auto-XP on completion.
3. Open the Coach → "Get fresh insights" → AI returns 3 actionable suggestions.
4. Settings → switch theme — themes scale because every color is a token.

> A recorded GIF tour will land here once the v1 is published.

## Features (shipped)
- 🎯 **Tasks** — quick capture, priority, category, due dates, search, filters
- 🔁 **Habits** — daily check-in, 30-day heatmap, streak with freeze tokens
- ⚡ **Focus** — Pomodoro timer with animated SVG ring, auto-XP on completion
- 💧 **Health** — water, steps, workouts, mood, sleep — fed into the Coach
- 🧠 **AI Coach** — Gemini-powered, tool-call structured output, three insights + actionable tasks per call
- 🏆 **Rewards** — unlockable themes, badges, XP shop scaffolding
- 📊 **Insights** — 7-day activity bars, priority distribution donut, streak history
- 📅 **Calendar** — completed work over time
- ⚙️ **Settings** — theme, name, JSON export

## Differentiators (the hook)
| What competitors do | What FlowSphere does |
|---|---|
| Todoist: plain checklists | Tasks earn XP routed into a skill tree |
| Habitica: cartoon RPG | Glass-morphism, dark-first, adult aesthetic |
| Notion: blank canvas | Pre-built loop you don't have to design |
| Apple Health: silos data | Body data flows into the Coach, not just charts |
| Everyone: pushes harder | Burnout watch + Recovery Missions worth 2× XP |

## Tech stack
- **Frontend** — React 18, Vite 5, TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion
- **State** — Zustand + `persist` (localStorage)
- **Backend** — Lovable Cloud (auth, Postgres, edge functions, RLS)
- **AI** — Lovable AI Gateway → `google/gemini-2.5-flash` (daily) / `gemini-2.5-pro` (weekly plan)

Full architecture in [`tech/architecture.md`](./tech/architecture.md).

## Repo layout
```
.
├── product/           Vision, personas, core features, app flow
├── system-design/     Gamification engine spec
├── ai/                Recommendation engine + data tracking
├── design-system/     Color, typography, spacing, components
├── tech/              Architecture + API design
├── flows/             Mermaid flow diagrams (links into product/)
├── src/               React app
└── supabase/          Edge functions + config
```

## Read these in order
1. [`product/vision.md`](./product/vision.md) — what we're building and why
2. [`product/user_personas.md`](./product/user_personas.md) — who it's for
3. [`product/mvp.md`](./product/mvp.md) — **the 8 things v1 ships, and what's cut**
4. [`product/core_features.md`](./product/core_features.md) — full feature tiers
5. [`product/app_flow.md`](./product/app_flow.md) — every flow as Mermaid
6. [`system-design/core-loop.md`](./system-design/core-loop.md) — **the loop the entire product is built around**
7. [`system-design/gamification.md`](./system-design/gamification.md) — XP, levels, skill trees, freeze tokens
8. [`ai/recommendation-engine.md`](./ai/recommendation-engine.md) — Coach inputs / processing / outputs
9. [`tech/architecture.md`](./tech/architecture.md) + [`tech/api-design.md`](./tech/api-design.md) — stack + target schema
10. [`tech/database-schema.md`](./tech/database-schema.md) — every table, column, index, RLS rule
11. [`tech/ui-action-map.md`](./tech/ui-action-map.md) — every button → store action → data event
12. [`design-system/`](./design-system) — tokens and rules

## Roadmap
**Now (v1, shipped)** — All 10 pages functional, local-first, AI Coach live, design system locked.

**Next (v1.1)** — Onboarding wizard · browser notifications · skill-tree UI · weekly plan generator

**Later (v2)** — Auth + cloud sync · realtime cross-device · burnout-watch cron · PWA install · Apple Health import

**Future** — Voice capture · Watch companion · opt-in friend streaks

## Local development
```bash
npm install
npm run dev
```
Visit `http://localhost:8080`. State persists in localStorage — clear it from DevTools to reset.

## License
TBD.
