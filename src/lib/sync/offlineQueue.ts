import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export type MutationAction =
  | "task_create"
  | "task_update"
  | "task_delete"
  | "task_complete"
  | "task_uncomplete"
  | "habit_create"
  | "habit_checkin"
  | "habit_uncheck"
  | "habit_delete"
  | "focus_create"
  | "health_upsert"
  | "xp_record"
  | "profile_update";

export interface QueuedMutation {
  id: string;
  userId: string;
  action: MutationAction;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

const STORAGE_KEY = "fitflow_offline_queue_v1";

class OfflineQueueManager {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadQueue();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        console.log("[OfflineQueue] Network restored, draining pending writes...");
        this.drainQueue();
      });
    }
  }

  private loadQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw) as QueuedMutation[];
      }
    } catch (err) {
      console.warn("[OfflineQueue] Failed to parse stored queue:", err);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      this.notify();
    } catch (err) {
      console.warn("[OfflineQueue] Failed to save queue to localStorage:", err);
    }
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("[OfflineQueue] Listener error:", e);
      }
    });
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getPendingMutations(): QueuedMutation[] {
    return [...this.queue];
  }

  /** IDs of records with a queued (not yet synced) mutation of the given action. */
  public pendingIds(userId: string, action: MutationAction): Set<string> {
    return new Set(
      this.queue
        .filter((m) => m.userId === userId && m.action === action)
        .map((m) => m.payload.id as string)
        .filter(Boolean),
    );
  }

  /** Drop every queued write (used on sign-out so nothing leaks into the next account). */
  public clear() {
    this.queue = [];
    this.saveQueue();
  }

  public enqueue(
    userId: string,
    action: MutationAction,
    payload: Record<string, unknown>,
  ) {
    if (!userId || userId === "dev-local-user" || userId === "guest-user" || userId.startsWith("local-")) {
      return; // Local sessions do not sync to cloud
    }

    const item: QueuedMutation = {
      id: crypto.randomUUID(),
      userId,
      action,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };

    this.queue.push(item);
    this.saveQueue();

    // Attempt immediate drain if online
    if (typeof navigator !== "undefined" && navigator.onLine) {
      this.drainQueue();
    }
  }

  public async drainQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.log("[OfflineQueue] Device is offline, waiting for connection.");
      return;
    }

    this.isProcessing = true;
    console.log(`[OfflineQueue] Draining ${this.queue.length} pending mutations...`);

    const remaining: QueuedMutation[] = [];

    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      try {
        const success = await this.executeMutation(item);
        if (!success) {
          item.retryCount += 1;
          if (item.retryCount > 10) {
            console.error(`[OfflineQueue] Mutation ${item.action} failed after 10 retries, dropping:`, item);
          } else {
            remaining.push(item);
          }
        }
      } catch (err) {
        console.error(`[OfflineQueue] Network error executing ${item.action}:`, err);
        item.retryCount += 1;
        remaining.push(item);
        // Halt queue draining on network failure to preserve chronological order
        const rest = this.queue.slice(i + 1);
        remaining.push(...rest);
        break;
      }
    }

    this.queue = remaining;
    this.saveQueue();
    this.isProcessing = false;
  }

  private async executeMutation(item: QueuedMutation): Promise<boolean> {
    const { action, payload, userId } = item;

    switch (action) {
      case "task_create": {
        const { error } = await supabase.from("tasks").insert({
          id: payload.id as string,
          user_id: userId,
          title: payload.title as string,
          notes: (payload.notes as string) || null,
          priority: payload.priority as string,
          category: payload.category as string,
          duration_min: payload.durationMin as number,
          xp: payload.xp as number,
          due_date: (payload.dueDate as string) || null,
        });
        if (error && error.code !== "23505") { // Ignore duplicate insert
          console.error("[OfflineQueue] task_create error:", error);
          return false;
        }
        return true;
      }

      case "task_update": {
        const patch = payload.patch as Record<string, unknown>;
        const dbPatch: Record<string, unknown> = {};
        if (patch.title !== undefined) dbPatch.title = patch.title;
        if (patch.notes !== undefined) dbPatch.notes = patch.notes;
        if (patch.priority !== undefined) dbPatch.priority = patch.priority;
        if (patch.category !== undefined) dbPatch.category = patch.category;
        if (patch.durationMin !== undefined) dbPatch.duration_min = patch.durationMin;
        if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;

        const { error } = await supabase
          .from("tasks")
          .update(dbPatch as TablesUpdate<"tasks">)
          .eq("id", payload.id as string)
          .eq("user_id", userId);
        if (error) {
          console.error("[OfflineQueue] task_update error:", error);
          return false;
        }
        return true;
      }

      case "task_delete": {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", payload.id as string)
          .eq("user_id", userId);
        if (error) {
          console.error("[OfflineQueue] task_delete error:", error);
          return false;
        }
        return true;
      }

      case "task_complete": {
        const { error } = await supabase.rpc("complete_task", {
          p_task_id: payload.id as string,
        });
        if (error) {
          console.error("[OfflineQueue] complete_task RPC error:", error);
          return false;
        }
        return true;
      }

      case "task_uncomplete": {
        const { error } = await supabase
          .from("tasks")
          .update({ completed: false, completed_at: null })
          .eq("id", payload.id as string)
          .eq("user_id", userId);
        if (error) {
          console.error("[OfflineQueue] task_uncomplete error:", error);
          return false;
        }
        return true;
      }

      case "habit_create": {
        const { error } = await supabase.from("habits").insert({
          id: payload.id as string,
          user_id: userId,
          name: payload.name as string,
          emoji: payload.emoji as string,
          color: payload.color as string,
          target_per_week: payload.targetPerWeek as number,
          category: (payload.category as string) || null,
        });
        if (error && error.code !== "23505") {
          console.error("[OfflineQueue] habit_create error:", error);
          return false;
        }
        return true;
      }

      case "habit_checkin": {
        const { error } = await supabase.rpc("checkin_habit", {
          p_habit_id: payload.id as string,
          p_date: payload.date as string,
        });
        if (error) {
          // Fallback to direct checkin insert if RPC fails
          const { error: directErr } = await supabase.from("habit_checkins").insert({
            user_id: userId,
            habit_id: payload.id as string,
            date: payload.date as string,
          });
          if (directErr && directErr.code !== "23505") {
            console.error("[OfflineQueue] habit_checkin error:", directErr);
            return false;
          }
        }
        return true;
      }

      case "habit_uncheck": {
        const { error } = await supabase.rpc("uncheck_habit", {
          p_habit_id: payload.id as string,
          p_date: payload.date as string,
        });
        if (error) {
          // Fallback: remove the check-in row directly (RLS allows own deletes)
          const { error: directErr } = await supabase
            .from("habit_checkins")
            .delete()
            .eq("habit_id", payload.id as string)
            .eq("date", payload.date as string)
            .eq("user_id", userId);
          if (directErr) {
            console.error("[OfflineQueue] habit_uncheck error:", directErr);
            return false;
          }
        }
        return true;
      }

      case "habit_delete": {
        const { error } = await supabase
          .from("habits")
          .delete()
          .eq("id", payload.id as string)
          .eq("user_id", userId);
        if (error) {
          console.error("[OfflineQueue] habit_delete error:", error);
          return false;
        }
        return true;
      }

      case "focus_create": {
        const { error } = await supabase.from("focus_sessions").insert({
          id: payload.id as string,
          user_id: userId,
          task_id: (payload.taskId as string) || null,
          duration_min: payload.durationMin as number,
        });
        if (error && error.code !== "23505") {
          console.error("[OfflineQueue] focus_create error:", error);
          return false;
        }
        return true;
      }

      case "health_upsert": {
        const { error } = await supabase.from("health_logs").upsert(
          {
            user_id: userId,
            date: payload.date as string,
            water_ml: payload.waterMl as number,
            steps: payload.steps as number,
            workouts: payload.workouts as number,
            mood: (payload.mood as number) || null,
            sleep_hours: (payload.sleepHours as number) || null,
          },
          { onConflict: "user_id,date" },
        );
        if (error) {
          console.error("[OfflineQueue] health_upsert error:", error);
          return false;
        }
        return true;
      }

      case "xp_record": {
        // Use verified record_xp_event RPC
        const { error } = await supabase.rpc("record_xp_event", {
          p_amount: payload.amount as number,
          p_reason: (payload.reason as string) || "Activity XP",
          p_branch: (payload.branch as string) || "craft",
          p_source_type: (payload.sourceType as string) || "activity",
        });
        if (error) {
          console.error("[OfflineQueue] record_xp_event RPC error:", error);
          return false;
        }
        return true;
      }

      case "profile_update": {
        const patch = payload.patch as Record<string, unknown>;
        const { error } = await supabase
          .from("profiles")
          .update(patch as TablesUpdate<"profiles">)
          .eq("user_id", userId);
        if (error) {
          console.error("[OfflineQueue] profile_update error:", error);
          return false;
        }
        return true;
      }

      default:
        console.warn("[OfflineQueue] Unknown mutation action:", action);
        return true;
    }
  }
}

export const offlineQueue = new OfflineQueueManager();

