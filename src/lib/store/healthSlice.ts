import type { HealthLog, StoreGet, StoreSet, TimeSlot } from "./types";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTDate, getISTTodayStr } from "../utils";

export interface HealthSlice {
  healthLogs: HealthLog[];
  claimedSlots: Record<string, TimeSlot[]>;
  logHealth: (patch: Partial<HealthLog> & { date?: string }) => void;
  setMood: (mood: 1 | 2 | 3 | 4 | 5) => void;
}

export const createHealthSlice = (set: StoreSet, get: StoreGet): HealthSlice => ({
  healthLogs: [],
  claimedSlots: {},

  logHealth: (patch) => {
    const date = patch.date ?? getISTTodayStr();
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
      offlineQueue.enqueue(userId, "health_upsert", {
        date,
        waterMl: next.waterMl,
        steps: next.steps,
        workouts: next.workouts,
        mood: next.mood ?? null,
        sleepHours: next.sleepHours ?? null,
      });
    }
  },

  setMood: (mood) => {
    const t = getISTTodayStr();
    const hour = getISTDate().getHours();
    const state = get();

    let slot: TimeSlot = "morning";
    if (hour >= 12 && hour < 18) slot = "afternoon";
    if (hour >= 18 || hour < 5) slot = "evening";

    const daySlots = state.claimedSlots[t] || [];

    if (daySlots.includes(slot)) {
      const focusToday = state.focusSessions.filter((s) => s.completedAt.startsWith(t)).length;
      const moodEventsToday = state.xpHistory.filter(
        (e) => e.at.startsWith(t) && e.reason.includes("Mood logged"),
      ).length;

      const extraNeeded = moodEventsToday + 1 - 3;
      if (extraNeeded > 0 && moodEventsToday >= focusToday + 3) {
        console.log("[XP] Mood limit reached. Complete more focus sessions for extra slots.");
        get().logHealth({ mood });
        return;
      }
    }

    get().logHealth({ mood });
    get().awardFor({ type: "health", kind: "mood" }, `Mood logged (${slot}): ${mood}/5`);

    set((s) => ({
      claimedSlots: {
        ...s.claimedSlots,
        [t]: Array.from(new Set([...(s.claimedSlots[t] || []), slot])),
      },
    }));
  },
});

