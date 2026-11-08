import type { StoreGet, StoreSet } from "./types";

export interface DevSlice {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  mindDevMode: boolean;
  setMindDevMode: (active: boolean) => void;
  syncMindDevTasksAndHabits: (month: 1 | 2 | 3) => void;
}

export const createDevSlice = (set: StoreSet, get: StoreGet): DevSlice => ({
  selectedModel: "gemini-3.5-flash",
  setSelectedModel: (model) => set({ selectedModel: model }),
  mindDevMode: false,
  setMindDevMode: (active) => set({ mindDevMode: active }),

  syncMindDevTasksAndHabits: (month) => {
    const state = get();
    set({ primaryGoals: ["learn", "ship"] });

    const mindHabits = [
      { name: "Read Technical Passage (30m)", emoji: "📚", color: "indigo", targetPerWeek: 7, category: "learning" as const, isMindDev: true },
      { name: "Write in Thinking Journal (30m)", emoji: "📓", color: "violet", targetPerWeek: 7, category: "personal" as const, isMindDev: true },
      { name: "Solve Hard Problems (1h)", emoji: "🧩", color: "emerald", targetPerWeek: 7, category: "work" as const, isMindDev: true },
      { name: "Practice 1 Hard Skill", emoji: "🎓", color: "cyan", targetPerWeek: 7, category: "learning" as const, isMindDev: true },
      { name: "Attention Training (Breathing)", emoji: "🧘", color: "purple", targetPerWeek: 7, category: "health" as const, isMindDev: true },
      { name: "Lazy Brain Blocker", emoji: "🚫", color: "red", targetPerWeek: 7, category: "personal" as const, isMindDev: true },
    ];

    const existingHabitNames = state.habits.map((h) => h.name.toLowerCase());
    mindHabits.forEach((h) => {
      if (!existingHabitNames.includes(h.name.toLowerCase())) {
        state.addHabit(h);
      }
    });

    let monthTasks: Array<{
      title: string;
      priority: "low" | "medium" | "high" | "urgent";
      category: "work" | "personal" | "health" | "learning";
      durationMin: number;
      isMindDev: boolean;
    }> = [];

    if (month === 1) {
      monthTasks = [
        { title: "Read difficult technical chapter", priority: "high", category: "learning", durationMin: 30, isMindDev: true },
        { title: "Solve 1 logic or programming problem (no AI)", priority: "medium", category: "work", durationMin: 45, isMindDev: true },
        { title: "Concentration session: 10m breath focus", priority: "low", category: "health", durationMin: 10, isMindDev: true },
        { title: "Eliminate short-form videos completely for today", priority: "high", category: "personal", durationMin: 0, isMindDev: true },
      ];
    } else if (month === 2) {
      monthTasks = [
        { title: "4-hour Deep Focus Block", priority: "urgent", category: "work", durationMin: 240, isMindDev: true },
        { title: "Derive a hard mathematical / algorithmic proof", priority: "high", category: "work", durationMin: 60, isMindDev: true },
        { title: "Practice chess tactics for visualization", priority: "medium", category: "learning", durationMin: 30, isMindDev: true },
        { title: "Write weekly essay from memory", priority: "high", category: "learning", durationMin: 45, isMindDev: true },
        { title: "Practice mental math speed runs", priority: "low", category: "learning", durationMin: 15, isMindDev: true },
      ];
    } else {
      monthTasks = [
        { title: "5-6 hours quality deep work block", priority: "urgent", category: "work", durationMin: 300, isMindDev: true },
        { title: "Build complex project from first principles (no tutorials)", priority: "high", category: "work", durationMin: 120, isMindDev: true },
        { title: "Explain advanced technical concept to someone without notes", priority: "medium", category: "learning", durationMin: 45, isMindDev: true },
        { title: "Solve complex, multi-step math/CS problem", priority: "high", category: "work", durationMin: 90, isMindDev: true },
        { title: "Review and refine weekly thinking notes", priority: "low", category: "personal", durationMin: 20, isMindDev: true },
      ];
    }

    const existingTaskTitles = state.tasks.map((t) => t.title.toLowerCase());
    monthTasks.forEach((t) => {
      if (!existingTaskTitles.includes(t.title.toLowerCase())) {
        state.addTask(t);
      }
    });
  },
});

