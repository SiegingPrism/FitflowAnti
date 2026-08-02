import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  type ActionSource,
  type Branch,
  type TaskCategory,
  branchOf,
  computeXp,
  currentStreak,
  levelFromXp,
} from "./gamification";

export type { TaskCategory } from "./gamification";

export type Priority = "low" | "medium" | "high" | "urgent";

export type PrimaryGoal = "ship" | "fit" | "learn" | "recover";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  category: TaskCategory;
  durationMin: number;
  xp: number;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  xpAwarded?: boolean;
  isMindDev?: boolean;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  targetPerWeek: number;
  history: string[];
  createdAt: string;
  category?: TaskCategory;
  isMindDev?: boolean;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  durationMin: number;
  completedAt: string;
}

export interface HealthLog {
  date: string;
  waterMl: number;
  steps: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  workouts: number;
  sleepHours?: number;
}

export interface XPEvent {
  id: string;
  amount: number;
  reason: string;
  branch: Branch;
  sourceType: "task" | "habit" | "focus" | "health" | "login";
  at: string;
}

export type TimeSlot = "morning" | "afternoon" | "evening";

interface AppState {
  // Auth-bound state
  userId: string | null;
  hydrated: boolean; // true once we've loaded data for the current user

  // Mood/Health tracking
  claimedSlots: Record<string, TimeSlot[]>; // date -> slots[]

  // Data
  tasks: Task[];
  habits: Habit[];
  focusSessions: FocusSession[];
  healthLogs: HealthLog[];
  xpHistory: XPEvent[];
  totalXP: number;
  userName: string;

  onboardedAt?: string;
  primaryGoals: PrimaryGoal[];
  dailyFocusTargetMin: number;

  // Tasks
  addTask: (t: Omit<Task, "id" | "createdAt" | "completed" | "xp"> & { xp?: number }) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;

  // Habits
  addHabit: (h: Omit<Habit, "id" | "createdAt" | "history">) => void;
  toggleHabitToday: (id: string) => void;
  removeHabit: (id: string) => void;

  // Focus
  logFocusSession: (s: Omit<FocusSession, "id" | "completedAt">) => void;

  // Health
  logHealth: (patch: Partial<HealthLog> & { date?: string }) => void;
  setMood: (mood: 1 | 2 | 3 | 4 | 5) => void;

  // XP
  awardFor: (source: ActionSource, reason: string, skipCloudSync?: boolean) => number;

  // Onboarding
  completeOnboarding: (data: {
    userName: string;
    primaryGoals: PrimaryGoal[];
    dailyFocusTargetMin: number;
    starterHabits: Array<Omit<Habit, "id" | "createdAt" | "history">>;
  }) => void;
  resetOnboarding: () => void;

  // User
  setUserName: (name: string) => void;
  setPrimaryGoals: (goals: PrimaryGoal[]) => void;
  setDailyFocusTarget: (min: number) => void;

  // Cloud lifecycle
  bindUser: (userId: string | null) => Promise<void>;
  clearLocal: () => void;

  // Dev
  grantDebugXp: (amount: number, reason?: string) => void;
  hellMode: boolean;
  toggleHellMode: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  mindDevMode: boolean;
  setMindDevMode: (active: boolean) => void;
  syncMindDevTasksAndHabits: (month: 1 | 2 | 3) => void;
}

// Ensure today uses local time to match UI display
import { format } from "date-fns";
import { getISTDate, getISTTodayStr, getISTISOString } from "./utils";
const today = () => getISTTodayStr();

const uid = () => crypto.randomUUID();

const TASK_BASE: Record<Priority, number> = { low: 5, medium: 10, high: 20, urgent: 35 };

const EMPTY_STATE = {
  tasks: [] as Task[],
  habits: [] as Habit[],
  focusSessions: [] as FocusSession[],
  healthLogs: [] as HealthLog[],
  xpHistory: [] as XPEvent[],
  claimedSlots: {} as Record<string, TimeSlot[]>,
  totalXP: 0,
  userName: "Friend",
  dailyFocusTargetMin: 50,
  onboardedAt: undefined as string | undefined,
  primaryGoals: [] as PrimaryGoal[],
  hellMode: false,
  selectedModel: "gemini-1.5-flash",
  mindDevMode: false,
};

// ---- background-safe write helpers (silent on error, won't crash UI) ----
// Accepts a Promise OR a Supabase query builder (which is thenable).
const safe = <T extends { error?: unknown }>(p: Promise<T> | unknown): void => {
  if (p && typeof (p as Promise<T>).then === 'function') {
    (p as Promise<T>).then((res) => {
      if (res && res.error) {
        console.error("[cloud sync error]", res.error);
      }
    }).catch((err: unknown) => console.error("[cloud sync catch]", err));
  }
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const award = (source: ActionSource, reason: string, skipCloudSync = false): number => {
        const state = get();
        const todayKey = today();
        const dailyStreak = currentStreak(
          Array.from(new Set(state.xpHistory.map((e) => e.at.slice(0, 10)))),
          todayKey,
        );
        const actionsToday = state.xpHistory.filter((e) => e.at.slice(0, 10) === todayKey).length;
        const userLevel = levelFromXp(state.totalXP).level;
        const amount = computeXp(source, { streakDays: dailyStreak, userLevel, actionsToday });
        const branch = branchOf(source);
        const event: XPEvent = {
          id: uid(),
          amount,
          reason,
          branch,
          sourceType: source.type,
          at: getISTISOString(),
        };
        set((s) => ({
          totalXP: s.totalXP + amount,
          xpHistory: [event, ...s.xpHistory].slice(0, 200),
        }));

        const userId = get().userId;
        if (userId && !skipCloudSync) {
          safe(
            (async () => {
              await supabase.from("xp_events").insert({
                user_id: userId,
                amount,
                reason,
                branch,
                source_type: source.type,
              });
              await supabase
                .from("profiles")
                .update({ total_xp: get().totalXP })
                .eq("user_id", userId);
            })(),
          );
        }
        return amount;
      };

      return {
        userId: null,
        hydrated: false,
        ...EMPTY_STATE,

        addTask: (t) => {
          const xp = t.xp ?? TASK_BASE[t.priority];
          const id = uid();
          const task: Task = {
            id,
            createdAt: getISTISOString(),
            completed: false,
            xpAwarded: false,
            xp,
            ...t,
          };
          set((s) => ({ tasks: [task, ...s.tasks] }));
          const userId = get().userId;
          if (userId) {
            safe(
              supabase.from("tasks").insert({
                id,
                user_id: userId,
                title: task.title,
                notes: task.notes ?? null,
                priority: task.priority,
                category: task.category,
                duration_min: task.durationMin,
                xp: task.xp,
                due_date: task.dueDate ?? null,
              }),
            );
          }
        },
        toggleTask: async (id) => {
          const state = get();
          const task = state.tasks.find((t) => t.id === id);
          if (!task) {
            console.error(`[Task] Task with id ${id} not found in store.`);
            return;
          }

          const willComplete = !task.completed;
          const completedAt = willComplete ? getISTISOString() : undefined;
          const willAwardXp = willComplete && !task.xpAwarded;

          // Optimistic UI update
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id ? {
                ...t,
                completed: willComplete,
                completedAt,
                xpAwarded: willComplete ? true : t.xpAwarded // Lock the flag to true if completed
              } : t,
            ),
          }));

          const userId = get().userId;

          if (willComplete) {
            try {
              let res: { success?: boolean; message?: string } | null = null;
              if (userId) {
                const { data, error } = await supabase.rpc('complete_task', {
                  p_task_id: id
                });
                res = data as { success?: boolean; message?: string } | null;

                if (error) {
                  console.error("[Task] RPC Error:", error);
                  throw new Error(error.message);
                }
                if (res && res.success === false) {
                  console.warn("[Task] RPC Success: false. Message:", res.message);
                  throw new Error(res.message);
                }
              }

              // res is only defined if we hit the cloud.
              const alreadyDoneCloud = userId ? (res && (res.message === 'already_done' || res.message === 'already_awarded')) : false;

              if (willAwardXp && !alreadyDoneCloud) {
                award(
                  { type: "task", priority: task.priority, category: task.category },
                  `Completed: ${task.title}`,
                  !!userId
                );
              }
            } catch (e) {
              console.error("[Task] Final Error, rolling back optimistic state:", e);
              // Rollback optimistic update
              set((s) => ({
                tasks: s.tasks.map((t) => t.id === id ? { ...t, completed: false, completedAt: undefined, xpAwarded: task.xpAwarded } : t),
              }));
            }
          } else {
            // Un-completing
            if (userId) {
              safe(
                supabase
                  .from("tasks")
                  .update({ completed: false, completed_at: null })
                  .eq("id", id),
              );
            }
          }
        },
        removeTask: (id) => {
          set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
          const userId = get().userId;
          if (userId) safe(supabase.from("tasks").delete().eq("id", id));
        },
        updateTask: (id, patch) => {
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
          const userId = get().userId;
          if (userId) {
            safe(
              supabase
                .from("tasks")
                .update({
                  title: patch.title,
                  notes: patch.notes,
                  priority: patch.priority,
                  category: patch.category,
                  duration_min: patch.durationMin,
                  xp: patch.xp,
                  due_date: patch.dueDate ?? null,
                })
                .eq("id", id),
            );
          }
        },

        addHabit: (h) => {
          const id = uid();
          const habit: Habit = { ...h, id, history: [], createdAt: getISTISOString() };
          set((s) => ({ habits: [...s.habits, habit] }));
          const userId = get().userId;
          if (userId) {
            safe(
              supabase.from("habits").insert({
                id,
                user_id: userId,
                name: habit.name,
                emoji: habit.emoji,
                color: habit.color,
                target_per_week: habit.targetPerWeek,
                category: habit.category ?? null,
              }),
            );
          }
        },
        toggleHabitToday: async (id) => {
          const t = today();
          const habit = get().habits.find((h) => h.id === id);
          if (!habit) return;
          const has = habit.history.includes(t);
          const userId = get().userId;

          if (has) return; // Habit is locked for the day once completed

          // Checking IN - Optimistic update
          set((s) => ({
            habits: s.habits.map((h) =>
              h.id === id ? { ...h, history: [...h.history, t] } : h,
            ),
          }));

          if (userId) {
            try {
              const { data, error } = await supabase.rpc('checkin_habit', { p_habit_id: id, p_date: t });
              const res = data as { success?: boolean; message?: string } | null;

              // If error is 'Already checked in', we don't need to roll back,
              // as the local state and server state are now in sync.
              const alreadyDone = res && res.message === 'already_done';

              if (error || (res && res.success === false)) {
                // SELF-HEALING: If habit is missing (FK error 23503), try to sync it and retry once
                const isMissing = error && (error as { code?: string }).code === '23503';
                if (isMissing) {
                  console.log("[Habit] Habit missing from cloud, self-healing...");
                  await supabase.from("habits").insert({
                    id,
                    user_id: userId,
                    name: habit.name,
                    emoji: habit.emoji,
                    color: habit.color,
                    target_per_week: habit.targetPerWeek,
                    category: habit.category ?? null,
                  });
                  // Retry check-in
                  const retry = await supabase.rpc('checkin_habit', { p_habit_id: id, p_date: t });
                  if (!retry.error) return award({ type: "habit", emoji: habit.emoji, category: habit.category }, `Habit: ${habit.name}`, true);
                }

                console.error("[habit checkin] failed:", error || res?.message);
                // Rollback optimistic update
                set((s) => ({
                  habits: s.habits.map((h) => h.id === id ? { ...h, history: h.history.filter(d => d !== t) } : h),
                }));
                return;
              }

              // Only award XP if this is the FIRST time today
              if (!alreadyDone) {
                award({ type: "habit", emoji: habit.emoji, category: habit.category }, `Habit: ${habit.name}`, !!userId);
                console.log(`[Habit] XP Awarded for ${habit.name}`);
              } else {
                console.log("[Habit] Already done today, skipping XP award.");
              }
            } catch (e) {
              console.error("[habit checkin] network error:", e);
              // Rollback on network error
              set((s) => ({
                habits: s.habits.map((h) => h.id === id ? { ...h, history: h.history.filter(d => d !== t) } : h),
              }));
            }
          } else {
            // Offline mode
            award(
              { type: "habit", emoji: habit.emoji, category: habit.category },
              `Habit: ${habit.name}`
            );
          }
        },
        removeHabit: (id) => {
          set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
          const userId = get().userId;
          if (userId) safe(supabase.from("habits").delete().eq("id", id));
        },

        logFocusSession: (input) => {
          const id = uid();
          const session: FocusSession = {
            id,
            completedAt: getISTISOString(),
            ...input,
          };
          set((st) => ({ focusSessions: [session, ...st.focusSessions] }));
          award({ type: "focus", durationMin: input.durationMin }, `Focus: ${input.durationMin}m`);
          const userId = get().userId;
          if (userId) {
            safe(
              supabase.from("focus_sessions").insert({
                id,
                user_id: userId,
                task_id: input.taskId ?? null,
                duration_min: input.durationMin,
              }),
            );
          }
        },

        logHealth: (patch) => {
          const date = patch.date ?? today();
          let next: HealthLog | undefined;
          set((s) => {
            const exists = s.healthLogs.find((l) => l.date === date);
            if (exists) {
              next = { ...exists, ...patch, date };
              return {
                healthLogs: s.healthLogs.map((l) => (l.date === date ? next! : l)),
              };
            }
            next = { date, waterMl: 0, steps: 0, workouts: 0, ...patch };
            return { healthLogs: [next, ...s.healthLogs] };
          });
          const userId = get().userId;
          if (userId && next) {
            safe(
              supabase.from("health_logs").upsert(
                {
                  user_id: userId,
                  date,
                  water_ml: next.waterMl,
                  steps: next.steps,
                  workouts: next.workouts,
                  mood: next.mood ?? null,
                  sleep_hours: next.sleepHours ?? null,
                },
                { onConflict: "user_id,date" },
              ),
            );
          }
        },
        setMood: (mood) => {
          const t = today();
          const hour = getISTDate().getHours();
          const state = get();

          // Determine current slot
          let slot: TimeSlot = "morning";
          if (hour >= 12 && hour < 18) slot = "afternoon";
          if (hour >= 18 || hour < 5) slot = "evening";

          const daySlots = state.claimedSlots[t] || [];

          // Check if slot is already claimed
          if (daySlots.includes(slot)) {
            // If slot is claimed, we can only claim a mood if we have a "pending focus session bonus"
            // We calculate this by checking: count(focus today) > count(bonus mood events today)
            const focusToday = state.focusSessions.filter(s => s.completedAt.startsWith(t)).length;
            const moodEventsToday = state.xpHistory.filter(e => e.at.startsWith(t) && e.reason.includes("Mood logged")).length;

            // We allow 3 base slots (M/A/E). If total mood events >= 3, it means we must use a focus bonus.
            const baseSlotsClaimed = daySlots.length;
            const extraNeeded = moodEventsToday + 1 - 3;

            if (extraNeeded > 0 && moodEventsToday >= focusToday + 3) {
              console.log("[XP] Mood limit reached. Complete more focus sessions for extra slots.");
              get().logHealth({ mood }); // Still log it
              return;
            }
          }

          // Grant XP and mark slot as claimed
          get().logHealth({ mood });
          award({ type: "health", kind: "mood" }, `Mood logged (${slot}): ${mood}/5`);

          set((s) => ({
            claimedSlots: {
              ...s.claimedSlots,
              [t]: Array.from(new Set([...(s.claimedSlots[t] || []), slot]))
            }
          }));
        },

        awardFor: award,

        completeOnboarding: ({ userName, primaryGoals, dailyFocusTargetMin, starterHabits }) => {
          const now = getISTISOString();
          const newHabits: Habit[] = starterHabits.map((h) => ({
            ...h,
            id: uid(),
            history: [],
            createdAt: now,
          }));
          set((s) => ({
            userName,
            primaryGoals,
            dailyFocusTargetMin,
            onboardedAt: now,
            habits: [...newHabits, ...s.habits],
          }));
          award({ type: "login" }, "Welcome to FlowFit");

          const userId = get().userId;
          if (userId) {
            safe(
              supabase
                .from("profiles")
                .upsert({
                  user_id: userId,
                  display_name: userName,
                  primary_goal: primaryGoals[0] ?? null,
                  primary_goals: primaryGoals,
                  daily_focus_target_min: dailyFocusTargetMin,
                  onboarded_at: now,
                }, { onConflict: "user_id" }),
            );
            if (newHabits.length) {
              safe(
                supabase.from("habits").insert(
                  newHabits.map((h) => ({
                    id: h.id,
                    user_id: userId,
                    name: h.name,
                    emoji: h.emoji,
                    color: h.color,
                    target_per_week: h.targetPerWeek,
                    category: h.category ?? null,
                  })),
                ),
              );
            }
          }
        },
        resetOnboarding: () => set({ onboardedAt: undefined }),

        setUserName: (name) => {
          set({ userName: name });
          const userId = get().userId;
          if (userId) {
            safe(supabase.from("profiles").upsert({ user_id: userId, display_name: name }, { onConflict: "user_id" }));
          }
        },
        setPrimaryGoals: (goals) => {
          set({ primaryGoals: goals });
          const userId = get().userId;
          if (userId) {
            safe(supabase.from("profiles").upsert({ user_id: userId, primary_goal: goals[0] ?? null, primary_goals: goals }, { onConflict: "user_id" }));
          }
        },
        setDailyFocusTarget: (min) => {
          set({ dailyFocusTargetMin: min });
          const userId = get().userId;
          if (userId) {
            safe(
              supabase
                .from("profiles")
                .upsert({ user_id: userId, daily_focus_target_min: min }, { onConflict: "user_id" }),
            );
          }
        },
        setSelectedModel: (model) => {
          set({ selectedModel: model });
        },

        // ----- cloud lifecycle -----
        bindUser: async (userId) => {
          if (!userId) {
            if (currentSyncChannel) {
              currentSyncChannel.unsubscribe();
              currentSyncChannel = null;
            }
            set({ userId: null, hydrated: false, ...EMPTY_STATE });
            return;
          }
          // Same user already loaded — skip.
          if (get().userId === userId && get().hydrated) return;

          // If the user already has local onboarding date, keep hydrated as true or use optimistic loading
          const isOptimistic = !!get().onboardedAt;
          set({ userId, hydrated: isOptimistic });
          await hydrateFromCloud(userId, get, set);
          set({ hydrated: true });
          setupRealtimeSync(userId, get, set);
        },
        clearLocal: () => set({ userId: null, hydrated: false, ...EMPTY_STATE }),

        grantDebugXp: (amount, reason = "Debug XP grant") => {
          const event: XPEvent = {
            id: uid(),
            amount,
            reason,
            branch: "craft",
            sourceType: "login",
            at: getISTISOString(),
          };
          set((s) => ({
            totalXP: s.totalXP + amount,
            xpHistory: [event, ...s.xpHistory].slice(0, 200),
          }));
          const userId = get().userId;
          if (userId) {
            safe(
              (async () => {
                await supabase.from("xp_events").insert({
                  user_id: userId,
                  amount,
                  reason,
                  branch: "craft",
                  source_type: "login",
                });
                await supabase
                  .from("profiles")
                  .update({ total_xp: get().totalXP })
                  .eq("user_id", userId);
              })(),
            );
          }
        },
        toggleHellMode: () => set((s) => ({ hellMode: !s.hellMode })),
        setMindDevMode: (active) => set({ mindDevMode: active }),
        syncMindDevTasksAndHabits: (month) => {
          const state = get();
          
          // 1. Set primary goals to learn & ship for cognitive development
          set({ primaryGoals: ["learn", "ship"] });

          // 2. Define the Mind Dev habits
          const mindHabits = [
            { name: "Read Technical Passage (30m)", emoji: "📚", color: "indigo" as const, targetPerWeek: 7, category: "learning" as const, isMindDev: true },
            { name: "Write in Thinking Journal (30m)", emoji: "📓", color: "violet" as const, targetPerWeek: 7, category: "personal" as const, isMindDev: true },
            { name: "Solve Hard Problems (1h)", emoji: "🧩", color: "emerald" as const, targetPerWeek: 7, category: "work" as const, isMindDev: true },
            { name: "Practice 1 Hard Skill", emoji: "🎓", color: "cyan" as const, targetPerWeek: 7, category: "learning" as const, isMindDev: true },
            { name: "Attention Training (Breathing)", emoji: "🧘", color: "purple" as const, targetPerWeek: 7, category: "health" as const, isMindDev: true },
            { name: "Lazy Brain Blocker", emoji: "🚫", color: "red" as const, targetPerWeek: 7, category: "personal" as const, isMindDev: true },
          ];

          // Add habits if they don't exist yet
          const existingHabitNames = state.habits.map(h => h.name.toLowerCase());
          mindHabits.forEach(h => {
            if (!existingHabitNames.includes(h.name.toLowerCase())) {
              state.addHabit(h);
            }
          });

          // 3. Define Month specific tasks
          let monthTasks: Array<{ title: string; priority: "low" | "medium" | "high" | "urgent"; category: "work" | "personal" | "health" | "learning"; durationMin: number; isMindDev: boolean }> = [];
          if (month === 1) {
            monthTasks = [
              { title: "Read difficult technical chapter", priority: "high", category: "learning", durationMin: 30, isMindDev: true },
              { title: "Solve 1 logic or programming problem (no AI)", priority: "medium", category: "work", durationMin: 45, isMindDev: true },
              { title: "Concentration session: 10m breath focus", priority: "low", category: "health", durationMin: 10, isMindDev: true },
              { title: "Eliminate short-form videos completely for today", priority: "high", category: "personal", durationMin: 0, isMindDev: true }
            ];
          } else if (month === 2) {
            monthTasks = [
              { title: "4-hour Deep Focus Block", priority: "urgent", category: "work", durationMin: 240, isMindDev: true },
              { title: "Derive a hard mathematical / algorithmic proof", priority: "high", category: "work", durationMin: 60, isMindDev: true },
              { title: "Practice chess tactics for visualization", priority: "medium", category: "learning", durationMin: 30, isMindDev: true },
              { title: "Write weekly essay from memory", priority: "high", category: "learning", durationMin: 45, isMindDev: true },
              { title: "Practice mental math speed runs", priority: "low", category: "learning", durationMin: 15, isMindDev: true }
            ];
          } else {
            monthTasks = [
              { title: "5-6 hours quality deep work block", priority: "urgent", category: "work", durationMin: 300, isMindDev: true },
              { title: "Build complex project from first principles (no tutorials)", priority: "high", category: "work", durationMin: 120, isMindDev: true },
              { title: "Explain advanced technical concept to someone without notes", priority: "medium", category: "learning", durationMin: 45, isMindDev: true },
              { title: "Solve complex, multi-step math/CS problem", priority: "high", category: "work", durationMin: 90, isMindDev: true },
              { title: "Review and refine weekly thinking notes", priority: "low", category: "personal", durationMin: 20, isMindDev: true }
            ];
          }

          // Add tasks if not already present
          const existingTaskTitles = state.tasks.map(t => t.title.toLowerCase());
          monthTasks.forEach(t => {
            if (!existingTaskTitles.includes(t.title.toLowerCase())) {
              state.addTask(t);
            }
          });
        },
      };
    },
    {
      name: "flowfit-store",
      version: 3,
      // Only persist data, not auth-bound flags
      partialize: (s) => ({
        tasks: s.tasks,
        habits: s.habits,
        focusSessions: s.focusSessions,
        healthLogs: s.healthLogs,
        xpHistory: s.xpHistory,
        totalXP: s.totalXP,
        userName: s.userName,
        onboardedAt: s.onboardedAt,
        primaryGoals: s.primaryGoals,
        dailyFocusTargetMin: s.dailyFocusTargetMin,
        claimedSlots: s.claimedSlots,
        hellMode: s.hellMode,
        mindDevMode: s.mindDevMode,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Cloud hydration
// ---------------------------------------------------------------------------


let currentSyncChannel: ReturnType<typeof supabase.channel> | null = null;

function setupRealtimeSync(userId: string, get: () => AppState, set: (fn: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void) {
  if (currentSyncChannel) {
    currentSyncChannel.unsubscribe();
  }

  currentSyncChannel = supabase.channel(`user_data_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, (payload) => {
      // Small delay to ensure we don't overwrite optimistic updates immediately if our own client made them
      setTimeout(() => {
        if (payload.eventType === 'INSERT') {
          set((s: AppState) => {
            if (s.tasks.some(t => t.id === payload.new.id)) return s;
            const newTask: Task = {
              id: payload.new.id, title: payload.new.title, notes: payload.new.notes ?? undefined,
              priority: payload.new.priority as Priority, category: payload.new.category as TaskCategory,
              durationMin: payload.new.duration_min, xp: payload.new.xp, dueDate: payload.new.due_date ?? undefined,
              completed: payload.new.completed, completedAt: payload.new.completed_at ?? undefined,
              createdAt: payload.new.created_at, xpAwarded: payload.new.xp_awarded ?? false
            };
            return { tasks: [newTask, ...s.tasks] };
          });
        } else if (payload.eventType === 'UPDATE') {
          set((s: AppState) => ({
            tasks: s.tasks.map(t => t.id === payload.new.id ? {
              ...t, title: payload.new.title, notes: payload.new.notes ?? undefined,
              priority: payload.new.priority as Priority, category: payload.new.category as TaskCategory,
              durationMin: payload.new.duration_min, xp: payload.new.xp, dueDate: payload.new.due_date ?? undefined,
              completed: payload.new.completed, completedAt: payload.new.completed_at ?? undefined,
              xpAwarded: payload.new.xp_awarded ?? false
            } : t)
          }));
        } else if (payload.eventType === 'DELETE') {
          set((s: AppState) => ({ tasks: s.tasks.filter(t => t.id !== payload.old.id) }));
        }
      }, 500);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` }, (payload) => {
      setTimeout(() => {
        if (payload.eventType === 'INSERT') {
          set((s: AppState) => {
            if (s.habits.some(h => h.id === payload.new.id)) return s;
            const newHabit: Habit = {
              id: payload.new.id, name: payload.new.name, emoji: payload.new.emoji, color: payload.new.color,
              targetPerWeek: payload.new.target_per_week, category: payload.new.category ?? undefined, history: [], createdAt: payload.new.created_at
            };
            return { habits: [newHabit, ...s.habits] };
          });
        } else if (payload.eventType === 'DELETE') {
          set((s: AppState) => ({ habits: s.habits.filter(h => h.id !== payload.old.id) }));
        }
      }, 500);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'habit_checkins', filter: `user_id=eq.${userId}` }, (payload) => {
      setTimeout(() => {
        set((s: AppState) => ({
          habits: s.habits.map(h => h.id === payload.new.habit_id ? { ...h, history: Array.from(new Set([...h.history, payload.new.date])) } : h)
        }));
      }, 500);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` }, (payload) => {
      setTimeout(() => {
        set((s: AppState) => {
          if (s.focusSessions.some(f => f.id === payload.new.id)) return s;
          return { focusSessions: [{ id: payload.new.id, taskId: payload.new.task_id ?? undefined, durationMin: payload.new.duration_min, completedAt: payload.new.completed_at }, ...s.focusSessions] };
        });
      }, 500);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'health_logs', filter: `user_id=eq.${userId}` }, (payload) => {
      setTimeout(() => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          set((s: AppState) => {
            const exists = s.healthLogs.some(l => l.date === payload.new.date);
            const newLog: HealthLog = { date: payload.new.date, waterMl: payload.new.water_ml, steps: payload.new.steps, workouts: payload.new.workouts, mood: payload.new.mood ?? undefined, sleepHours: payload.new.sleep_hours ?? undefined };
            if (exists) {
              return { healthLogs: s.healthLogs.map(l => l.date === payload.new.date ? newLog : l) };
            }
            return { healthLogs: [newLog, ...s.healthLogs] };
          });
        }
      }, 500);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'xp_events', filter: `user_id=eq.${userId}` }, (payload) => {
      setTimeout(() => {
        set((s: AppState) => {
          if (s.xpHistory.some(x => x.id === payload.new.id)) return s;
          const newEvent: XPEvent = { id: payload.new.id, amount: payload.new.amount, reason: payload.new.reason, branch: payload.new.branch as Branch, sourceType: payload.new.source_type as XPEvent['sourceType'], at: payload.new.at };
          return { xpHistory: [newEvent, ...s.xpHistory].slice(0, 200) };
        });
      }, 500);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` }, (payload) => {
      setTimeout(() => {
        set((s: AppState) => ({
          totalXP: payload.new.total_xp ?? s.totalXP,
          userName: payload.new.display_name ?? s.userName,
          primaryGoals: (payload.new.primary_goals ?? (payload.new.primary_goal ? [payload.new.primary_goal] : s.primaryGoals)) as PrimaryGoal[],
          dailyFocusTargetMin: payload.new.daily_focus_target_min ?? s.dailyFocusTargetMin,
        }));
      }, 500);
    })
    .subscribe();
}

async function hydrateFromCloud(

  userId: string,
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
) {
  try {
    // Safety timeout: increased to 10s for production sync stability
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Hydration Timeout")), 10000));

    const [profileRes, tasksRes, habitsRes, checkinsRes, focusRes, healthRes, xpRes] =
      await Promise.race([
        Promise.all([
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
          supabase.from("habits").select("*").eq("user_id", userId).is("archived_at", null),
          supabase.from("habit_checkins").select("*").eq("user_id", userId),
          supabase.from("focus_sessions").select("*").eq("user_id", userId).order("completed_at", { ascending: false }).limit(500),
          supabase.from("health_logs").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(180),
          supabase.from("xp_events").select("*").eq("user_id", userId).order("at", { ascending: false }).limit(200),
        ]),
        timeoutPromise as Promise<never>
      ]);

    console.log("[hydrate] Cloud data retrieved successfully.");

    // Prevent wiping local state if queries fail due to auth, network, or RLS errors
    const queryError = profileRes.error || tasksRes.error || habitsRes.error;
    if (queryError) {
      console.warn("[hydrate] Supabase query returned error, using local cache fallback:", queryError);
      set({ hydrated: true });
      return;
    }

    const profile = profileRes.data;

    // First-login migration: if cloud is empty AND localStorage has data, push it up.
    // We only do this if it's a fresh user (no tasks, habits, or XP in cloud).
    const cloudEmpty =
      (tasksRes.data?.length ?? 0) === 0 &&
      (habitsRes.data?.length ?? 0) === 0 &&
      (xpRes.data?.length ?? 0) === 0;

    const local = get();
    const localHasData =
      local.tasks.length > 0 ||
      local.habits.length > 0 ||
      local.xpHistory.length > 0 ||
      local.totalXP > 0 ||
      local.onboardedAt;

    if (cloudEmpty && localHasData) {
      console.log("[hydrate] cloud empty, migrating local data...");
      await migrateLocalToCloud(userId, local);
      // IMPORTANT: Instead of recursing (which can loop), we just mark as hydrated
      // with the local data we already have. The cloud is now catching up.
      set({ hydrated: true });
      return;
    }

    // Build habit history from check-ins
    const checkinsByHabit = new Map<string, string[]>();
    for (const c of checkinsRes.data ?? []) {
      const arr = checkinsByHabit.get(c.habit_id) ?? [];
      arr.push(c.date);
      checkinsByHabit.set(c.habit_id, arr);
    }

    const cloudTasks = (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes ?? undefined,
      priority: t.priority as Priority,
      category: t.category as TaskCategory,
      durationMin: t.duration_min,
      xp: t.xp,
      dueDate: t.due_date ?? undefined,
      completed: t.completed,
      completedAt: t.completed_at ?? undefined,
      createdAt: t.created_at,
      xpAwarded: false,
    }));

    const cloudHabits = (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      targetPerWeek: h.target_per_week,
      category: (h.category ?? undefined) as TaskCategory | undefined,
      history: checkinsByHabit.get(h.id) ?? [],
      createdAt: h.created_at,
    }));

    set({
      tasks: cloudTasks.length > 0 ? cloudTasks : (get().tasks.length > 0 ? get().tasks : cloudTasks),
      habits: cloudHabits.length > 0 ? cloudHabits : (get().habits.length > 0 ? get().habits : cloudHabits),
      focusSessions: (focusRes.data ?? []).map((f) => ({
        id: f.id,
        taskId: f.task_id ?? undefined,
        durationMin: f.duration_min,
        completedAt: f.completed_at,
      })),
      healthLogs: (healthRes.data ?? []).map((l) => ({
        date: l.date,
        waterMl: l.water_ml,
        steps: l.steps,
        workouts: l.workouts,
        mood: (l.mood ?? undefined) as HealthLog["mood"],
        sleepHours: l.sleep_hours ?? undefined,
      })),
      xpHistory: (xpRes.data ?? []).map((e) => ({
        id: e.id,
        amount: e.amount,
        reason: e.reason,
        branch: e.branch as Branch,
        sourceType: e.source_type as XPEvent["sourceType"],
        at: e.at,
      })),
      totalXP: profile?.total_xp ?? get().totalXP ?? 0,
      userName: profile?.display_name ?? get().userName ?? "Friend",
      primaryGoals: (profile?.primary_goals?.length ? profile.primary_goals : profile?.primary_goal ? [profile.primary_goal] : get().primaryGoals) as PrimaryGoal[],
      dailyFocusTargetMin: profile?.daily_focus_target_min ?? get().dailyFocusTargetMin ?? 50,
      onboardedAt: profile?.onboarded_at ?? get().onboardedAt ?? undefined,
      hydrated: true,
    });
  } catch (err) {
    console.error("[hydrate] failed:", err);
    // Fall back to localStorage cache (already in store)
    set({ hydrated: true });
  }
}

async function migrateLocalToCloud(userId: string, local: AppState) {
  try {
    const inserts: PromiseLike<unknown>[] = [];

    // Profile: use upsert to ensure it exists
    await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        display_name: local.userName,
        primary_goal: local.primaryGoals.length > 0 ? local.primaryGoals[0] : null,
        primary_goals: local.primaryGoals.length > 0 ? local.primaryGoals : null,
        daily_focus_target_min: local.dailyFocusTargetMin,
        onboarded_at: local.onboardedAt ?? null,
        total_xp: local.totalXP,
      }, { onConflict: "user_id" });

    // Map old (non-uuid) ids to fresh uuids
    const taskIdMap = new Map<string, string>();
    const habitIdMap = new Map<string, string>();
    const remap = (oldId: string, map: Map<string, string>) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oldId);
      const newId = isUuid ? oldId : uid();
      map.set(oldId, newId);
      return newId;
    };

    if (local.tasks.length) {
      const rows = local.tasks.map((t) => ({
        id: remap(t.id, taskIdMap),
        user_id: userId,
        title: t.title,
        notes: t.notes ?? null,
        priority: t.priority,
        category: t.category,
        duration_min: t.durationMin,
        xp: t.xp,
        due_date: t.dueDate ?? null,
        completed: t.completed,
        completed_at: t.completedAt ?? null,
      }));
      await supabase.from("tasks").upsert(rows, { onConflict: "id" });
    }

    if (local.habits.length) {
      const rows = local.habits.map((h) => ({
        id: remap(h.id, habitIdMap),
        user_id: userId,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        target_per_week: h.targetPerWeek,
        category: h.category ?? null,
      }));
      await supabase.from("habits").upsert(rows, { onConflict: "id" });

      // Build and deduplicate checkin rows by (habit_id, date) to prevent database unique violations
      const seenCheckins = new Set<string>();
      const checkinRows: { user_id: string; habit_id: string; date: string }[] = [];

      for (const h of local.habits) {
        const habitId = habitIdMap.get(h.id);
        if (!habitId) continue;
        for (const date of h.history) {
          const key = `${habitId}_${date}`;
          if (!seenCheckins.has(key)) {
            seenCheckins.add(key);
            checkinRows.push({
              user_id: userId,
              habit_id: habitId,
              date,
            });
          }
        }
      }

      if (checkinRows.length) {
        inserts.push(supabase.from("habit_checkins").upsert(checkinRows, { onConflict: "habit_id,date" }));
      }
    }

    if (local.focusSessions.length) {
      const rows = local.focusSessions.map((f) => ({
        id: f.id,
        user_id: userId,
        task_id: f.taskId ? taskIdMap.get(f.taskId) ?? null : null,
        duration_min: f.durationMin,
        completed_at: f.completedAt,
      }));
      inserts.push(supabase.from("focus_sessions").upsert(rows, { onConflict: "id" }));
    }

    if (local.healthLogs.length) {
      const rows = local.healthLogs.map((l) => ({
        user_id: userId,
        date: l.date,
        water_ml: l.waterMl,
        steps: l.steps,
        workouts: l.workouts,
        mood: l.mood ?? null,
        sleep_hours: l.sleepHours ?? null,
      }));
      inserts.push(supabase.from("health_logs").upsert(rows, { onConflict: "user_id,date" }));
    }

    if (local.xpHistory.length) {
      const rows = local.xpHistory.map((e) => ({
        id: e.id,
        user_id: userId,
        amount: e.amount,
        reason: e.reason,
        branch: e.branch,
        source_type: e.sourceType,
        at: e.at,
      }));
      inserts.push(supabase.from("xp_events").upsert(rows, { onConflict: "id" }));
    }

    // Execute remaining inserts with individual error catching to prevent one table from blocking others
    await Promise.all(inserts.map(p => p.then(res => {
      const r = res as { error?: Error };
      if (r.error) console.error("[migration] Table insert failed:", r.error);
    })));

    console.log("[migration] Local data successfully pushed to cloud.");
  } catch (err) {
    console.error("[migration] CRITICAL failure:", err);
  }
}

export const todayKey = today;

/** @deprecated use levelFromXp from src/lib/gamification.ts */
export const getLevel = (xp: number) => {
  const info = levelFromXp(xp);
  return {
    level: Math.max(1, info.level),
    xpInLevel: info.xpInLevel,
    xpToNext: info.xpForNext - info.xpForCurrent,
  };
};
