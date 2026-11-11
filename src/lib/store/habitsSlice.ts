import type { Habit, StoreGet, StoreSet } from "./types";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString, getISTTodayStr, isSameDayIST } from "../utils";
import { HABIT_BASE_XP } from "../gamification";

export interface HabitsSlice {
  habits: Habit[];
  addHabit: (h: Omit<Habit, "id" | "createdAt" | "history">) => void;
  toggleHabitToday: (id: string) => void;
  removeHabit: (id: string) => void;
}

export const createHabitsSlice = (set: StoreSet, get: StoreGet): HabitsSlice => ({
  habits: [],

  addHabit: (h) => {
    const id = crypto.randomUUID();
    const habit: Habit = {
      ...h,
      id,
      history: [],
      createdAt: getISTISOString(),
    };
    set((s) => ({ habits: [...s.habits, habit] }));

    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "habit_create", {
        id,
        name: habit.name,
        emoji: habit.emoji,
        color: habit.color,
        targetPerWeek: habit.targetPerWeek,
        category: habit.category ?? null,
      });
    }
  },

  toggleHabitToday: (id) => {
    const t = getISTTodayStr();
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;

    const alreadyDone = habit.history.includes(t);

    set((s) => ({
      habits: s.habits.map((h) => {
        if (h.id !== id) return h;
        const next = alreadyDone ? h.history.filter((d) => d !== t) : [...h.history, t];
        return { ...h, history: next };
      }),
    }));

    const userId = get().userId;

    if (!alreadyDone) {
      const earned = get().awardFor(
        { type: "habit", emoji: habit.emoji, category: habit.category },
        `Habit: ${habit.name}`,
        !!userId,
      );
      if (userId) {
        offlineQueue.enqueue(userId, "habit_checkin", { id, date: t, xpEarned: earned });
      }
    } else {
      const xpToRemove = HABIT_BASE_XP;
      set((s) => ({
        totalXP: Math.max(0, s.totalXP - xpToRemove),
        xpHistory: s.xpHistory.filter(
          (e) => !(e.sourceType === "habit" && e.reason === `Habit: ${habit.name}` && isSameDayIST(e.at, t)),
        ).slice(0, 200),
      }));
      if (userId) {
        offlineQueue.enqueue(userId, "habit_uncheck", { id, date: t, xpToRemove });
      }
    }
  },

  removeHabit: (id) => {
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "habit_delete", { id });
    }
  },
});

