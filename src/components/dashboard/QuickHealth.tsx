import { motion } from "framer-motion";
import { useAppStore, todayKey } from "@/lib/store";
import { Droplets, Footprints, Activity, Plus } from "lucide-react";
import { toast } from "sonner";

const moods = [
  { v: 1 as const, e: "😞", label: "Sad" },
  { v: 2 as const, e: "😕", label: "Neutral" },
  { v: 3 as const, e: "😐", label: "Okay" },
  { v: 4 as const, e: "🙂", label: "Good" },
  { v: 5 as const, e: "😄", label: "Great" },
];

export const QuickHealth = () => {
  const { healthLogs, logHealth, setMood } = useAppStore();
  const today = todayKey();
  const state = useAppStore();
  const log = healthLogs.find((l) => l.date === today) ?? { date: today, waterMl: 0, steps: 0, workouts: 0 };
  const waterPct = Math.min(100, (log.waterMl / 2500) * 100);
  const stepsPct = Math.min(100, (log.steps / 8000) * 100);

  const hour = new Date().getHours();
  let currentSlot: "morning" | "afternoon" | "evening" = "morning";
  if (hour >= 12 && hour < 18) currentSlot = "afternoon";
  if (hour >= 18 || hour < 5) currentSlot = "evening";

  const daySlots = state.claimedSlots[today] || [];
  const focusToday = state.focusSessions.filter(s => s.completedAt.startsWith(today)).length;
  const moodEventsToday = state.xpHistory.filter(e => e.at.startsWith(today) && e.reason.includes("Mood logged")).length;
  
  const canAwardMood = !daySlots.includes(currentSlot) || (focusToday > (moodEventsToday - daySlots.length));

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="glass-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Wellbeing</p>
          <h2 className="text-xl font-display font-bold mt-1">Today's body</h2>
        </div>
      </div>

      <div className="space-y-4">
        <Metric
          icon={<Droplets className="w-4 h-4" />}
          label="Hydration"
          value={`${(log.waterMl / 1000).toFixed(1)}L / 2.5L`}
          pct={waterPct}
          tone="accent"
          action={
            <button
              onClick={() => logHealth({ waterMl: log.waterMl + 250 })}
              className="text-xs font-semibold text-accent inline-flex items-center gap-1 hover:scale-105 transition-bounce"
            >
              <Plus className="w-3 h-3" /> 250ml
            </button>
          }
        />
        <Metric
          icon={<Footprints className="w-4 h-4" />}
          label="Steps"
          value={`${log.steps.toLocaleString()} / 8,000`}
          pct={stepsPct}
          tone="primary"
          action={
            <button
              onClick={() => logHealth({ steps: log.steps + 1000 })}
              className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:scale-105 transition-bounce"
            >
              <Plus className="w-3 h-3" /> 1k
            </button>
          }
        />
        <Metric
          icon={<Activity className="w-4 h-4" />}
          label="Workouts"
          value={`${log.workouts} today`}
          pct={Math.min(100, log.workouts * 50)}
          tone="success"
          action={
            <button
              onClick={() => logHealth({ workouts: log.workouts + 1 })}
              className="text-xs font-semibold text-success inline-flex items-center gap-1 hover:scale-105 transition-bounce"
            >
              <Plus className="w-3 h-3" /> Log
            </button>
          }
        />
      </div>

      <div className="mt-5 pt-4 border-t border-border/40">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {currentSlot.charAt(0).toUpperCase() + currentSlot.slice(1)} Ritual
          </p>
          <div className="flex gap-1">
            {["morning", "afternoon", "evening"].map((s) => (
              <div 
                key={s} 
                className={`w-2 h-2 rounded-full ${daySlots.includes(s as "morning" | "afternoon" | "evening") ? "bg-success shadow-glow" : "bg-muted"}`}
                title={s}
              />
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-1">
          {moods.map((m) => {
            const isSelected = log.mood === m.v;
            const isClaimed = daySlots.includes(currentSlot);
            const hasBonus = focusToday > (moodEventsToday - daySlots.length);
            const canClaim = !isClaimed || hasBonus;

            return (
              <button
                key={m.v}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canClaim) {
                    setMood(m.v);
                    toast.success("Mood logged!", { icon: "✨" });
                  } else {
                    toast.info(`You've already claimed your ${currentSlot} XP!`, {
                      description: "Complete a focus session to earn a bonus wellbeing slot.",
                      icon: "🔒"
                    });
                  }
                }}
                disabled={isSelected && isClaimed}
                className={`flex-1 py-3 rounded-xl text-2xl transition-bounce hover:scale-110 ${
                  isSelected ? "bg-primary/20 scale-110 shadow-glow ring-2 ring-primary/20" : "hover:bg-muted"
                } ${!canClaim && !isSelected ? "grayscale opacity-40 cursor-not-allowed" : ""}`}
                aria-label={`Mood ${m.v}`}
              >
                {m.e}
              </button>
            );
          })}
        </div>
        {!canAwardMood && (
          <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
            Ritual complete. Earn bonus slots by finishing focus sessions.
          </p>
        )}
      </div>
    </motion.section>
  );
};

const Metric = ({
  icon, label, value, pct, tone, action,
}: { icon: React.ReactNode; label: string; value: string; pct: number; tone: "primary" | "accent" | "success"; action: React.ReactNode }) => {
  const toneClass = { primary: "bg-primary", accent: "bg-accent", success: "bg-success" }[tone];
  const toneBg = { primary: "bg-primary/10 text-primary", accent: "bg-accent/10 text-accent", success: "bg-success/10 text-success" }[tone];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneBg}`}>{icon}</div>
          <div>
            <p className="text-sm font-semibold leading-none">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{value}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${toneClass}`}
        />
      </div>
    </div>
  );
};
