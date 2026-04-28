import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeBurnout } from "./burnout";
import type { HealthLog, Task, XPEvent } from "./store";

describe("computeBurnout", () => {
  const FIXED_DATE = new Date("2024-05-01T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return correct default risk and signals when arrays are empty", () => {
    const result = computeBurnout({
      healthLogs: [],
      tasks: [],
      xpHistory: [],
    });

    expect(result.level).toBe("low");
    expect(result.signals.moodTrend).toBeCloseTo(0.375); // (5 - 3.5) / 4
    expect(result.signals.sleepDeficit).toBe(0); // (7.5 - 7.5) / 1.5
    expect(result.signals.completionDrop).toBe(0);
    expect(result.signals.streakStrain).toBe(0);
  });

  it("should handle empty tasks and xpHistory", () => {
    const result = computeBurnout({
      healthLogs: [
        { id: "1", userId: "u1", date: "2024-05-01", mood: 4, sleepHours: 8, createdAt: "2024-05-01T12:00:00Z" }
      ],
      tasks: [],
      xpHistory: [],
    });
    expect(result.level).toBe("low");
    expect(result.signals.completionDrop).toBe(0);
    expect(result.signals.streakStrain).toBe(0);
  });

  it("should ignore entries lacking target fields", () => {
    const result = computeBurnout({
      healthLogs: [
        { id: "1", userId: "u1", date: "2024-05-01", createdAt: "2024-05-01T12:00:00Z" }, // missing mood and sleepHours
        { id: "2", userId: "u1", date: "2024-04-30", mood: 5, createdAt: "2024-04-30T12:00:00Z" }, // missing sleepHours
        { id: "3", userId: "u1", date: "2024-04-29", sleepHours: 7.5, createdAt: "2024-04-29T12:00:00Z" }, // missing mood
      ],
      tasks: [
        { id: "t1", userId: "u1", title: "Incomplete task", priority: "low", category: "work", xpConfig: { base: 10 }, createdAt: "2024-05-01T12:00:00Z" } // missing completedAt
      ],
      xpHistory: [],
    });

    // The logs missing fields should be filtered out when calculating averages.
    // For mood: only log 2 has a mood (5), so avg is 5.
    // For sleep: only log 3 has sleep (7.5), so avg is 7.5.
    expect(result.signals.moodTrend).toBe(0); // (5 - 5) / 4
    expect(result.signals.sleepDeficit).toBe(0); // (7.5 - 7.5) / 1.5
    expect(result.signals.completionDrop).toBe(0);
  });

  it("should clamp values to bounds (0-1) correctly for extreme inputs", () => {
    // We mock 3 prior completions so that a drop can be calculated.
    const priorDate = "2024-04-24T12:00:00Z"; // Previous 7 days range
    const result = computeBurnout({
      healthLogs: [
        // Extremely low mood (negative, not normally possible but tests the bound)
        { id: "h1", userId: "u1", date: "2024-05-01", mood: -5, createdAt: "2024-05-01T12:00:00Z" },
        // Zero sleep
        { id: "h2", userId: "u1", date: "2024-04-30", sleepHours: 0, createdAt: "2024-04-30T12:00:00Z" }
      ],
      tasks: [
        { id: "t1", userId: "u1", title: "Past task 1", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: priorDate, createdAt: "2024-04-20T12:00:00Z" },
        { id: "t2", userId: "u1", title: "Past task 2", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: priorDate, createdAt: "2024-04-20T12:00:00Z" },
        { id: "t3", userId: "u1", title: "Past task 3", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: priorDate, createdAt: "2024-04-20T12:00:00Z" }
        // 0 recent completions, so drop is 100% (3 -> 0)
      ],
      xpHistory: Array.from({ length: 40 }).map((_, i) => ({
        // Massive streak > 14 days (creating a 40-day streak)
        id: `xp${i}`,
        userId: "u1",
        taskId: "t1",
        amount: 10,
        reason: "task_completion",
        at: new Date(FIXED_DATE.getTime() - i * 24 * 60 * 60 * 1000).toISOString()
      }))
    });

    // Verify all signals are clamped at exactly 1.0 (maximum risk)
    expect(result.signals.moodTrend).toBe(1); // Normally (5 - (-5)) / 4 = 2.5 -> clamped to 1
    expect(result.signals.sleepDeficit).toBe(1); // Normally (7.5 - 0) / 1.5 = 5 -> clamped to 1
    expect(result.signals.completionDrop).toBe(1); // Drop is 1.0. 1.0 / 0.4 = 2.5 -> clamped to 1
    expect(result.signals.streakStrain).toBe(1); // Normally (40 - 14) / 14 ≈ 1.85 -> clamped to 1

    // Overall risk should also be clamped
    expect(result.risk).toBeCloseTo(1);
    expect(result.level).toBe("high");
  });

  it("should clamp values to bounds (0-1) correctly for exceptionally good inputs", () => {
    const priorDate = "2024-04-24T12:00:00Z";
    const recentDate = "2024-05-01T12:00:00Z";
    const result = computeBurnout({
      healthLogs: [
        // Exceptionally high mood
        { id: "h1", userId: "u1", date: "2024-05-01", mood: 10, createdAt: "2024-05-01T12:00:00Z" },
        // Lots of sleep
        { id: "h2", userId: "u1", date: "2024-04-30", sleepHours: 24, createdAt: "2024-04-30T12:00:00Z" }
      ],
      tasks: [
        // Baseline tasks
        { id: "t1", userId: "u1", title: "Past task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: priorDate, createdAt: "2024-04-20T12:00:00Z" },
        { id: "t2", userId: "u1", title: "Past task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: priorDate, createdAt: "2024-04-20T12:00:00Z" },
        { id: "t3", userId: "u1", title: "Past task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: priorDate, createdAt: "2024-04-20T12:00:00Z" },
        // Increase in recent tasks (negative drop)
        { id: "t4", userId: "u1", title: "Recent task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: recentDate, createdAt: "2024-05-01T12:00:00Z" },
        { id: "t5", userId: "u1", title: "Recent task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: recentDate, createdAt: "2024-05-01T12:00:00Z" },
        { id: "t6", userId: "u1", title: "Recent task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: recentDate, createdAt: "2024-05-01T12:00:00Z" },
        { id: "t7", userId: "u1", title: "Recent task", priority: "low", category: "work", xpConfig: { base: 10 }, completedAt: recentDate, createdAt: "2024-05-01T12:00:00Z" }
      ],
      xpHistory: [] // 0 streak
    });

    // Verify all signals are clamped at exactly 0 (minimum risk)
    expect(result.signals.moodTrend).toBe(0); // Normally (5 - 10) / 4 = -1.25 -> clamped to 0
    expect(result.signals.sleepDeficit).toBe(0); // Normally (7.5 - 24) / 1.5 = -11 -> clamped to 0
    expect(result.signals.completionDrop).toBe(0); // Drop is negative -> clamped to 0
    expect(result.signals.streakStrain).toBe(0); // Normally (0 - 14) / 14 = -1 -> clamped to 0

    expect(result.risk).toBe(0);
    expect(result.level).toBe("low");
  });
});
