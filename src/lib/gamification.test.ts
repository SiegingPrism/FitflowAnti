import { describe, expect, it } from "vitest";
import {
  baseXp,
  branchOf,
  branchLevelFromXp,
  computeXp,
  currentStreak,
  dailyBonusMultiplier,
  difficultyMultiplier,
  difficultyOf,
  levelFromXp,
  nextPerk,
  productivityScore,
  streakMultiplier,
  xpForLevel,
} from "./gamification";

describe("baseXp", () => {
  it("uses the priority XP table for tasks", () => {
    expect(baseXp({ type: "task", priority: "low", category: "work" })).toBe(5);
    expect(baseXp({ type: "task", priority: "medium", category: "work" })).toBe(10);
    expect(baseXp({ type: "task", priority: "high", category: "work" })).toBe(20);
    expect(baseXp({ type: "task", priority: "urgent", category: "work" })).toBe(35);
  });
  it("rounds focus minutes to nearest 5 XP", () => {
    expect(baseXp({ type: "focus", durationMin: 25 })).toBe(25);
    expect(baseXp({ type: "focus", durationMin: 50 })).toBe(50);
    expect(baseXp({ type: "focus", durationMin: 12 })).toBe(10);
  });
  it("habit / login / health constants", () => {
    expect(baseXp({ type: "habit" })).toBe(8);
    expect(baseXp({ type: "login" })).toBe(5);
    expect(baseXp({ type: "health", kind: "water_goal" })).toBe(5);
    expect(baseXp({ type: "health", kind: "step_goal" })).toBe(10);
    expect(baseXp({ type: "health", kind: "mood" })).toBe(3);
  });
});

describe("streakMultiplier", () => {
  it("is 1.0 at streak 0", () => {
    expect(streakMultiplier(0)).toBeCloseTo(1.0);
  });
  it("caps at 1.6 at 30 days", () => {
    expect(streakMultiplier(30)).toBeCloseTo(1.6);
    expect(streakMultiplier(45)).toBeCloseTo(1.6);
  });
  it("scales linearly between", () => {
    expect(streakMultiplier(10)).toBeCloseTo(1.2);
  });
});

describe("difficultyMultiplier", () => {
  it("returns 1.0 for level 1 baseline", () => {
    expect(difficultyMultiplier(1, 2)).toBe(1.0);
  });
  it("returns 0.9 for far-below actions at higher levels", () => {
    expect(difficultyMultiplier(12, 1)).toBe(0.9);
  });
  it("returns 1.15 for at/above level actions", () => {
    expect(difficultyMultiplier(6, 4)).toBe(1.15);
  });
});

describe("dailyBonusMultiplier", () => {
  it("boosts the first 3 actions of the day", () => {
    expect(dailyBonusMultiplier(0)).toBe(1.25);
    expect(dailyBonusMultiplier(2)).toBe(1.25);
    expect(dailyBonusMultiplier(3)).toBe(1.0);
    expect(dailyBonusMultiplier(7)).toBe(1.0);
  });
});

describe("computeXp", () => {
  it("multiplies base × streak × difficulty × daily-bonus", () => {
    // medium task = 10 base, 10-day streak = 1.2, level 1 / diff 2 = 1.0, action #1 = 1.25
    // → 10 * 1.2 * 1.0 * 1.25 = 15
    const xp = computeXp(
      { type: "task", priority: "medium", category: "work" },
      { streakDays: 10, userLevel: 1, actionsToday: 0 },
    );
    expect(xp).toBe(15);
  });
  it("difficultyOf maps priorities", () => {
    expect(difficultyOf({ type: "task", priority: "low", category: "work" })).toBe(1);
    expect(difficultyOf({ type: "task", priority: "urgent", category: "work" })).toBe(4);
  });
});

describe("levelFromXp", () => {
  it("uses sqrt curve: L1 @ 60, L5 @ 1500, L10 @ 6000", () => {
    expect(xpForLevel(1)).toBe(60);
    expect(xpForLevel(5)).toBe(1500);
    expect(xpForLevel(10)).toBe(6000);
    expect(xpForLevel(25)).toBe(37500);
  });
  it("returns level 0 at 0 XP", () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(0);
    expect(l.xpToNext).toBe(60);
    expect(l.progress).toBe(0);
  });
  it("returns level 1 at exactly 60 XP", () => {
    expect(levelFromXp(60).level).toBe(1);
  });
  it("computes progress within a level", () => {
    const l = levelFromXp(120); // between L1(60) and L2(240)
    expect(l.level).toBe(1);
    expect(l.xpInLevel).toBe(60);
    expect(l.progress).toBeCloseTo(60 / 180, 2);
  });
});

describe("branchOf", () => {
  it("routes work tasks to focus", () => {
    expect(branchOf({ type: "task", priority: "high", category: "work" })).toBe("focus");
  });
  it("routes health/learning tasks correctly", () => {
    expect(branchOf({ type: "task", priority: "low", category: "health" })).toBe("health");
    expect(branchOf({ type: "task", priority: "low", category: "learning" })).toBe("learning");
  });
  it("routes personal/other to craft", () => {
    expect(branchOf({ type: "task", priority: "low", category: "personal" })).toBe("craft");
    expect(branchOf({ type: "task", priority: "low", category: "other" })).toBe("craft");
  });
  it("routes focus sessions and health logs", () => {
    expect(branchOf({ type: "focus", durationMin: 25 })).toBe("focus");
    expect(branchOf({ type: "health", kind: "water_goal" })).toBe("health");
  });
  it("routes habits with health emoji to health", () => {
    expect(branchOf({ type: "habit", emoji: "💧" })).toBe("health");
    expect(branchOf({ type: "habit", emoji: "🏋️" })).toBe("health");
  });
});

describe("branchLevelFromXp", () => {
  it("L1 at 25 XP, L2 at 100, L5 at 625", () => {
    expect(branchLevelFromXp(0).level).toBe(0);
    expect(branchLevelFromXp(25).level).toBe(1);
    expect(branchLevelFromXp(100).level).toBe(2);
    expect(branchLevelFromXp(625).level).toBe(5);
  });
});

describe("nextPerk", () => {
  it("finds the next perk after the user's current branch level", () => {
    expect(nextPerk("focus", 0)?.level).toBe(3);
    expect(nextPerk("focus", 3)?.level).toBe(5);
    expect(nextPerk("focus", 99)).toBeNull();
  });
});

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      currentStreak(["2026-04-17", "2026-04-18", "2026-04-19"], "2026-04-19"),
    ).toBe(3);
  });
  it("survives one-day grace if yesterday is present", () => {
    expect(currentStreak(["2026-04-17", "2026-04-18"], "2026-04-19")).toBe(2);
  });
  it("returns 0 when broken", () => {
    expect(currentStreak(["2026-04-10"], "2026-04-19")).toBe(0);
  });
});

describe("productivityScore", () => {
  it("scores 100 when every component maxed", () => {
    expect(
      productivityScore({
        completedTasks: 5,
        plannedTasks: 5,
        focusMinutes: 60,
        focusTargetMinutes: 60,
        dailyStreak: 30,
      }),
    ).toBe(100);
  });
  it("scores 0 when nothing happens", () => {
    expect(
      productivityScore({
        completedTasks: 0,
        plannedTasks: 0,
        focusMinutes: 0,
        focusTargetMinutes: 50,
        dailyStreak: 0,
      }),
    ).toBe(0);
  });
});
