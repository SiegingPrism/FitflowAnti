import type { FocusSession, StoreGet, StoreSet } from "./types";
import { offlineQueue } from "../sync/offlineQueue";
import { getISTISOString } from "../utils";

export interface FocusSlice {
  focusSessions: FocusSession[];
  logFocusSession: (s: Omit<FocusSession, "id" | "completedAt">) => void;
}

export const createFocusSlice = (set: StoreSet, get: StoreGet): FocusSlice => ({
  focusSessions: [],

  logFocusSession: (input) => {
    const id = crypto.randomUUID();
    const session: FocusSession = {
      id,
      completedAt: getISTISOString(),
      ...input,
    };

    set((st) => ({ focusSessions: [session, ...st.focusSessions] }));
    get().awardFor({ type: "focus", durationMin: input.durationMin }, `Focus: ${input.durationMin}m`);

    const userId = get().userId;
    if (userId) {
      offlineQueue.enqueue(userId, "focus_create", {
        id,
        taskId: input.taskId ?? null,
        durationMin: input.durationMin,
      });
    }
  },
});

