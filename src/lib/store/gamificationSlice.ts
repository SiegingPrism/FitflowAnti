import type { ActionSource, StoreGet, StoreSet, XPEvent } from "./types";
import { branchOf, computeXp, currentStreak, levelFromXp, Branch } from "../gamification";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString, getISTTodayStr, isSameDayIST } from "../utils";
import { formatInTimeZone } from "date-fns-tz";

export interface GamificationSlice {
  totalXP: number;
  xpHistory: XPEvent[];
  hellMode: boolean;
  awardFor: (source: ActionSource, reason: string, skipCloudSync?: boolean) => number;
  grantDebugXp: (amount: number, reason?: string, branch?: Branch, sourceType?: XPEvent["sourceType"]) => void;
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
      Array.from(new Set(state.xpHistory.map((e) => {
        try {
          return formatInTimeZone(new Date(e.at), "Asia/Kolkata", "yyyy-MM-dd");
        } catch {
          return e.at.slice(0, 10);
        }
      }))),
      todayKey,
    );
    const actionsToday = state.xpHistory.filter((e) => isSameDayIST(e.at, todayKey)).length;
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

  grantDebugXp: (amount, reason = "Debug XP grant", branch = "learning", sourceType = "task") => {
    const event: XPEvent = {
      id: crypto.randomUUID(),
      amount,
      reason,
      branch,
      sourceType,
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
        branch,
        sourceType,
      });
    }
  },

  toggleHellMode: () => set((s) => ({ hellMode: !s.hellMode })),
});

