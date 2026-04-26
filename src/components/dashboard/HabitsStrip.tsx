import { motion } from "framer-motion";
import { useAppStore, todayKey } from "@/lib/store";
import { Flame, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const HabitsStrip = () => {
  const habits = useAppStore((s) => s.habits);
  const toggle = useAppStore((s) => s.toggleHabitToday);
  const today = todayKey();

  const computeStreak = (history: string[]) => {
    if (history.length === 0) return 0;
    const set = new Set(history);
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const k = cursor.toISOString().slice(0, 10);
      if (set.has(k)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return streak;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="glass-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Daily ritual</p>
          <h2 className="text-xl font-display font-bold mt-1">Habits</h2>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning inline-flex items-center gap-1">
          <Flame className="w-3 h-3" /> Live
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {habits.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No habits yet. Add one in the Habits tab.</p>
        )}
        {habits.map((h) => {
          const done = h.history.includes(today);
          const streak = computeStreak(h.history);
          return (
            <button
              key={h.id}
              onClick={() => toggle(h.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-smooth text-left",
                done && "bg-primary/5 border-primary/30",
              )}
            >
              <span className="text-2xl">{h.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{h.name}</p>
                <p className="text-xs text-muted-foreground">{streak > 0 ? `🔥 ${streak} day streak` : "Start your streak"}</p>
              </div>
              <div
                className={cn(
                  "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-bounce",
                  done ? "bg-gradient-primary border-transparent text-primary-foreground" : "border-border",
                )}
              >
                {done && <Check className="w-4 h-4" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>
    </motion.section>
  );
};
