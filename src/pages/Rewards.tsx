import { motion } from "framer-motion";
import { Trophy, Flame, Target, Zap, Sparkles, Award, Star, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore, getLevel } from "@/lib/store";
import { cn } from "@/lib/utils";

const RewardsPage = () => {
  const { totalXP, tasks, focusSessions, habits, xpHistory } = useAppStore();
  const { level, xpInLevel, xpToNext } = getLevel(totalXP);
  const completed = tasks.filter((t) => t.completed).length;
  const longestStreak = Math.max(0, ...habits.map((h) => {
    const set = new Set(h.history);
    let s = 0; const cur = new Date();
    while (true) { const k = cur.toISOString().slice(0,10); if (set.has(k)) { s++; cur.setDate(cur.getDate()-1); } else break; }
    return s;
  }));

  const achievements = [
    { id: "first-task", icon: Target, label: "First Step", desc: "Complete your first task", unlocked: completed >= 1, tone: "primary" as const },
    { id: "ten-tasks", icon: Award, label: "Decathlon", desc: "Complete 10 tasks", unlocked: completed >= 10, tone: "accent" as const },
    { id: "first-focus", icon: Clock, label: "Deep Diver", desc: "Complete a focus session", unlocked: focusSessions.length >= 1, tone: "primary" as const },
    { id: "five-focus", icon: Sparkles, label: "Focused Five", desc: "5 focus sessions", unlocked: focusSessions.length >= 5, tone: "warning" as const },
    { id: "streak-3", icon: Flame, label: "On Fire", desc: "3-day habit streak", unlocked: longestStreak >= 3, tone: "warning" as const },
    { id: "streak-7", icon: Star, label: "Week Warrior", desc: "7-day habit streak", unlocked: longestStreak >= 7, tone: "success" as const },
    { id: "level-3", icon: Trophy, label: "Climber", desc: "Reach level 3", unlocked: level >= 3, tone: "accent" as const },
    { id: "xp-500", icon: Zap, label: "XP Hunter", desc: "Earn 500 XP", unlocked: totalXP >= 500, tone: "primary" as const },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <AppShell>
      <TopBar eyebrow="Gamification" title="Rewards" subtitle="Glow, badges, and the next unlock." />

      <FadeIn className="glass-card relative overflow-hidden mb-5 p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-warm opacity-30 blur-3xl pointer-events-none" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-primary/80 font-semibold mb-2">Level Progress</p>
            <div className="flex items-baseline gap-3">
              <p className="number-display text-6xl gradient-text">L{level}</p>
              <p className="text-muted-foreground">{xpToNext - xpInLevel} XP to L{level + 1}</p>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden mt-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(xpInLevel / xpToNext) * 100}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-primary rounded-full shadow-glow"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <Chip tone="warning"><Flame className="w-3 h-3" /> {longestStreak}-day streak</Chip>
              <Chip tone="success"><Trophy className="w-3 h-3" /> {unlockedCount}/{achievements.length} unlocked</Chip>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="w-32 h-32 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-elevated animate-pulse-glow"
            >
              <Trophy className="w-16 h-16 text-primary-foreground" />
            </motion.div>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FadeIn delay={0.1} className="glass-card lg:col-span-2">
          <h2 className="text-xl font-display font-bold mb-4">Achievements</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {achievements.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "p-4 rounded-xl border text-center transition-smooth",
                  a.unlocked ? "border-primary/30 bg-primary/5 hover:scale-105" : "border-border/40 opacity-50 grayscale",
                )}
              >
                <div className={cn(
                  "w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2",
                  a.unlocked ? "bg-gradient-primary shadow-glow" : "bg-muted",
                )}>
                  <a.icon className={cn("w-6 h-6", a.unlocked ? "text-primary-foreground" : "text-muted-foreground")} />
                </div>
                <p className="font-semibold text-sm">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.15} className="glass-card">
          <h2 className="text-xl font-display font-bold mb-4">XP History</h2>
          {xpHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Earn XP by completing tasks and focus sessions.</p>
          ) : (
            <ul className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {xpHistory.map((e) => (
                <li key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-smooth">
                  <div className="w-8 h-8 rounded-lg bg-gradient-primary/15 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{e.reason}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">+{e.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </FadeIn>
      </div>
    </AppShell>
  );
};

export default RewardsPage;
