# Architecture

FlowSphere is a **client-first PWA** with an optional cloud layer for sync, auth, and AI.

## Stack (current)
| Layer | Tech | Notes |
|---|---|---|
| UI | React 18 + Vite 5 + TypeScript 5 | Lovable default |
| Styling | Tailwind CSS v3 | Semantic HSL tokens in `index.css` |
| Components | shadcn/ui + Radix | Wrapped, never edited |
| Animation | Framer Motion | Page enters + state transitions |
| State | Zustand + `persist` middleware | localStorage-backed |
| Routing | React Router v6 | File-per-page in `src/pages/` |
| Charts | Recharts (in shadcn `chart.tsx`) | + custom CSS conic gradients |
| Backend | Lovable Cloud (Supabase under the hood) | Edge functions + Postgres + Auth (Tier 2) |
| AI | Lovable AI Gateway → `google/gemini-2.5-flash` / `pro` | Edge function: `supabase/functions/ai-coach` |

## Stack (planned)
- **Auth** — email/password + Google OAuth via Lovable Cloud
- **Cloud sync** — Postgres tables mirroring local store; user owns rows via RLS
- **Realtime** — Supabase Realtime for cross-device habit/task sync
- **Notifications** — Web Push via service worker (Tier 2)
- **Mobile** — PWA first; Capacitor wrapper for store distribution if needed

## Folder map
```
src/
  components/
    layout/          AppShell, TopBar, Sidebar, BottomNav
    dashboard/       HeroCard, TodayTasks, HabitsStrip, QuickHealth, SideCards
    shared/          UI primitives composed from shadcn
    ui/              shadcn primitives (do not edit)
  pages/             One file per route
  lib/
    store.ts         Zustand store — single source of truth
    theme.ts         Theme apply / persist
    utils.ts         cn() etc.
  integrations/
    supabase/        Auto-generated client + types (do not edit)
supabase/
  functions/
    ai-coach/        Edge function: pass-through to AI Gateway
  config.toml        Project + per-function config
```

## Data flow
```
User action
  → Zustand action (src/lib/store.ts)
    → state update
    → persist to localStorage
    → emit XP event (gamification engine)
    → React re-renders subscribed components

AI Coach request
  → invoke('ai-coach', { snapshot })
    → edge function reads LOVABLE_API_KEY from env
    → POST to ai.gateway.lovable.dev with tool-call schema
    → return structured JSON
    → render in Coach page
```

## Key non-functional requirements
- **First paint < 1.5s** on mid-tier mobile (aggressive code-split per route)
- **All animation 200–400ms**, ease `[0.4, 0, 0.2, 1]`
- **Offline-capable** — every page must render with cached state, no spinners on cold start
- **Accessible** — keyboard nav on every interactive element, focus rings always visible

## Why not React Native / Flutter
The README suggested mobile frameworks. We're explicit: **PWA is the right v1**.
- One codebase, instant deploy, no app-store gating.
- The audience (P1, P2) lives in browsers and on iOS Safari / Android Chrome.
- Native wrapper (Capacitor) is a 1-week add-on if we need haptics / widgets later.
