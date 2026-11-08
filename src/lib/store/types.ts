import type { ActionSource, Branch, TaskCategory } from "../gamification";

export type { ActionSource, Branch, TaskCategory } from "../gamification";

export type Priority = "low" | "medium" | "high" | "urgent";

export type PrimaryGoal = "ship" | "fit" | "learn" | "recover";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  category: TaskCategory;
  durationMin: number;
  xp: number;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  xpAwarded?: boolean;
  isMindDev?: boolean;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  targetPerWeek: number;
  history: string[];
  createdAt: string;
  category?: TaskCategory;
  isMindDev?: boolean;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  durationMin: number;
  completedAt: string;
}

export interface HealthLog {
  date: string;
  waterMl: number;
  steps: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  workouts: number;
  sleepHours?: number;
}

export interface XPEvent {
  id: string;
  amount: number;
  reason: string;
  branch: Branch;
  sourceType: "task" | "habit" | "focus" | "health" | "login" | "activity";
  at: string;
}

export type TimeSlot = "morning" | "afternoon" | "evening";

export interface AppState {
  // Auth-bound state
  userId: string | null;
  /** Account the locally cached data belongs to (persisted). */
  ownerId: string | null;
  hydrated: boolean;

  // Mood/Health tracking
  claimedSlots: Record<string, TimeSlot[]>;

  // Data
  tasks: Task[];
  habits: Habit[];
  focusSessions: FocusSession[];
  healthLogs: HealthLog[];
  xpHistory: XPEvent[];
  totalXP: number;
  userName: string;

  onboardedAt?: string;
  primaryGoals: PrimaryGoal[];
  dailyFocusTargetMin: number;

  // Tasks
  addTask: (t: Omit<Task, "id" | "createdAt" | "completed" | "xp"> & { xp?: number }) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;

  // Habits
  addHabit: (h: Omit<Habit, "id" | "createdAt" | "history">) => void;
  toggleHabitToday: (id: string) => void;
  removeHabit: (id: string) => void;

  // Focus
  logFocusSession: (s: Omit<FocusSession, "id" | "completedAt">) => void;

  // Health
  logHealth: (patch: Partial<HealthLog> & { date?: string }) => void;
  setMood: (mood: 1 | 2 | 3 | 4 | 5) => void;

  // XP
  awardFor: (source: ActionSource, reason: string, skipCloudSync?: boolean) => number;

  // Onboarding
  completeOnboarding: (data: {
    userName: string;
    primaryGoals: PrimaryGoal[];
    dailyFocusTargetMin: number;
    starterHabits: Array<Omit<Habit, "id" | "createdAt" | "history">>;
  }) => void;
  resetOnboarding: () => void;

  // User profile
  setUserName: (name: string) => void;
  setPrimaryGoals: (goals: PrimaryGoal[]) => void;
  setDailyFocusTarget: (min: number) => void;

  // Cloud lifecycle
  bindUser: (userId: string | null) => Promise<void>;
  clearLocal: () => void;

  // Dev & Settings
  grantDebugXp: (amount: number, reason?: string) => void;
  hellMode: boolean;
  toggleHellMode: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  mindDevMode: boolean;
  setMindDevMode: (active: boolean) => void;
  syncMindDevTasksAndHabits: (month: 1 | 2 | 3) => void;
}

export type StoreSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
  replace?: false,
) => void;

export type StoreGet = () => AppState;

