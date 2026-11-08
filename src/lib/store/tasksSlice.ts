import type { AppState, Priority, StoreGet, StoreSet, Task } from "./types";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString } from "../utils";

const TASK_BASE: Record<Priority, number> = { low: 5, medium: 10, high: 20, urgent: 35 };

export interface TasksSlice {
  tasks: Task[];
  addTask: (t: Omit<Task, "id" | "createdAt" | "completed" | "xp"> & { xp?: number }) => void;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
}

export const createTasksSlice = (set: StoreSet, get: StoreGet): TasksSlice => ({
  tasks: [],

  addTask: (t) => {
    const id = crypto.randomUUID();
    const task: Task = {
      id,
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      category: t.category,
      durationMin: t.durationMin,
      xp: t.xp ?? TASK_BASE[t.priority],
      dueDate: t.dueDate,
      completed: false,
      createdAt: getISTISOString(),
      xpAwarded: false,
      isMindDev: t.isMindDev,
    };

    set((s) => ({ tasks: [task, ...s.tasks] }));

    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "task_create", {
        id,
        title: task.title,
        notes: task.notes ?? null,
        priority: task.priority,
        category: task.category,
        durationMin: task.durationMin,
        xp: task.xp,
        dueDate: task.dueDate ?? null,
      });
    }
  },

  toggleTask: async (id) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) {
      console.error(`[TasksSlice] Task with id ${id} not found.`);
      return;
    }

    const willComplete = !task.completed;
    const completedAt = willComplete ? getISTISOString() : undefined;
    const willAwardXp = willComplete && !task.xpAwarded;

    // Optimistic UI update
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: willComplete,
              completedAt,
              xpAwarded: willComplete ? true : t.xpAwarded,
            }
          : t,
      ),
    }));

    const userId = get().userId;

    if (willComplete) {
      if (userId) {
        offlineQueue.enqueue(userId, "task_complete", { id });
      }

      if (willAwardXp) {
        get().awardFor(
          { type: "task", priority: task.priority, category: task.category },
          `Completed: ${task.title}`,
          !!userId,
        );
      }
    } else {
      if (userId) {
        offlineQueue.enqueue(userId, "task_uncomplete", { id });
      }
    }
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "task_delete", { id });
    }
  },

  updateTask: (id, patch) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "task_update", { id, patch });
    }
  },
});

