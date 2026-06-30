import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { levelFromXp } from "@/lib/gamification";
import { Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const PeakHourCard = () => {
  const tasks = useAppStore((s) => s.tasks);
  const sessions = useAppStore((s) => s.focusSessions);
  const hellMode = useAppStore((s) => s.hellMode);

  // Compute peak completion hour from completed tasks + focus sessions
  const buckets = new Array(24).fill(0);
  tasks.filter((t) => t.completedAt).forEach((t) => {
    const h = new Date(t.completedAt!).getHours();
    buckets[h] += 2;
  });
  sessions.forEach((s) => {
    const h = new Date(s.completedAt).getHours();
    buckets[h] += 1;
  });
  const max = Math.max(...buckets, 1);
  const peakHour = buckets.indexOf(Math.max(...buckets));
  const formatHour = (h: number) => {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  };
  const hasData = sessions.length + tasks.filter((t) => t.completedAt).length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-card"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {hellMode ? "Peak Productivity" : "Peak productivity"}
          </p>
          <p className="text-sm text-foreground/80 mt-1">
            {hellMode ? "Your best focus window" : "Your best focus window"}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent inline-flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {hasData ? formatHour(peakHour) : "—"}
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {buckets.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-gradient-to-t from-primary/30 to-primary/70 transition-smooth"
            style={{ height: `${(v / max) * 100 || 4}%`, opacity: i === peakHour && hasData ? 1 : 0.5 }}
            title={`${formatHour(i)}: ${v}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {hasData
          ? `You tend to finish high-value work around ${formatHour(peakHour)}.`
          : "Complete tasks or focus sessions to discover your peak hours."}
      </p>
    </motion.article>
  );
};

export const LevelCard = () => {
  const totalXP = useAppStore((s) => s.totalXP);
  const hellMode = useAppStore((s) => s.hellMode);
  const levelInfo = levelFromXp(totalXP);
  const displayLevel = Math.max(1, levelInfo.level);
  const pct = Math.round(levelInfo.progress * 100);
  const span = levelInfo.xpForNext - levelInfo.xpForCurrent;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card relative overflow-hidden"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-warm opacity-20 blur-2xl pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {hellMode ? "INFERNAL DECENT" : "Level Progress"}
            </p>
            {hellMode ? (
              <p className="text-xs text-red-500 font-bold mt-1 tracking-wider uppercase">DEBT: 6,668 XP UNTIL DEGRADATION</p>
            ) : (
              <p className="number-display text-3xl mt-1">Level {displayLevel}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-warm flex items-center justify-center shadow-elevated">
            <Trophy className="w-5 h-5 text-warning-foreground" />
          </div>
        </div>
        {!hellMode && <p className="text-sm text-muted-foreground mb-3">{levelInfo.xpToNext} XP until level {displayLevel + 1}</p>}
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="h-full bg-gradient-primary rounded-full shadow-glow"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{levelInfo.xpInLevel} XP</span>
          <span>{span} XP</span>
        </div>
      </div>
    </motion.article>
  );
};
