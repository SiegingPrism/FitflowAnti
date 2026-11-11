import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/lib/store";
import { BRANCH_META, branchLevelFromXp, Branch } from "@/lib/gamification";
import { motion } from "framer-motion";

const CORE_BRANCHES: Branch[] = [
  "focus",
  "health",
  "learning",
  "craft",
  "fitness",
  "study",
  "mental_health",
  "work",
];

export const LifeBalanceRadar = () => {
  const xpHistory = useAppStore((s) => s.xpHistory) ?? [];
  const tasks = useAppStore((s) => s.tasks) ?? [];
  const sessions = useAppStore((s) => s.focusSessions) ?? [];
  const habits = useAppStore((s) => s.habits) ?? [];
  const healthLogs = useAppStore((s) => s.healthLogs) ?? [];

  // Aggregate XP by branch
  const branchXp: Record<Branch, number> = {
    focus: 0,
    health: 0,
    learning: 0,
    craft: 0,
    fitness: 0,
    study: 0,
    mental_health: 0,
    work: 0,
    other: 0,
  };

  xpHistory.forEach((e) => {
    const branch = e.branch as Branch;
    if (branch && branchXp[branch] !== undefined) {
      branchXp[branch] += Number(e.amount) || 0;
    }
  });

  // If xpHistory was empty (e.g. fresh hydration or legacy account),
  // infer branch activity from existing tasks, focus sessions, and habits
  const totalTrackedXp = Object.values(branchXp).reduce((a, b) => a + b, 0);
  if (totalTrackedXp === 0) {
    tasks.filter((t) => t.completedAt || t.completed).forEach((t) => {
      const b = (t.category && t.category in branchXp ? t.category : "work") as Branch;
      if (branchXp[b] !== undefined) branchXp[b] += t.xp || 10;
    });
    sessions.forEach((s) => {
      branchXp.focus += Math.round((s.durationMin || 25) / 5) * 5;
    });
    habits.forEach((h) => {
      const b = (h.category && h.category in branchXp ? h.category : "health") as Branch;
      if (branchXp[b] !== undefined) branchXp[b] += (h.history?.length || 0) * 8;
    });
    healthLogs.forEach((l) => {
      if (l.steps > 0 || l.waterMl > 0) branchXp.fitness += 10;
      if (l.mood) branchXp.mental_health += 5;
    });
  }

  // Map other XP into craft
  if (branchXp.other > 0) {
    branchXp.craft += branchXp.other;
  }

  const data = CORE_BRANCHES.map((b) => {
    const meta = BRANCH_META[b];
    const levelInfo = branchLevelFromXp(branchXp[b]);
    const score = levelInfo.level + levelInfo.progress;
    return {
      branch: meta.label,
      level: score > 0 ? score : 0.15, // Small base value so radar polygon is clearly visible
      rawLevel: score,
      fullMark: 10,
    };
  });

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card h-full min-h-[320px] relative overflow-hidden flex flex-col"
    >
      <div className="absolute top-4 left-4 z-10">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Life Balance</p>
        <h2 className="text-xl font-display font-bold mt-1 text-foreground/90">Cross-Life Radar</h2>
      </div>

      <div className="w-full flex-1 min-h-[260px] pt-10">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis 
              dataKey="branch" 
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 500 }}
            />
            <Radar
              name="Progress"
              dataKey="level"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
};
