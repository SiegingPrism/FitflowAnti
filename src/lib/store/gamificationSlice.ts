import type { ActionSource, StoreGet, StoreSet, XPEvent } from "./types";
import { branchOf, computeXp, currentStreak, levelFromXp } from "../gamification";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString, getISTTodayStr } from "../utils";

export interface GamificationSlice {
  totalXP: number;
  xpHistory: XPEvent[];
  hellMode: boolean;
  awardFor: (source: ActionSource, reason: string, skipCloudSync?: boolean) => number;
  grantDebugXp: (amount: number, reason?: string) => void;
  toggleHellMode: () => void;
}

export const createGamificationSlice = (set: StoreSet, get: StoreGet): GamificationSlice => ({
  totalXP: 0,
  xpHistory: [],
  hellMode: false,

  awardFor: (source: ActionSource, reason: string, skipCloudSync = false): number => {
    const state = get();
    const todayKey = getISTTodayStr();
    const dailyStreak = currentStreak(
      Array.from(new Set(state.xpHistory.map((e) => e.at.slice(0, 10)))),
      todayKey,
    );
    const actionsToday = state.xpHistory.filter((e) => e.at.slice(0, 10) === todayKey).length;
    const userLevel = levelFromXp(state.totalXP).level;
    const amount = computeXp(source, { streakDays: dailyStreak, userLevel, actionsToday });
    const branch = branchOf(source);
    const event: XPEvent = {
      id: crypto.randomUUID(),
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
      offlineQueue.enqueue(userId, "xp_record", {
        amount,
        reason,
        branch,
        sourceType: source.type,
      });
    }

    return amount;
  },

  grantDebugXp: (amount, reason = "Debug XP grant") => {
    const event: XPEvent = {
      id: crypto.randomUUID(),
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
      offlineQueue.enqueue(userId, "xp_record", {
        amount,
        reason,
        branch: "craft",
        sourceType: "login",
      });
    }
  },

  toggleHellMode: () => set((s) => ({ hellMode: !s.hellMode })),
});

