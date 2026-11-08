import { supabase } from "@/integrations/supabase/client";
import { offlineQueue } from "./offlineQueue";
import type { Task, Habit, FocusSession, HealthLog, XPEvent, PrimaryGoal, Priority, TaskCategory, Branch } from "@/lib/store/types";
import type { AppState } from "@/lib/store/types";

let currentSyncChannel: ReturnType<typeof supabase.channel> | null = null;

export async function hydrateFromCloud(
  userId: string,
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  { allowMigration = false }: { allowMigration?: boolean } = {},
) {
  try {
    // Push queued local writes first so the fetch below already includes them.
    if (typeof navigator === "undefined" || navigator.onLine) {
      await offlineQueue.drainQueue().catch(() => undefined);
    }

    // 6.0s resilient timeout (safe for slow mobile 3G/4G connections)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Hydration Timeout (6s)")), 6000),
    );

    const [profileRes, tasksRes, habitsRes, checkinsRes, focusRes, healthRes, xpRes] =
      (await Promise.race([
        Promise.all([
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
          supabase.from("habits").select("*").eq("user_id", userId).is("archived_at", null),
          supabase.from("habit_checkins").select("*").eq("user_id", userId),
          supabase.from("focus_sessions").select("*").eq("user_id", userId).order("completed_at", { ascending: false }).limit(500),
          supabase.from("health_logs").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(180),
          supabase.from("xp_events").select("*").eq("user_id", userId).order("at", { ascending: false }).limit(200),
        ]),
        timeoutPromise as Promise<never>,
      ]));

    console.log("[hydrate] Cloud data retrieved successfully.");

    const queryError = profileRes.error || tasksRes.error || habitsRes.error;
    if (queryError) {
      console.warn("[hydrate] Supabase query returned error, using local cache fallback:", queryError);
      set({ hydrated: true });
      return;
    }

    const profile = profileRes.data;

    // Check if cloud is completely empty for a new user migration
    const cloudEmpty =
      (tasksRes.data?.length ?? 0) === 0 &&
      (habitsRes.data?.length ?? 0) === 0 &&
      (xpRes.data?.length ?? 0) === 0;

    const snapshot = get();
    const localHasData =
      snapshot.tasks.length > 0 ||
      snapshot.habits.length > 0 ||
      snapshot.xpHistory.length > 0 ||
      snapshot.totalXP > 0 ||
      snapshot.onboardedAt;

    // Only on first sign-in from guest/local data — never on a background resync,
    // otherwise a reset on another device would be undone by this device's stale copy.
    if (allowMigration && cloudEmpty && localHasData) {
      console.log("[hydrate] Fresh user detected — migrating local guest data to cloud.");
      await migrateLocalToCloud(userId, snapshot);
      set({ hydrated: true });
      return;
    }

    // Assemble habits with checkins
    const checkinsByHabit = new Map<string, string[]>();
    for (const c of checkinsRes.data ?? []) {
      const list = checkinsByHabit.get(c.habit_id) ?? [];
      list.push(c.date);
      checkinsByHabit.set(c.habit_id, list);
    }

    const cloudHabits: Habit[] = (habitsRes.data ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      targetPerWeek: h.target_per_week,
      category: (h.category ?? undefined) as TaskCategory | undefined,
      history: checkinsByHabit.get(h.id) ?? [],
      createdAt: h.created_at,
    }));

    const cloudTasks: Task[] = (tasksRes.data ?? []).map((t) => ({
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
      xpAwarded: t.xp_awarded ?? false,
    }));

    // Deduplicate lists by id and unique keys
    const dedupeHabits = (list: Habit[]) => {
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      return list.filter((h) => {
        const idKey = h.id;
        const nameKey = h.name.trim().toLowerCase();
        if (seenIds.has(idKey) || seenNames.has(nameKey)) return false;
        seenIds.add(idKey);
        seenNames.add(nameKey);
        return true;
      });
    };

    // Tasks dedupe by id only — two tasks can legitimately share a title (e.g. "Workout").
    const dedupeTasks = (list: Task[]) => {
      const seenIds = new Set<string>();
      return list.filter((t) => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      });
    };

    // Cloud is the source of truth, except for local writes still waiting in the offline queue.
    const local = get();
    const pendingTaskCreates = offlineQueue.pendingIds(userId, "task_create");
    const pendingTaskDeletes = offlineQueue.pendingIds(userId, "task_delete");
    const pendingHabitCreates = offlineQueue.pendingIds(userId, "habit_create");
    const pendingHabitDeletes = offlineQueue.pendingIds(userId, "habit_delete");
    const pendingHabitToggles = new Set([
      ...offlineQueue.pendingIds(userId, "habit_checkin"),
      ...offlineQueue.pendingIds(userId, "habit_uncheck"),
    ]);
    const cloudTaskIds = new Set(cloudTasks.map((t) => t.id));
    const cloudHabitIds = new Set(cloudHabits.map((h) => h.id));
    const localHabitsById = new Map(local.habits.map((h) => [h.id, h]));

    const finalTasks = [
      ...local.tasks.filter((t) => pendingTaskCreates.has(t.id) && !cloudTaskIds.has(t.id)),
      ...cloudTasks.filter((t) => !pendingTaskDeletes.has(t.id)),
    ];
    const finalHabits = [
      ...cloudHabits
        .filter((h) => !pendingHabitDeletes.has(h.id))
        .map((h) => (pendingHabitToggles.has(h.id) && localHabitsById.has(h.id)
          ? { ...h, history: localHabitsById.get(h.id)!.history }
          : h)),
      ...local.habits.filter((h) => pendingHabitCreates.has(h.id) && !cloudHabitIds.has(h.id)),
    ];

    set({
      tasks: dedupeTasks(finalTasks),
      habits: dedupeHabits(finalHabits),
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
      primaryGoals: (profile?.primary_goals?.length
        ? profile.primary_goals
        : profile?.primary_goal
          ? [profile.primary_goal]
          : get().primaryGoals) as PrimaryGoal[],
      dailyFocusTargetMin: profile?.daily_focus_target_min ?? get().dailyFocusTargetMin ?? 50,
      onboardedAt: profile?.onboarded_at ?? get().onboardedAt ?? undefined,
      hydrated: true,
    });

    // Flush any pending offline mutations
    offlineQueue.drainQueue();
  } catch (err) {
    console.warn("[hydrate] Network timeout or slow connection, retaining local cache:", err);
    set({ hydrated: true });
    // Still attempt to drain queue in case connectivity is partial
    offlineQueue.drainQueue();
  }
}

export function setupRealtimeSync(
  userId: string,
  get: () => AppState,
  set: (fn: ((s: AppState) => Partial<AppState>) | Partial<AppState>) => void,
) {
  if (currentSyncChannel) {
    currentSyncChannel.unsubscribe();
    currentSyncChannel = null;
  }

  // --- Catch-up resync: after a dropped socket, a sleeping tab or going offline,
  // realtime events were missed, so re-pull from the cloud (debounced).
  let resyncTimer: ReturnType<typeof setTimeout> | null = null;
  const resync = (reason: string) => {
    if (resyncTimer) clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => {
      console.log(`[realtime] Resyncing (${reason})`);
      hydrateFromCloud(userId, get, set);
    }, 800);
  };

  let hiddenAt = 0;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 30_000) resync("tab visible again");
  };
  const onOnline = () => resync("back online");
  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
  }

  // habit_checkins DELETE payloads only carry the row id, so re-pull check-ins.
  let checkinTimer: ReturnType<typeof setTimeout> | null = null;
  const refreshCheckins = () => {
    if (checkinTimer) clearTimeout(checkinTimer);
    checkinTimer = setTimeout(async () => {
      const { data, error } = await supabase.from("habit_checkins").select("habit_id,date").eq("user_id", userId);
      if (error || !data) return;
      const byHabit = new Map<string, string[]>();
      for (const c of data) byHabit.set(c.habit_id, [...(byHabit.get(c.habit_id) ?? []), c.date]);
      const pending = new Set([
        ...offlineQueue.pendingIds(userId, "habit_checkin"),
        ...offlineQueue.pendingIds(userId, "habit_uncheck"),
      ]);
      set((s: AppState) => ({
        habits: s.habits.map((h) => (pending.has(h.id) ? h : { ...h, history: byHabit.get(h.id) ?? [] })),
      }));
    }, 400);
  };

  let hasDisconnected = false;

  currentSyncChannel = supabase
    .channel(`public:sync:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          if (payload.eventType === "INSERT") {
            set((s: AppState) => {
              if (s.tasks.some((t) => t.id === payload.new.id)) return s;
              const newTask: Task = {
                id: payload.new.id,
                title: payload.new.title,
                notes: payload.new.notes ?? undefined,
                priority: payload.new.priority as Priority,
                category: payload.new.category as TaskCategory,
                durationMin: payload.new.duration_min,
                xp: payload.new.xp,
                dueDate: payload.new.due_date ?? undefined,
                completed: payload.new.completed,
                completedAt: payload.new.completed_at ?? undefined,
                createdAt: payload.new.created_at,
                xpAwarded: payload.new.xp_awarded ?? false,
              };
              return { tasks: [newTask, ...s.tasks] };
            });
          } else if (payload.eventType === "UPDATE") {
            set((s: AppState) => ({
              tasks: s.tasks.map((t) =>
                t.id === payload.new.id
                  ? {
                      ...t,
                      title: payload.new.title,
                      notes: payload.new.notes ?? undefined,
                      priority: payload.new.priority as Priority,
                      category: payload.new.category as TaskCategory,
                      durationMin: payload.new.duration_min,
                      xp: payload.new.xp,
                      dueDate: payload.new.due_date ?? undefined,
                      completed: payload.new.completed,
                      completedAt: payload.new.completed_at ?? undefined,
                      xpAwarded: payload.new.xp_awarded ?? false,
                    }
                  : t,
              ),
            }));
          } else if (payload.eventType === "DELETE") {
            set((s: AppState) => ({ tasks: s.tasks.filter((t) => t.id !== payload.old.id) }));
          }
        }, 300);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "habits", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          if (payload.eventType === "INSERT") {
            set((s: AppState) => {
              if (s.habits.some((h) => h.id === payload.new.id)) return s;
              const newHabit: Habit = {
                id: payload.new.id,
                name: payload.new.name,
                emoji: payload.new.emoji,
                color: payload.new.color,
                targetPerWeek: payload.new.target_per_week,
                category: payload.new.category ?? undefined,
                history: [],
                createdAt: payload.new.created_at,
              };
              return { habits: [newHabit, ...s.habits] };
            });
          } else if (payload.eventType === "UPDATE") {
            set((s: AppState) => ({
              habits: payload.new.archived_at
                ? s.habits.filter((h) => h.id !== payload.new.id)
                : s.habits.map((h) =>
                    h.id === payload.new.id
                      ? {
                          ...h,
                          name: payload.new.name,
                          emoji: payload.new.emoji,
                          color: payload.new.color,
                          targetPerWeek: payload.new.target_per_week,
                          category: payload.new.category ?? undefined,
                        }
                      : h,
                  ),
            }));
          }
        }, 300);
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "habit_checkins", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          set((s: AppState) => ({
            habits: s.habits.map((h) =>
              h.id === payload.new.habit_id
                ? { ...h, history: Array.from(new Set([...h.history, payload.new.date])) }
                : h,
            ),
          }));
        }, 300);
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "focus_sessions", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          set((s: AppState) => {
            if (s.focusSessions.some((f) => f.id === payload.new.id)) return s;
            return {
              focusSessions: [
                {
                  id: payload.new.id,
                  taskId: payload.new.task_id ?? undefined,
                  durationMin: payload.new.duration_min,
                  completedAt: payload.new.completed_at,
                },
                ...s.focusSessions,
              ],
            };
          });
        }, 300);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "health_logs", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            set((s: AppState) => {
              const exists = s.healthLogs.some((l) => l.date === payload.new.date);
              const newLog: HealthLog = {
                date: payload.new.date,
                waterMl: payload.new.water_ml,
                steps: payload.new.steps,
                workouts: payload.new.workouts,
                mood: payload.new.mood ?? undefined,
                sleepHours: payload.new.sleep_hours ?? undefined,
              };
              if (exists) {
                return { healthLogs: s.healthLogs.map((l) => (l.date === payload.new.date ? newLog : l)) };
              }
              return { healthLogs: [newLog, ...s.healthLogs] };
            });
          }
        }, 300);
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "xp_events", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          set((s: AppState) => {
            if (s.xpHistory.some((x) => x.id === payload.new.id)) return s;
            const newEvent: XPEvent = {
              id: payload.new.id,
              amount: payload.new.amount,
              reason: payload.new.reason,
              branch: payload.new.branch as Branch,
              sourceType: payload.new.source_type as XPEvent["sourceType"],
              at: payload.new.at,
            };
            return { xpHistory: [newEvent, ...s.xpHistory].slice(0, 200) };
          });
        }, 300);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
      (payload) => {
        setTimeout(() => {
          set((s: AppState) => ({
            totalXP: payload.new.total_xp ?? s.totalXP,
            userName: payload.new.display_name ?? s.userName,
            primaryGoals: (payload.new.primary_goals ?? (payload.new.primary_goal ? [payload.new.primary_goal] : s.primaryGoals)) as PrimaryGoal[],
            dailyFocusTargetMin: payload.new.daily_focus_target_min ?? s.dailyFocusTargetMin,
          }));
        }, 300);
      },
    )
    // DELETE events can't be filtered by user_id in Supabase Realtime and only carry the
    // primary key, so listen unfiltered and remove by id (unknown ids are a no-op).
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
      const id = (payload.old as { id?: string }).id;
      if (id) set((s: AppState) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "habits" }, (payload) => {
      const id = (payload.old as { id?: string }).id;
      if (id) set((s: AppState) => ({ habits: s.habits.filter((h) => h.id !== id) }));
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "habit_checkins" }, () => {
      refreshCheckins();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (hasDisconnected) resync("realtime reconnected");
        hasDisconnected = false;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        hasDisconnected = true;
      }
    });

  return () => {
    if (resyncTimer) clearTimeout(resyncTimer);
    if (checkinTimer) clearTimeout(checkinTimer);
    if (typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    }
    if (currentSyncChannel) {
      currentSyncChannel.unsubscribe();
      currentSyncChannel = null;
    }
  };
}

export async function migrateLocalToCloud(userId: string, local: AppState) {
  try {
    const inserts: PromiseLike<unknown>[] = [];

    // Profile: use upsert
    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        display_name: local.userName,
        primary_goal: local.primaryGoals.length > 0 ? local.primaryGoals[0] : null,
        primary_goals: local.primaryGoals.length > 0 ? local.primaryGoals : null,
        daily_focus_target_min: local.dailyFocusTargetMin,
        onboarded_at: local.onboardedAt ?? null,
      },
      { onConflict: "user_id" },
    );

    const taskIdMap = new Map<string, string>();
    const habitIdMap = new Map<string, string>();
    const remap = (oldId: string, map: Map<string, string>) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oldId);
      const newId = isUuid ? oldId : crypto.randomUUID();
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

    await Promise.all(
      inserts.map((p) =>
        p.then((res) => {
          const r = res as { error?: Error };
          if (r.error) console.error("[migration] Table insert failed:", r.error);
        }),
      ),
    );

    console.log("[migration] Local data successfully pushed to cloud.");
  } catch (err) {
    console.error("[migration] CRITICAL failure:", err);
  }
}

