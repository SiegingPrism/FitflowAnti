import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getISTTodayStr } from "./utils";

import type { AppState, StoreGet, StoreSet } from "./store/types";
import { createTasksSlice } from "./store/tasksSlice";
import { createHabitsSlice } from "./store/habitsSlice";
import { createFocusSlice } from "./store/focusSlice";
import { createHealthSlice } from "./store/healthSlice";
import { createGamificationSlice } from "./store/gamificationSlice";
import { createProfileSlice } from "./store/profileSlice";
import { createDevSlice } from "./store/devSlice";
import { hydrateFromCloud, setupRealtimeSync } from "./sync/syncEngine";
import { offlineQueue } from "./sync/offlineQueue";

export type * from "./store/types";

const today = () => getISTTodayStr();
export const todayKey = today;

let realtimeCleanup: (() => void) | null = null;

const isLocalId = (id: string) => id === "dev-local-user" || id === "guest-user" || id.startsWith("local-");

const EMPTY_DATA = {
  tasks: [],
  habits: [],
  focusSessions: [],
  healthLogs: [],
  xpHistory: [],
  claimedSlots: {},
  totalXP: 0,
  userName: "Friend",
  dailyFocusTargetMin: 50,
  onboardedAt: undefined,
  primaryGoals: [],
};

export const useAppStore = create<AppState>()(
  persist<AppState, [], [], Partial<AppState>>(
    (set: StoreSet, get: StoreGet): AppState => ({
      userId: null,
      ownerId: null,
      hydrated: true,

      // Composed slices
      ...createTasksSlice(set, get),
      ...createHabitsSlice(set, get),
      ...createFocusSlice(set, get),
      ...createHealthSlice(set, get),
      ...createGamificationSlice(set, get),
      ...createProfileSlice(set, get),
      ...createDevSlice(set, get),

      // Cloud lifecycle orchestration
      bindUser: async (userId: string | null) => {
        if (!userId) {
          if (realtimeCleanup) {
            realtimeCleanup();
            realtimeCleanup = null;
          }
          set({ userId: null, hydrated: true });
          return;
        }

        // If local session (guest or dev-local), operate 100% locally
        if (isLocalId(userId)) {
          if (realtimeCleanup) {
            realtimeCleanup();
            realtimeCleanup = null;
          }
          set({ userId, ownerId: get().ownerId ?? userId, hydrated: true });
          return;
        }

        // Same user already loaded — skip
        if (get().userId === userId && get().hydrated) return;

        const prevOwner = get().ownerId;
        const switchedAccount = !!prevOwner && prevOwner !== userId && !isLocalId(prevOwner);

        if (switchedAccount) {
          // Cached data belongs to a different account: never show it or upload it here.
          offlineQueue.clear();
          set({ ...EMPTY_DATA, userId, ownerId: userId, hydrated: false });
        } else {
          // Stale-while-revalidate: show the cached copy while the cloud loads
          set({ userId, ownerId: userId, hydrated: true });
        }

        // Upload guest/offline data only when this device's data wasn't already this account's
        const allowMigration = !prevOwner || isLocalId(prevOwner);
        await hydrateFromCloud(userId, get, set, { allowMigration });

        // Realtime subscription setup
        if (realtimeCleanup) {
          realtimeCleanup();
        }
        realtimeCleanup = setupRealtimeSync(userId, get, set);
      },

      clearLocal: () => {
        if (realtimeCleanup) {
          realtimeCleanup();
          realtimeCleanup = null;
        }
        set({ ...EMPTY_DATA, userId: null, ownerId: null, hydrated: false });
      },
    }),
    {
      name: "flowfit-store",
      version: 4,
      partialize: (s) => ({
        ownerId: s.ownerId,
        tasks: s.tasks,
        habits: s.habits,
        focusSessions: s.focusSessions,
        healthLogs: s.healthLogs,
        xpHistory: s.xpHistory,
        totalXP: s.totalXP,
        userName: s.userName,
        onboardedAt: s.onboardedAt,
        primaryGoals: s.primaryGoals,
        dailyFocusTargetMin: s.dailyFocusTargetMin,
        claimedSlots: s.claimedSlots,
        hellMode: s.hellMode,
        mindDevMode: s.mindDevMode,
      }),
    },
  ),
);
