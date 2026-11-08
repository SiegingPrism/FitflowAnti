# Product Scope & Release Milestones

> Tracking FitFlow from initial MVP prototype to cross-platform mobile production release.

---

## Shipped Capabilities (Current State)

1. **Tasks** — Quick capture, priority matrix, category routing, due dates, filters, and race-safe RPC completion.
2. **Habits** — Daily check-ins, multi-week streaks, 30-day consistency heatmaps, category assignment, and auto-XP rewards.
3. **Focus** — Pomodoro timer with animated visual countdown ring and focus session logging.
4. **Health & Mood** — Water, steps, workouts, sleep, and time-slot mood journaling (morning, afternoon, evening).
5. **Daily Dashboard** — Adaptive greeting, productivity score, level bar, today's schedule, quick health, and side cards.
6. **Gamification Engine** — XP calculations, streak multipliers, daily bonus, level curves, and 4-branch skill trees (Craft, Focus, Health, Learning).
7. **AI Coach** — Gemini 3.5/3.6 integration analyzing telemetry and generating proactive task recommendations.
8. **Auth & Cloud Sync** — Supabase Auth (Email + OAuth), PostgreSQL schema with Row Level Security, and Realtime replication.
9. **Offline-First Resilience** — Stale-While-Revalidate cloud hydration (6s fallback) with a persistent offline mutation queue that automatically replays writes when network reconnects.
10. **Native Mobile Builds** — Capacitor integration powering native Android and iOS mobile applications with deep-linking support.
11. **Code-Split Bundles** — Route-level lazy loading reducing the initial bundle size from 1.13 MB to ~250 kB.
12. **Theme Customization & Rewards** — Unlockable themes, badges, sound effects, and custom palettes.

---

## Active & Upcoming Roadmap

### Phase 2 (Enhancements & Native Capabilities)
- [ ] Push notifications for habit reminders and focus breaks (Capacitor LocalNotifications / PushNotifications).
- [ ] Apple Health & Google Health Connect native sensor sync.
- [ ] Voice quick capture for tasks.
- [ ] Social accountability & shared streaks.

---

## Release Verification Checklist
- [x] Strict TypeScript compilation (`strict: true`) with 0 errors.
- [x] Security-hardened Supabase RPCs and triggers preventing unauthorized XP grants.
- [x] Initial JS bundle < 300 kB (currently ~250 kB).
- [x] Mobile deep links verified (`com.fitflowanti.app://`).
- [x] Unit test suite passing (`npm test`).
