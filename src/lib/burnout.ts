/**
 * Burnout Watch
 * Spec: ai/recommendation-engine.md §Phase 2
 *
 * Pure function: derives a 0–1 burnout_risk score from the user's recent
 * mood, sleep, completion rate, and streak. If > 0.6 the Coach proposes
 * a Recovery Mission (3 small tasks worth 2x XP).
 */

import { format, subDays } from "date-fns";
import type { HealthLog, Task, XPEvent } from "./store";

export interface BurnoutInputs {
  healthLogs: HealthLog[];
  tasks: Task[];
  xpHistory: XPEvent[];
}

export interface BurnoutResult {
  risk: number; // 0–1
  level: "low" | "moderate" | "high";
  signals: {
    moodTrend: number; // 0–1 (1 = very low mood)
    sleepDeficit: number; // 0–1 (1 = severe deficit)
    completionDrop: number; // 0–1 (1 = sharp drop)
    streakStrain: number; // 0–1 (1 = long unbroken streak)
  };
  reasons: string[];
}

const SLEEP_TARGET_HOURS = 7.5;
const STREAK_STRAIN_DAYS = 14; // unbroken streaks past this start to strain

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const last7Dates = () =>
  Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"));

const previous7Dates = () =>
  Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i + 7), "yyyy-MM-dd"));

export function computeBurnout({ healthLogs, tasks, xpHistory }: BurnoutInputs): BurnoutResult {
  const recent = last7Dates();
  const prior = previous7Dates();

  // 1. Mood trend — average mood over last 7 days, mapped so low mood = high risk
  const recentMoods = healthLogs
    .filter((l) => recent.includes(l.date) && typeof l.mood === "number")
    .map((l) => l.mood as number);
  const avgMood = recentMoods.length ? recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length : 3.5;
  // mood 1 → 1.0 risk, mood 5 → 0 risk
  const moodTrend = clamp01((5 - avgMood) / 4);

  // 2. Sleep deficit — average sleep vs target
  const recentSleep = healthLogs
    .filter((l) => recent.includes(l.date) && typeof l.sleepHours === "number")
    .map((l) => l.sleepHours as number);
  const avgSleep = recentSleep.length ? recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length : SLEEP_TARGET_HOURS;
  // 1.5h deficit = full risk
  const sleepDeficit = clamp01((SLEEP_TARGET_HOURS - avgSleep) / 1.5);

  // 3. Completion drop — recent vs prior week task completions
  const completedRecent = tasks.filter(
    (t) => t.completedAt && recent.includes(t.completedAt.slice(0, 10)),
  ).length;
  const completedPrior = tasks.filter(
    (t) => t.completedAt && prior.includes(t.completedAt.slice(0, 10)),
  ).length;
  let completionDrop = 0;
  if (completedPrior >= 3) {
    // Only meaningful if there was a baseline; >40% drop = full risk
    const drop = (completedPrior - completedRecent) / completedPrior;
    completionDrop = clamp01(drop / 0.4);
  }

  // 4. Streak strain — long XP-event streak without rest day
  const streak = computeXpStreak(xpHistory);
  const streakStrain = clamp01((streak - STREAK_STRAIN_DAYS) / 14);

  // Weighted risk
  const risk = clamp01(
    moodTrend * 0.35 + sleepDeficit * 0.3 + completionDrop * 0.25 + streakStrain * 0.1,
  );

  const reasons: string[] = [];
  if (moodTrend > 0.5) reasons.push(`Mood averaged ${avgMood.toFixed(1)}/5 this week`);
  if (sleepDeficit > 0.4) reasons.push(`Sleeping ${avgSleep.toFixed(1)}h vs ${SLEEP_TARGET_HOURS}h target`);
  if (completionDrop > 0.4) reasons.push(`Completions dropped from ${completedPrior} to ${completedRecent}`);
  if (streakStrain > 0.3) reasons.push(`${streak}-day streak with no rest`);
  if (reasons.length === 0) reasons.push("All signals look healthy");

  return {
    risk,
    level: risk > 0.6 ? "high" : risk > 0.35 ? "moderate" : "low",
    signals: { moodTrend, sleepDeficit, completionDrop, streakStrain },
    reasons,
  };
}

function computeXpStreak(history: XPEvent[]): number {
  if (history.length === 0) return 0;
  const days = Array.from(new Set(history.map((e) => e.at.slice(0, 10)))).sort().reverse();
  let streak = 0;
  let cursor = new Date();
  for (const d of days) {
    const expected = format(cursor, "yyyy-MM-dd");
    if (d === expected) {
      streak += 1;
      cursor = subDays(cursor, 1);
    } else if (d < expected) {
      break;
    }
  }
  return streak;
}

/**
 * Recovery Mission — 3 small, gentle tasks worth 2x XP, suggested when burnout
 * risk crosses 0.6. Returned as Suggestion-shaped payloads the Coach can render.
 */
export interface RecoveryTask {
  title: string;
  priority: "low";
  durationMin: number;
  reason: string;
  xpMultiplier: 2;
}

export function recoveryMission(): RecoveryTask[] {
  return [
    {
      title: "10-minute walk outside",
      priority: "low",
      durationMin: 10,
      reason: "Light movement + daylight resets cortisol.",
      xpMultiplier: 2,
    },
    {
      title: "Box-breathe for 4 minutes",
      priority: "low",
      durationMin: 4,
      reason: "4-4-4-4 breathing drops your heart rate.",
      xpMultiplier: 2,
    },
    {
      title: "Lights out 30 min earlier tonight",
      priority: "low",
      durationMin: 30,
      reason: "Sleep is the highest-leverage recovery you have.",
      xpMultiplier: 2,
    },
  ];
}
