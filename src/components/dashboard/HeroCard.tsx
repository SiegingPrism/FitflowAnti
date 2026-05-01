import { getISTDate, getISTTodayStr } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppStore, getLevel } from "@/lib/store";
import { format } from "date-fns";

const greeting = () => {
  const h = getISTDate().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night flow";
};

const productivityState = (rate: number) => {
  if (rate >= 80) return { label: "On fire", tone: "warm" as const };
  if (rate >= 50) return { label: "Steady", tone: "primary" as const };
  if (rate >= 20) return { label: "Warming up", tone: "accent" as const };
  return { label: "Just begun", tone: "muted" as const };
};

const getEmotionalFeedback = (completed: number, total: number) => {
  if (total === 0) return "A quiet day ahead. Consider adding a small habit to build momentum.";
  if (completed === 0) {
    if (getISTDate().getHours() > 17) return "You're slipping today. Just do 1 simple task right now to get the ball rolling.";
    return "Ready to make progress? Start with just one task.";
  }
  const rate = completed / total;
  if (rate === 1) return "Incredible work! You've cleared your plate for today. Take a breather.";
  if (rate >= 0.7) return "You're on fire! 🔥 Push yourself for one more task to maximize your streak.";
  if (rate <= 0.3 && getISTDate().getHours() > 16) return "Pace is a bit slow today. Knock out a quick task to stay on track.";
  return `You've completed ${completed} of ${total} tasks today. Keep the momentum.`;
};

export const HeroCard = () => {
  const { tasks, focusSessions, totalXP, userName } = useAppStore();
  const todayStr = getISTTodayStr();
  const todays = tasks.filter((t) => (t.dueDate ?? "").startsWith(todayStr) || !t.dueDate);
  const completed = todays.filter((t) => t.completed).length;
  const total = Math.max(todays.length, 1);
  const completionRate = Math.round((completed / total) * 100);
  const focusToday = focusSessions
    .filter((s) => s.completedAt.startsWith(todayStr))
    .reduce((acc, s) => acc + s.durationMin, 0);
  const score = Math.min(99, Math.round(completionRate * 0.6 + Math.min(focusToday, 120) * 0.3 + Math.min(totalXP, 200) * 0.05));
  const state = productivityState(completionRate);
  const { level, xpInLevel, xpToNext } = getLevel(totalXP);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="glass-card relative overflow-hidden p-6 md:p-8 lg:col-span-2"
    >
      {/* Local theme-aware glow accents — driven entirely by primary token */}
      <div
        aria-hidden
        className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full pointer-events-none blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.18) 40%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -top-24 -left-16 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--accent) / 0.45) 0%, transparent 70%)",
        }}
      />
      {/* Thin orbital ring echo */}
      <div className="absolute -bottom-48 -right-40 w-[32rem] h-[32rem] rounded-full border border-primary/15 pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> FlowSphere
          </p>
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-balance">
            <span className="gradient-text">{greeting().split(" ")[0]}</span>{" "}
            {greeting().split(" ").slice(1).join(" ")},
            <br />
            {userName}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md">
            {getEmotionalFeedback(completed, total)}
          </p>
          <div className="flex items-center gap-3 mt-5">
            <Link
              to="/focus"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-elevated hover:shadow-glow transition-smooth"
            >
              Start focus
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-smooth" />
            </Link>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${state.tone === "warm" ? "warning" : state.tone}/15 text-${state.tone === "warm" ? "warning" : state.tone === "muted" ? "muted-foreground" : state.tone}`}>
              {state.label}
            </span>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 pt-5 border-t border-border/40">
          <Stat label="Score" value={score.toString()} sub={`${completionRate}% done`} />
          <Stat label="Focus" value={`${focusToday}m`} sub="today" />
          <Stat label="XP" value={totalXP.toString()} sub={`${xpInLevel}/${xpToNext} → L${level + 1}`} />
        </div>
      </div>
    </motion.section>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
    <p className="number-display text-2xl md:text-3xl">{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
  </div>
);
