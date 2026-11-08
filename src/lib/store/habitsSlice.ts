import type { Habit, StoreGet, StoreSet } from "./types";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString, getISTTodayStr } from "../utils";

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
      if (userId) {
        offlineQueue.enqueue(userId, "habit_checkin", { id, date: t });
      }
      get().awardFor(
        { type: "habit", emoji: habit.emoji, category: habit.category },
        `Habit: ${habit.name}`,
        !!userId,
      );
    } else if (userId) {
      offlineQueue.enqueue(userId, "habit_uncheck", { id, date: t });
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

