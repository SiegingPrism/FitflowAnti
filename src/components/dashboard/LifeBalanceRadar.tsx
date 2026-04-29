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

export const LifeBalanceRadar = () => {
  const { xpHistory } = useAppStore();

  // Aggregate XP by branch
  const branchXp: Record<Branch, number> = {
    focus: 0,
    health: 0,
    learning: 0,
    craft: 0,
  };

  xpHistory.forEach((e) => {
    // Map legacy branch names to new core branches if they exist
    let branch = e.branch as string;
    if (branch === "work") branch = "focus";
    if (branch === "fitness" || branch === "mental_health") branch = "health";
    if (branch === "study") branch = "learning";
    if (branch === "other") branch = "craft";

    if (branchXp[branch as Branch] !== undefined) {
      branchXp[branch as Branch] += e.amount;
    }
  });

  const data = (Object.keys(branchXp) as Branch[]).map((b) => {
    const meta = BRANCH_META[b];
    const levelInfo = branchLevelFromXp(branchXp[b]);
    return {
      branch: meta.label,
      level: levelInfo.level + levelInfo.progress, // Fractional level for smooth chart
      fullMark: 10, // Max level for scaling purposes
    };
  });

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card h-[320px] relative overflow-hidden"
    >
      <div className="absolute top-4 left-4 z-10">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Life Balance</p>
        <h2 className="text-xl font-display font-bold mt-1 text-foreground/90">Cross-Life Radar</h2>
      </div>

      <div className="w-full h-full pt-10">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.05)" />
            <PolarAngleAxis 
              dataKey="branch" 
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 500 }}
            />
            <Radar
              name="Progress"
              dataKey="level"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
};
