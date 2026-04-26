import { useMemo } from "react";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { TrendingUp, Activity, CheckCircle2 } from "lucide-react";

const InsightsPage = () => {
  const { tasks, focusSessions, habits } = useAppStore();

  const byPriority = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.forEach((t) => counts[t.priority]++);
    return counts;
  }, [tasks]);

  const totalTasks = Math.max(1, tasks.length);

  const last7 = useMemo(() => [...Array(7)].map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const k = format(d, "yyyy-MM-dd");
    const completed = tasks.filter((t) => t.completedAt?.startsWith(k)).length;
    const focusMin = focusSessions.filter((s) => s.completedAt.startsWith(k)).reduce((a, s) => a + s.durationMin, 0);
    return { date: d, label: format(d, "EEE"), completed, focusMin };
  }), [tasks, focusSessions]);

  const maxCompleted = Math.max(...last7.map((d) => d.completed), 1);
  const maxFocus = Math.max(...last7.map((d) => d.focusMin), 1);
  const totalCompleted = tasks.filter((t) => t.completed).length;
  const totalFocusMin = focusSessions.reduce((a, s) => a + s.durationMin, 0);
  const avgConsistency = habits.length === 0 ? 0 : Math.round(habits.reduce((a, h) => {
    const set = new Set(h.history);
    const last7days = [...Array(7)].map((_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"));
    return a + (last7days.filter((d) => set.has(d)).length / 7) * 100;
  }, 0) / habits.length);

  // Donut: build conic-gradient
  const segments = [
    { key: "urgent", color: "hsl(var(--destructive))", value: byPriority.urgent },
    { key: "high", color: "hsl(var(--warning))", value: byPriority.high },
    { key: "medium", color: "hsl(var(--accent))", value: byPriority.medium },
    { key: "low", color: "hsl(var(--muted-foreground))", value: byPriority.low },
  ];
  let acc = 0;
  const stops = segments.map((s) => {
    const start = (acc / totalTasks) * 360;
    acc += s.value;
    const end = (acc / totalTasks) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  });
  const conic = `conic-gradient(${stops.join(", ")})`;

  return (
    <AppShell>
      <TopBar eyebrow="Analytics" title="Insights" subtitle="Patterns from your data." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <StatCard label="Completed tasks" value={totalCompleted} icon={CheckCircle2} tone="success" />
        <StatCard label="Focus minutes" value={totalFocusMin} icon={TrendingUp} tone="primary" suffix="m" />
        <StatCard label="Habit consistency" value={avgConsistency} icon={Activity} tone="accent" suffix="%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FadeIn delay={0.1} className="glass-card lg:col-span-2">
          <h2 className="text-xl font-display font-bold mb-4">Last 7 days</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tasks completed</p>
              <div className="flex items-end gap-2 h-28">
                {last7.map((d, i) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.completed / maxCompleted) * 100}%` }}
                      transition={{ delay: i * 0.05, duration: 0.5 }}
                      className="w-full rounded-t-md bg-gradient-primary min-h-[4px] shadow-glow"
                    />
                    <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Focus minutes</p>
              <div className="flex items-end gap-2 h-20">
                {last7.map((d, i) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.focusMin / maxFocus) * 100}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                      className="w-full rounded-t-md bg-gradient-accent min-h-[4px]"
                    />
                    <span className="text-[10px] text-muted-foreground">{d.focusMin}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15} className="glass-card">
          <h2 className="text-xl font-display font-bold mb-4">By priority</h2>
          <div className="flex justify-center mb-4">
            <div className="relative w-44 h-44">
              <div className="w-full h-full rounded-full" style={{ background: conic }} />
              <div className="absolute inset-6 rounded-full bg-card flex flex-col items-center justify-center">
                <p className="number-display text-3xl">{tasks.length}</p>
                <p className="text-xs text-muted-foreground">total tasks</p>
              </div>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 capitalize">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  {s.key}
                </span>
                <span className="font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </AppShell>
  );
};

const StatCard = ({ label, value, icon: Icon, tone, suffix = "" }: { label: string; value: number; icon: any; tone: "primary" | "success" | "accent"; suffix?: string }) => {
  const toneBg = { primary: "bg-primary/15 text-primary", success: "bg-success/15 text-success", accent: "bg-accent/15 text-accent" }[tone];
  return (
    <FadeIn className="glass-card">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${toneBg}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="number-display text-3xl mt-0.5">{value}{suffix}</p>
        </div>
      </div>
    </FadeIn>
  );
};

export default InsightsPage;
