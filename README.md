# FitFlow

> **A Life RPG for productivity.** Tasks, habits, focus, health, and an AI coach in one adaptive command center. Cross-platform web and native mobile application (Android & iOS).

![Status](https://img.shields.io/badge/status-Production--Ready-success) ![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20Vite%20%2B%20Tailwind%20%2B%20Capacitor-1f2937) ![Backend](https://img.shields.io/badge/backend-Supabase%20Postgres%20%2B%20RLS-3ecf8e) ![AI](https://img.shields.io/badge/AI-Google%20Gemini%203.5%2F3.6-4285f4)

---

## Overview

FitFlow is an adaptive productivity command center uniting tasks, habits, focus sessions, and health tracking with a gamified RPG progression system and an intelligent AI Coach.

Built as an **offline-first application** powered by Capacitor for native Android and iOS apps, with real-time cloud synchronization via Supabase PostgreSQL.

---

## Core Features

- 🎯 **Tasks** — Quick capture, priority matrix, category routing, due dates, filters, and atomic XP completion.
- 🔁 **Habits** — Daily check-ins, multi-week streaks, 30-day consistency heatmaps, and category tagging.
- ⚡ **Focus** — Pomodoro timer with animated visual countdown ring and automatic focus session logging.
- 💧 **Health & Mood** — Water intake, steps, workouts, sleep hours, and time-slot-based mood journaling.
- 🧠 **AI Coach** — Gemini 3.5/3.6 integration analyzing telemetry and generating actionable tasks and recommendations.
- 🏆 **Gamification & Skill Trees** — XP progression, dynamic level curves, branch XP routing (Craft, Focus, Health, Learning), unlockable themes, and badges.
- 📱 **Cross-Platform Native Apps** — Capacitor-powered mobile builds for Android (APK/AAB) and iOS.
- 🔄 **Resilient Offline Sync** — Stale-while-revalidate hydration, optimistic UI updates, and persistent offline mutation queue that replays edits upon reconnecting.

---

## Architecture & Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript 5 (Strict Mode), Tailwind CSS, Framer Motion, shadcn/ui.
- **State Management**: Modular Zustand store split into functional slices (`tasksSlice`, `habitsSlice`, `focusSlice`, `healthSlice`, `gamificationSlice`, `profileSlice`, `devSlice`).
- **Offline & Sync Engine**:
  - `offlineQueue.ts`: Persisted queue of pending mutations in `localStorage`; handles optimistic writes and auto-flushes when online.
  - `syncEngine.ts`: Stale-while-revalidate hydration with a 6-second timeout fallback (no UI stalls on slow 3G/4G connections) and Realtime Supabase CDC channels.
- **Backend & Database**:
  - Supabase PostgreSQL with strict Row Level Security (RLS).
  - Hardened `SECURITY DEFINER` atomic RPCs (`complete_task`, `complete_habit`, `record_xp_event`, `atomic_add_xp`).
  - Column protection triggers preventing direct client writes to system fields like `total_xp`.
- **Native Runtime**: Capacitor 8 for Android and iOS.

---

## Project Structure

```
.
├── android/               # Native Android Capacitor project
├── ios/                   # Native iOS Capacitor project
├── src/
│   ├── components/        # UI components (dashboard, layout, onboarding, theme)
│   ├── contexts/          # AuthContext (Supabase Auth + local fallback)
│   ├── lib/
│   │   ├── store/         # Zustand state slices (tasks, habits, health, focus, etc.)
│   │   ├── sync/          # Offline queue & Supabase sync engine
│   │   ├── gamification.ts # XP formulas, streak multipliers, and level curves
│   │   ├── store.ts       # Store root orchestrator & re-exports
│   │   └── gemini-client.ts # Gemini API client
│   └── pages/             # Lazy-loaded route views (Index, Tasks, Habits, Coach, etc.)
├── supabase/
│   ├── migrations/        # PostgreSQL schema, RLS policies, and RPC functions
│   └── config.toml        # Supabase local development configuration
├── product/               # Product vision, personas, and MVP definitions
└── tech/                  # Architecture, database schema, and API documentation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Android Studio (for Android build) / Xcode (for iOS build, macOS only)

### Installation

```bash
# Clone the repository
git clone https://github.com/ishanibassin/FitflowAnti.git
cd FitflowAnti

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:8080`.

### Building Native Mobile Apps

```bash
# Build the production web bundle
npm run build

# Sync web assets to Capacitor native projects
npm run cap:sync

# Open Android Studio
npm run cap:open-android

# Open Xcode (macOS only)
npm run cap:open-ios
```

---

## Testing & Verification

```bash
# Run unit & integration tests
npm test

# Run TypeScript typecheck (strict mode)
npx tsc --noEmit

# Run ESLint
npm run lint
```
