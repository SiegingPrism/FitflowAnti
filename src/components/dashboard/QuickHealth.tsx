import { motion } from "framer-motion";
import { useAppStore, todayKey } from "@/lib/store";
import { Droplets, Footprints, Activity, Plus } from "lucide-react";

const moods = [
  { v: 1 as const, e: "😞" },
  { v: 2 as const, e: "😕" },
  { v: 3 as const, e: "😐" },
  { v: 4 as const, e: "🙂" },
  { v: 5 as const, e: "😄" },
];

export const QuickHealth = () => {
  const { healthLogs, logHealth, setMood } = useAppStore();
  const today = todayKey();
  const log = healthLogs.find((l) => l.date === today) ?? { date: today, waterMl: 0, steps: 0, workouts: 0 };
  const waterPct = Math.min(100, (log.waterMl / 2500) * 100);
  const stepsPct = Math.min(100, (log.steps / 8000) * 100);

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
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">How are you feeling?</p>
        <div className="flex items-center justify-between gap-1">
          {moods.map((m) => (
            <button
              key={m.v}
              onClick={() => setMood(m.v)}
              className={`flex-1 py-2 rounded-xl text-2xl transition-bounce hover:scale-110 ${
                log.mood === m.v ? "bg-primary/15 scale-110 shadow-glow" : "hover:bg-muted"
              }`}
              aria-label={`Mood ${m.v}`}
            >
              {m.e}
            </button>
          ))}
        </div>
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
