import type { Habit, PrimaryGoal, StoreGet, StoreSet } from "./types";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString } from "../utils";

export interface ProfileSlice {
  userName: string;
  primaryGoals: PrimaryGoal[];
  dailyFocusTargetMin: number;
  onboardedAt?: string;
  setUserName: (name: string) => void;
  setPrimaryGoals: (goals: PrimaryGoal[]) => void;
  setDailyFocusTarget: (min: number) => void;
  completeOnboarding: (data: {
    userName: string;
    primaryGoals: PrimaryGoal[];
    dailyFocusTargetMin: number;
    starterHabits: Array<Omit<Habit, "id" | "createdAt" | "history">>;
  }) => void;
  resetOnboarding: () => void;
}

export const createProfileSlice = (set: StoreSet, get: StoreGet): ProfileSlice => ({
  userName: "Friend",
  primaryGoals: [],
  dailyFocusTargetMin: 50,
  onboardedAt: undefined,

  setUserName: (name) => {
    set({ userName: name });
    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "profile_update", {
        patch: { display_name: name },
      });
    }
  },

  setPrimaryGoals: (goals) => {
    set({ primaryGoals: goals });
    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "profile_update", {
        patch: {
          primary_goal: goals[0] ?? null,
          primary_goals: goals,
        },
      });
    }
  },

  setDailyFocusTarget: (min) => {
    set({ dailyFocusTargetMin: min });
    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "profile_update", {
        patch: { daily_focus_target_min: min },
      });
    }
  },

  completeOnboarding: ({ userName, primaryGoals, dailyFocusTargetMin, starterHabits }) => {
    const now = getISTISOString();
    const existingNames = new Set(get().habits.map((h) => h.name.toLowerCase()));
    const uniqueStarters = starterHabits.filter((h) => !existingNames.has(h.name.toLowerCase()));

    const newHabits: Habit[] = uniqueStarters.map((h) => ({
      ...h,
      id: crypto.randomUUID(),
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

    get().awardFor({ type: "login" }, "Welcome to FlowFit");

    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "profile_update", {
        patch: {
          display_name: userName,
          primary_goal: primaryGoals[0] ?? null,
          primary_goals: primaryGoals,
          daily_focus_target_min: dailyFocusTargetMin,
          onboarded_at: now,
        },
      });

      for (const h of newHabits) {
        offlineQueue.enqueue(userId, "habit_create", {
          id: h.id,
          name: h.name,
          emoji: h.emoji,
          color: h.color,
          targetPerWeek: h.targetPerWeek,
          category: h.category ?? null,
        });
      }
    }
  },

  resetOnboarding: () => set({ onboardedAt: undefined }),
});

