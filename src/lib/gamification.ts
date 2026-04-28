/**
 * FlowSphere Gamification Engine
 * Spec: system-design/gamification.md
 *
 * Pure, side-effect-free helpers. Anything that touches the store
 * imports from here so the math is unit-testable in isolation.
 */

export type Branch = "focus" | "health" | "learning" | "craft";
export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskCategory = "work" | "personal" | "health" | "learning" | "fitness" | "study" | "mental_health" | "other";

export type ActionSource =
  | { type: "task"; priority: Priority; category: TaskCategory }
  | { type: "habit"; category?: TaskCategory; emoji?: string }
  | { type: "focus"; durationMin: number }
  | { type: "health"; kind: "water_goal" | "step_goal" | "mood" | "workout" }
  | { type: "login" };

// ---------------------------------------------------------------------------
// 1. Base XP table
// ---------------------------------------------------------------------------

const TASK_BASE_XP: Record<Priority, number> = {
  low: 5,
  medium: 10,
  high: 20,
  urgent: 35,
};

const HEALTH_BASE_XP: Record<
  Extract<ActionSource, { type: "health" }>["kind"],
  number
> = {
  water_goal: 5,
  step_goal: 10,
  mood: 3,
  workout: 8,
};

export const HABIT_BASE_XP = 8;
export const LOGIN_BASE_XP = 5;

export function baseXp(source: ActionSource): number {
  switch (source.type) {
    case "task":
      return TASK_BASE_XP[source.priority];
    case "habit":
      return HABIT_BASE_XP;
    case "focus":
      // round(min/5)*5 → 25m=25, 50m=50
      return Math.round(source.durationMin / 5) * 5;
    case "health":
      return HEALTH_BASE_XP[source.kind];
    case "login":
      return LOGIN_BASE_XP;
  }
}

// ---------------------------------------------------------------------------
// 2. Multipliers
// ---------------------------------------------------------------------------

/** 1 + min(streak, 30) * 0.02 → caps at 1.6× at 30-day streak. */
export function streakMultiplier(streakDays: number): number {
  const s = Math.max(0, Math.floor(streakDays));
  return 1 + Math.min(s, 30) * 0.02;
}

/**
 * 1.0 baseline. 0.9 if action is far below user level (anti-grind).
 * 1.15 if at or above user level.
 *
 * "actionDifficulty" is a 1–4 ordinal (low/med/high/urgent → 1/2/3/4 for tasks,
 * other actions are 2 unless specified).
 */
export function difficultyMultiplier(
  userLevel: number,
  actionDifficulty: number,
): number {
  // expected difficulty grows ~ sqrt(level) but we keep it simple:
  // actions <= userLevel/4 are "far below", >= userLevel/3 are "at or above".
  if (userLevel <= 1) return 1.0;
  const farBelow = actionDifficulty < Math.max(1, Math.floor(userLevel / 4));
  const atOrAbove = actionDifficulty >= Math.max(1, Math.ceil(userLevel / 3));
  if (farBelow) return 0.9;
  if (atOrAbove) return 1.15;
  return 1.0;
}

/** First 3 actions of the day = 1.25×. */
export function dailyBonusMultiplier(actionsToday: number): number {
  return actionsToday < 3 ? 1.25 : 1.0;
}

// ---------------------------------------------------------------------------
// 3. Final XP
// ---------------------------------------------------------------------------

export interface AwardContext {
  streakDays: number;
  userLevel: number;
  actionsToday: number;
}

export function difficultyOf(source: ActionSource): number {
  if (source.type === "task") {
    return { low: 1, medium: 2, high: 3, urgent: 4 }[source.priority];
  }
  if (source.type === "focus") {
    if (source.durationMin >= 50) return 3;
    if (source.durationMin >= 25) return 2;
    return 1;
  }
  return 2;
}

export function computeXp(source: ActionSource, ctx: AwardContext): number {
  const base = baseXp(source);
  const final =
    base *
    streakMultiplier(ctx.streakDays) *
    difficultyMultiplier(ctx.userLevel, difficultyOf(source)) *
    dailyBonusMultiplier(ctx.actionsToday);
  return Math.round(final);
}

// ---------------------------------------------------------------------------
// 4. Levels — sqrt curve (target v2)
//    level = floor(sqrt(total_xp / 60))
//    L1 @ 60 · L5 @ 1500 · L10 @ 6000 · L25 @ 37500
// ---------------------------------------------------------------------------

export interface LevelInfo {
  level: number;
  xpInLevel: number;
  xpToNext: number;
  xpForCurrent: number;
  xpForNext: number;
  progress: number; // 0..1
}

export function xpForLevel(level: number): number {
  return Math.max(0, level) ** 2 * 60;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(Math.sqrt(xp / 60));
  const xpForCurrent = xpForLevel(level);
  const xpForNext = xpForLevel(level + 1);
  const xpInLevel = xp - xpForCurrent;
  const span = xpForNext - xpForCurrent;
  return {
    level,
    xpInLevel,
    xpToNext: xpForNext - xp,
    xpForCurrent,
    xpForNext,
    progress: span > 0 ? xpInLevel / span : 0,
  };
}

// ---------------------------------------------------------------------------
// 5. Branch routing — every XP event lands in exactly one branch
// ---------------------------------------------------------------------------

const HEALTH_EMOJIS = new Set(["💧", "🏋️", "🏃", "🧘", "🍎", "🥗", "💪", "😴"]);

export function branchOf(source: ActionSource): Branch {
  switch (source.type) {
    case "task": {
      if (source.category === "work") return "focus";
      if (source.category === "health") return "health";
      if (source.category === "learning") return "learning";
      if (source.category === "study") return "learning";
      if (source.category === "fitness") return "health";
      if (source.category === "mental_health") return "health";
      return "craft"; // personal + other
    }
    case "habit": {
      if (source.emoji && HEALTH_EMOJIS.has(source.emoji)) return "health";
      if (source.category === "learning") return "learning";
      if (source.category === "health") return "health";
      if (source.category === "work") return "focus";
      if (source.category === "study") return "learning";
      if (source.category === "fitness") return "health";
      if (source.category === "mental_health") return "health";
      return "craft";
    }
    case "focus":
      return "focus";
    case "health":
      return "health";
    case "login":
      return "craft";
  }
}

/**
 * Branch level uses the same sqrt curve but on a smaller denominator
 * so branches feel responsive even at low totals (~25 XP for L1).
 */
export function branchLevelFromXp(branchXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(branchXp));
  const D = 25;
  const level = Math.floor(Math.sqrt(xp / D));
  const xpForCurrent = level ** 2 * D;
  const xpForNext = (level + 1) ** 2 * D;
  const xpInLevel = xp - xpForCurrent;
  const span = xpForNext - xpForCurrent;
  return {
    level,
    xpInLevel,
    xpToNext: xpForNext - xp,
    xpForCurrent,
    xpForNext,
    progress: span > 0 ? xpInLevel / span : 0,
  };
}

// ---------------------------------------------------------------------------
// 6. Branch perks — L3 / L5 indicators per spec §5
// ---------------------------------------------------------------------------

export interface BranchPerk {
  level: number;
  label: string;
  description: string;
}

export const BRANCH_PERKS: Record<Branch, BranchPerk[]> = {
  focus: [
    { level: 3, label: "Long-session boost", description: "+10% XP on focus sessions ≥ 50 min." },
    { level: 5, label: "Weekly plan generator", description: "AI Coach drafts a week of focused work." },
  ],
  health: [
    { level: 3, label: "Streak shield", description: "Earn freeze tokens twice as fast." },
    { level: 5, label: "Burnout watch", description: "AI Coach watches mood/sleep and proposes Recovery Missions." },
  ],
  learning: [
    { level: 3, label: "Insight digest", description: "Weekly summary of what you've learned." },
    { level: 5, label: "Spaced review", description: "Coach surfaces topics due for review." },
  ],
  craft: [
    { level: 3, label: "Custom habit colors", description: "Unlock the full palette for habits." },
    { level: 5, label: "Theme: Aurora", description: "Unlock the Aurora theme." },
  ],
  fitness: [
    { level: 3, label: "Active Recovery", description: "Bonus XP for rest days after consistent workouts." },
    { level: 5, label: "AI Trainer", description: "Personalized workout progression plans." },
  ],
  study: [
    { level: 3, label: "Deep Study", description: "Bonus XP for consecutive study blocks." },
    { level: 5, label: "Knowledge Graph", description: "Visualize connections between learned topics." },
  ],
  mental_health: [
    { level: 3, label: "Mindfulness Streak", description: "Double XP for meditation routines." },
    { level: 5, label: "Resilience Tracker", description: "Advanced emotional patterning and feedback." },
  ],
  work: [
    { level: 3, label: "Deep Work Boost", description: "Bonus XP for zero-interruption blocks." },
    { level: 5, label: "Executive Coach", description: "AI prioritization of daily high-leverage tasks." },
  ],
  other: [
    { level: 3, label: "Generalist", description: "Extra XP for completing varied tasks." },
    { level: 5, label: "Jack of all Trades", description: "Unlock special avatar flair." },
  ],
};

export function nextPerk(branch: Branch, currentLevel: number): BranchPerk | null {
  return BRANCH_PERKS[branch].find((p) => p.level > currentLevel) ?? null;
}

export const BRANCH_META: Record<Branch, { label: string; emoji: string; tone: string }> = {
  focus: { label: "Focus", emoji: "⚡", tone: "primary" },
  health: { label: "Health", emoji: "🌱", tone: "success" },
  learning: { label: "Learning", emoji: "📚", tone: "accent" },
  craft: { label: "Craft", emoji: "🎨", tone: "warning" },
  fitness: { label: "Fitness", emoji: "🏃", tone: "primary" },
  study: { label: "Study", emoji: "📖", tone: "accent" },
  mental_health: { label: "Mental Health", emoji: "🧘", tone: "success" },
  work: { label: "Work", emoji: "💼", tone: "primary" },
  other: { label: "Other", emoji: "✨", tone: "warning" }
};

// ---------------------------------------------------------------------------
// 7. Streak helpers — derived from a sorted list of YYYY-MM-DD strings
// ---------------------------------------------------------------------------

/** Returns the consecutive-day streak ending today (or yesterday). */
export function currentStreak(dates: string[], todayIso: string): number {
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date(todayIso + "T00:00:00");
  // allow grace: if today not present but yesterday is, streak still alive
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Daily Productivity Score per spec §7. */
export function productivityScore(opts: {
  completedTasks: number;
  plannedTasks: number;
  focusMinutes: number;
  focusTargetMinutes: number;
  dailyStreak: number;
}): number {
  const { completedTasks, plannedTasks, focusMinutes, focusTargetMinutes, dailyStreak } = opts;
  const taskPart = (completedTasks / Math.max(plannedTasks, 1)) * 50;
  const focusPart = (focusMinutes / Math.max(focusTargetMinutes, 1)) * 30;
  const streakPart = Math.min(dailyStreak / 30, 1) * 20;
  return Math.max(0, Math.min(100, Math.round(taskPart + focusPart + streakPart)));
}
