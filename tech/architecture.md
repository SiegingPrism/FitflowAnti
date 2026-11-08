# Architecture

FitFlow is an **offline-first, cross-platform productivity RPG** designed for mobile (Android & iOS via Capacitor) and web, backed by Supabase PostgreSQL and Google Gemini AI.

---

## 1. System Topology

```
┌────────────────────────────────────────────────────────┐
│               Client Application (PWA / Mobile)        │
│                                                        │
│  React 18 + Vite (Lazy-Loaded Route Chunks)            │
│  TypeScript 5 (Strict Mode Enabled)                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                Zustand Store Slices              │  │
│  │  - tasksSlice         - habitsSlice              │  │
│  │  - focusSlice         - healthSlice              │  │
│  │  - gamificationSlice  - profileSlice             │  │
│  │  - devSlice                                      │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│  ┌────────────────────────▼─────────────────────────┐  │
│  │                 Sync Layer                       │  │
│  │  - offlineQueue.ts: Persistent localStorage queue│  │
│  │  - syncEngine.ts: Stale-While-Revalidate hydrator│  │
│  │    with 6s timeout & Realtime CDC listener       │  │
│  └────────────────────────┬─────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Supabase Cloud                       │
│                                                        │
│  - PostgreSQL 17 Database with Row Level Security      │
│  - Hardened Atomic RPCs (SECURITY DEFINER)             │
│    * complete_task()                                   │
│    * complete_habit()                                  │
│    * record_xp_event()                                 │
│    * atomic_add_xp() [Execution revoked from clients]  │
│  - Column Protection Triggers on profiles (total_xp)   │
│  - Supabase Realtime (CDC replication)                 │
│  - Supabase Auth (JWT session management)              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Google Gemini AI                     │
│                                                        │
│  - Gemini 3.5 / 3.6 Models                             │
│  - Proactive task suggestion generator                 │
│  - Multi-source telemetry analysis                     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Component Stack

| Layer | Technology | Role |
|---|---|---|
| **UI Framework** | React 18, Vite 5, Tailwind CSS | High performance, responsive layout, dark-first styling |
| **Type Safety** | TypeScript 5 (Strict Mode: on) | Full type coverage, strict null checks, no implicit any |
| **Routing & Bundling** | React Router v6 + `React.lazy` | Code-split page chunks (`Index`, `Tasks`, `Habits`, `MindDeveloper`, etc.) |
| **State Management** | Sliced Zustand + `persist` middleware | Decoupled functional domain slices with persistent localStorage backup |
| **Sync & Resilience** | Custom `offlineQueue` + `syncEngine` | Optimistic mutations, persistent mutation replay, non-blocking hydration |
| **Mobile Runtime** | Capacitor 8 | Native iOS (Swift) and Android (Java) shells with native bridge |
| **Backend & Auth** | Supabase (PostgreSQL 17) | Row Level Security, Realtime channels, atomic stored procedures |
| **AI Intelligence** | Google Gemini API (3.5 / 3.6) | Telemetry synthesis, habit coaching, dynamic task suggestions |

---

## 3. Data Flow & Offline Reliability

### 3.1. Local Writes & Optimistic UI
1. The user triggers an action (e.g. completes a task or adds a habit).
2. The relevant Zustand slice (`tasksSlice`, `habitsSlice`, etc.) updates local state **immediately**, providing zero-latency UI responsiveness.
3. The slice calls `offlineQueue.enqueue(userId, action, payload)`:
   - The mutation is appended to `localStorage` under `fitflow_offline_queue_v1`.
   - If the device is online, `offlineQueue.drainQueue()` runs immediately.
   - If offline, the mutation safely waits until the device reconnects.
4. When connectivity resumes (`window.addEventListener('online')`), the queue flushes sequentially in chronological order.

### 3.2. Cloud Hydration (Stale-While-Revalidate)
1. On app boot, cached data from `localStorage` is loaded into the store instantly (`hydrated: true`). The user sees their dashboard without loading spinners.
2. In the background, `syncEngine.hydrateFromCloud()` requests the latest snapshot from Supabase with a **6.0-second safety timeout** (preventing cloud timeout issues on slow 3G/4G mobile connections).
3. Cloud data is reconciled with local state without discarding un-synced offline edits.
4. `offlineQueue.drainQueue()` is triggered to flush any remaining pending mutations.

---

## 4. Security Architecture

### 4.1. XP Authorization & Anti-Tampering
- **Function Hardening**: `atomic_add_xp(p_user_id, p_amount)` is marked `SECURITY DEFINER`, and its execution is explicitly revoked from `PUBLIC`, `anon`, and `authenticated` roles. Only database superusers and internal SECURITY DEFINER functions can execute it.
- **Cross-User Protection**: Inside `atomic_add_xp`, an explicit check verifies `auth.uid() = p_user_id` when called in a user session.
- **Client XP Endpoint**: Clients invoke `record_xp_event(amount, reason, branch, sourceType)`, which enforces session authentication, clamps allowed XP amounts (1..250), writes an audit record to `xp_events`, and securely increments XP.
- **Direct Column Protection**: A Postgres `BEFORE UPDATE` trigger on `public.profiles` (`protect_profile_system_fields`) blocks any direct updates to `total_xp` originating from authenticated or anonymous client roles.

---

## 5. Performance & Mobile Optimization

- **Route-Level Code Splitting**: All pages are lazy-loaded via `React.lazy` and `Suspense`. The initial JavaScript bundle was reduced from **1.13 MB down to ~250 kB**.
- **Heavy Pages Isolated**: Large internal tools like `MindDeveloper` are compiled into isolated on-demand chunks and gated so non-developer users never download their code.
- **Manual Vendor Chunks**: Core libraries (`react`, `framer-motion`, `supabase`, `lucide-react`) are partitioned into cached vendor bundles for optimal mobile browser caching.
