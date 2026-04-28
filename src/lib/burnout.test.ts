import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recoveryMission, computeBurnout } from "./burnout";
import { format, subDays } from "date-fns";

describe("recoveryMission", () => {
  it("returns exactly 3 tasks", () => {
    const tasks = recoveryMission();
    expect(tasks).toHaveLength(3);
  });

  it("returns tasks with correct properties", () => {
    const tasks = recoveryMission();
    tasks.forEach((task) => {
      expect(task.priority).toBe("low");
      expect(task.xpMultiplier).toBe(2);
      expect(typeof task.title).toBe("string");
      expect(typeof task.durationMin).toBe("number");
      expect(typeof task.reason).toBe("string");
    });
  });
});

describe("computeBurnout", () => {
  // Use fixed system time for deterministic tests
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns low risk for healthy inputs", () => {
    const result = computeBurnout({
      healthLogs: [
        { date: "2024-05-20", waterMl: 2000, steps: 10000, workouts: 1, mood: 5, sleepHours: 8 },
        { date: "2024-05-19", waterMl: 2000, steps: 10000, workouts: 1, mood: 4, sleepHours: 7.5 },
      ],
      tasks: [],
      xpHistory: [],
    });
    expect(result.level).toBe("low");
    expect(result.risk).toBeLessThan(0.35);
    expect(result.reasons).toContain("All signals look healthy");
  });

  it("identifies high risk when mood and sleep are poor", () => {
    const result = computeBurnout({
      healthLogs: Array.from({ length: 7 }, (_, i) => ({
        date: format(subDays(new Date(), i), "yyyy-MM-dd"),
        waterMl: 1000,
        steps: 1000,
        workouts: 0,
        mood: 1 as const,
        sleepHours: 4,
      })),
      tasks: [],
      xpHistory: [],
    });
    expect(result.risk).toBeGreaterThan(0.6);
    expect(result.level).toBe("high");
    expect(result.reasons).toContain("Mood averaged 1.0/5 this week");
    expect(result.reasons).toContain("Sleeping 4.0h vs 7.5h target");
  });

  it("identifies moderate risk when completions drop", () => {
    const today = new Date();
    // Prior week (7-13 days ago): 10 completions
    const priorTasks = Array.from({ length: 10 }, (_, i) => ({
      id: `prior-${i}`,
      title: "Prior Task",
      priority: "medium" as const,
      category: "work" as const,
      durationMin: 30,
      xp: 10,
      completed: true,
      completedAt: format(subDays(today, i + 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      createdAt: "2024-01-01",
    }));

    // Recent week (0-6 days ago): 2 completions (80% drop)
    const recentTasks = Array.from({ length: 2 }, (_, i) => ({
      id: `recent-${i}`,
      title: "Recent Task",
      priority: "medium" as const,
      category: "work" as const,
      durationMin: 30,
      xp: 10,
      completed: true,
      completedAt: format(subDays(today, i), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      createdAt: "2024-01-01",
    }));

    const result = computeBurnout({
      healthLogs: [],
      tasks: [...priorTasks, ...recentTasks],
      xpHistory: [],
    });

    expect(result.signals.completionDrop).toBeGreaterThan(0.5);
    expect(result.reasons.some((r) => r.includes("Completions dropped"))).toBe(true);
  });

  it("identifies streak strain", () => {
    const today = new Date();
    // 30 day streak
    const xpHistory = Array.from({ length: 30 }, (_, i) => ({
      id: `xp-${i}`,
      amount: 10,
      reason: "Task",
      branch: "focus" as const,
      sourceType: "task" as const,
      at: format(subDays(today, i), "yyyy-MM-dd'T'10:00:00Z"),
    }));

    const result = computeBurnout({
      healthLogs: [],
      tasks: [],
      xpHistory: xpHistory,
    });

    expect(result.signals.streakStrain).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.includes("-day streak with no rest"))).toBe(true);
  });

  it("handles broken streaks correctly", () => {
    const today = new Date();
    // 5 day streak, then a 2 day gap, then more history
    const xpHistory = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `recent-xp-${i}`,
        amount: 10,
        reason: "Task",
        branch: "focus" as const,
        sourceType: "task" as const,
        at: format(subDays(today, i), "yyyy-MM-dd'T'10:00:00Z"),
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `old-xp-${i}`,
        amount: 10,
        reason: "Task",
        branch: "focus" as const,
        sourceType: "task" as const,
        at: format(subDays(today, i + 7), "yyyy-MM-dd'T'10:00:00Z"),
      })),
    ];

    const result = computeBurnout({
      healthLogs: [],
      tasks: [],
      xpHistory: xpHistory,
    });

    // Streak should be 5, which is less than STREAK_STRAIN_DAYS (14), so strain should be 0
    expect(result.signals.streakStrain).toBe(0);
  });
});
