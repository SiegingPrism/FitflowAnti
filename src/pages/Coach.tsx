import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Wand2,
  AlertTriangle,
  TrendingUp,
  Plus,
  CalendarDays,
  HeartPulse,
  Shield,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { computeBurnout, recoveryMission } from "@/lib/burnout";

interface Insight { title: string; body: string; tone: "positive" | "neutral" | "warning"; }
interface Suggestion { title: string; priority: "low" | "medium" | "high" | "urgent"; durationMin: number; reason: string; }
interface CoachResponse { headline: string; insights: Insight[]; suggestions: Suggestion[]; }

interface PlanTask { title: string; priority: "low" | "medium" | "high" | "urgent"; durationMin: number; category: "work" | "personal" | "health" | "learning" | "other"; }
interface PlanDay { day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; intent: string; tasks: PlanTask[]; }
interface WeeklyPlan { theme: string; rationale: string; days: PlanDay[]; }

const buildSnapshot = (state: ReturnType<typeof useAppStore.getState>) => {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const last7 = [...Array(7)].map((_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"));

  const completionByHour = new Array(24).fill(0);
  state.tasks.filter((t) => t.completedAt).forEach((t) => completionByHour[new Date(t.completedAt!).getHours()]++);

  const habitConsistency = state.habits.map((h) => {
    const set = new Set(h.history);
    return { name: h.name, last7Done: last7.filter((d) => set.has(d)).length, target: h.targetPerWeek };
  });

  const todayHealth = state.healthLogs.find((l) => l.date === todayKey);

  return {
    today: todayKey,
    openTasks: state.tasks.filter((t) => !t.completed).slice(0, 10).map((t) => ({ title: t.title, priority: t.priority, category: t.category, durationMin: t.durationMin })),
    completedLast7Days: state.tasks.filter((t) => t.completedAt && last7.includes(t.completedAt.slice(0, 10))).length,
    peakHourBucket: completionByHour.indexOf(Math.max(...completionByHour)),
    focusMinutesLast7Days: state.focusSessions.filter((s) => last7.includes(s.completedAt.slice(0, 10))).reduce((a, s) => a + s.durationMin, 0),
    habits: habitConsistency,
    health: todayHealth ?? null,
    totalXP: state.totalXP,
  };
};

const buildPlanSnapshot = (state: ReturnType<typeof useAppStore.getState>) => {
  const last14 = [...Array(14)].map((_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"));
  const completionByHour = new Array(24).fill(0);
  state.tasks.filter((t) => t.completedAt).forEach((t) => completionByHour[new Date(t.completedAt!).getHours()]++);
  const peakHours = completionByHour
    .map((c, h) => ({ h, c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map((x) => x.h);

  return {
    primaryGoal: state.primaryGoal,
    dailyFocusTargetMin: state.dailyFocusTargetMin,
    openTasks: state.tasks.filter((t) => !t.completed).map((t) => ({
      title: t.title, priority: t.priority, category: t.category, durationMin: t.durationMin, dueDate: t.dueDate,
    })),
    completedLast14Days: state.tasks
      .filter((t) => t.completedAt && last14.includes(t.completedAt.slice(0, 10)))
      .map((t) => ({ title: t.title, category: t.category, completedAt: t.completedAt })),
    habits: state.habits.map((h) => ({
      name: h.name,
      last14Done: last14.filter((d) => h.history.includes(d)).length,
      target: h.targetPerWeek,
    })),
    focusLast14Days: state.focusSessions
      .filter((s) => last14.includes(s.completedAt.slice(0, 10)))
      .map((s) => ({ durationMin: s.durationMin, completedAt: s.completedAt })),
    healthLast14Days: state.healthLogs.filter((l) => last14.includes(l.date)),
    peakHours,
    totalXP: state.totalXP,
  };
};

const ruleBasedFallback = (state: ReturnType<typeof useAppStore.getState>): CoachResponse => {
  const snap = buildSnapshot(state);
  const peakLabel = snap.peakHourBucket === 0 ? "midnight" : snap.peakHourBucket < 12 ? `${snap.peakHourBucket} AM` : snap.peakHourBucket === 12 ? "noon" : `${snap.peakHourBucket - 12} PM`;
  const insights: Insight[] = [
    { title: `Peak around ${peakLabel}`, body: `Your completions cluster around ${peakLabel}. Schedule deep work then.`, tone: "positive" },
    { title: `${snap.focusMinutesLast7Days} min focused`, body: `You logged ${snap.focusMinutesLast7Days} minutes of focus this week. Aim for 90+ minutes daily.`, tone: snap.focusMinutesLast7Days > 60 ? "positive" : "neutral" },
    ...(snap.openTasks.length > 5 ? [{ title: "Backlog growing", body: `You have ${snap.openTasks.length} open tasks. Consider archiving or completing 3 today.`, tone: "warning" as const }] : []),
  ];
  const suggestions: Suggestion[] = snap.openTasks.slice(0, 3).map((t) => ({
    title: t.title, priority: t.priority, durationMin: t.durationMin, reason: `Pulled from your open queue (${t.category}).`,
  }));
  return { headline: `${snap.completedLast7Days} tasks done this week`, insights, suggestions };
};

const TONE_STYLES = {
  positive: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  neutral: "border-border/40",
} as const;

const CoachPage = () => {
  const state = useAppStore();
  const addTask = useAppStore((s) => s.addTask);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [data, setData] = useState<CoachResponse | null>(() => ruleBasedFallback(state));
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [aiPowered, setAiPowered] = useState(false);

  const burnout = useMemo(
    () => computeBurnout({ healthLogs: state.healthLogs, tasks: state.tasks, xpHistory: state.xpHistory }),
    [state.healthLogs, state.tasks, state.xpHistory],
  );
  const recovery = burnout.risk > 0.6 ? recoveryMission() : [];

  const refreshAI = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-coach", {
        body: { snapshot: buildSnapshot(state) },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
      setAiPowered(true);
      toast.success("Coach updated with fresh AI insights");
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error";
      if (msg.includes("Rate limit")) toast.error("Rate limited — try again in a moment.");
      else if (msg.includes("credits")) toast.error("AI credits exhausted. Add funds in workspace settings.");
      else toast.error("AI unavailable, showing local insights.");
      setData(ruleBasedFallback(state));
      setAiPowered(false);
    } finally { setLoading(false); }
  };

  const generatePlan = async () => {
    setPlanLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-weekly-plan", {
        body: { snapshot: buildPlanSnapshot(state) },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setPlan(result);
      toast.success(`Plan ready: ${result.theme}`);
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error";
      if (msg.includes("Rate limit")) toast.error("Rate limited — try again in a moment.");
      else if (msg.includes("credits")) toast.error("AI credits exhausted.");
      else toast.error("Couldn't generate plan. Try again.");
    } finally { setPlanLoading(false); }
  };

  const acceptDay = (d: PlanDay) => {
    d.tasks.forEach((t) => addTask({
      title: t.title, priority: t.priority, category: t.category, durationMin: t.durationMin,
    }));
    toast.success(`Added ${d.tasks.length} task${d.tasks.length === 1 ? "" : "s"} from ${d.day}`);
  };

  return (
    <AppShell>
      <TopBar eyebrow="Smart Layer" title="AI Coach" subtitle="Suggestions, patterns, and adaptive guidance." />

      <FadeIn className="glass-card relative overflow-hidden mb-5 p-6">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-primary opacity-20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <Chip tone="primary"><Sparkles className="w-3 h-3" /> {aiPowered ? "AI-powered" : "Local heuristics"}</Chip>
            <h2 className="text-2xl md:text-3xl font-display font-bold mt-2">{data?.headline ?? "Loading…"}</h2>
            <p className="text-muted-foreground mt-1 max-w-xl">
              The coach analyzes your tasks, focus, habits, and wellbeing to suggest your next move.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={refreshAI} disabled={loading} className="bg-gradient-primary hover:shadow-glow">
              <Wand2 className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
              {loading ? "Thinking…" : "Get fresh insights"}
            </Button>
            <Button onClick={generatePlan} disabled={planLoading} variant="outline">
              <CalendarDays className={cn("w-4 h-4 mr-1", planLoading && "animate-spin")} />
              {planLoading ? "Planning…" : "Generate weekly plan"}
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Burnout watch */}
      <FadeIn delay={0.05} className={cn(
        "mb-5 rounded-2xl border p-5 transition-smooth",
        burnout.level === "high" ? "border-warning/50 bg-warning/10" :
        burnout.level === "moderate" ? "border-accent/40 bg-accent/5" :
        "border-success/30 bg-success/5",
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            burnout.level === "high" ? "bg-warning/20 text-warning" :
            burnout.level === "moderate" ? "bg-accent/20 text-accent" :
            "bg-success/20 text-success",
          )}>
            {burnout.level === "high" ? <HeartPulse className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Burnout watch</p>
              <Chip tone={burnout.level === "high" ? "warning" : burnout.level === "moderate" ? "accent" : "success"}>
                {(burnout.risk * 100).toFixed(0)}% · {burnout.level}
              </Chip>
            </div>
            <p className="font-display font-semibold mt-1">
              {burnout.level === "high"
                ? "Time to dial it back. A Recovery Mission is ready."
                : burnout.level === "moderate"
                  ? "A few warning signs — pace yourself."
                  : "Signals look healthy. Keep going."}
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-0.5">
              {burnout.reasons.map((r, i) => <li key={i}>· {r}</li>)}
            </ul>

            {recovery.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                {recovery.map((t, i) => (
                  <div key={i} className="rounded-xl border border-warning/30 bg-card/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{t.title}</p>
                      <Chip tone="warning">2× XP</Chip>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.reason}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => {
                        addTask({
                          title: t.title,
                          priority: t.priority,
                          category: "health",
                          durationMin: t.durationMin,
                          xp: 5 * t.xpMultiplier,
                        });
                        toast.success("Recovery task added");
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FadeIn delay={0.1} className="glass-card lg:col-span-2">
          <h2 className="text-xl font-display font-bold mb-4">Insights</h2>
          {!data || data.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No insights yet.</p>
          ) : (
            <div className="space-y-3">
              {data.insights.map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={cn("p-4 rounded-xl border", TONE_STYLES[insight.tone])}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      insight.tone === "warning" ? "bg-warning/20 text-warning" :
                      insight.tone === "positive" ? "bg-success/20 text-success" :
                      "bg-primary/20 text-primary",
                    )}>
                      {insight.tone === "warning" ? <AlertTriangle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold">{insight.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{insight.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </FadeIn>

        <FadeIn delay={0.15} className="glass-card">
          <h2 className="text-xl font-display font-bold mb-4">Suggested next</h2>
          {!data || data.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No suggestions.</p>
          ) : (
            <div className="space-y-3">
              {data.suggestions.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-smooth"
                >
                  <p className="font-semibold text-sm">{s.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Chip tone={s.priority === "urgent" ? "destructive" : s.priority === "high" ? "warning" : s.priority === "medium" ? "accent" : "muted"}>{s.priority}</Chip>
                    <span className="text-xs text-muted-foreground">{s.durationMin}m</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">{s.reason}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => { addTask({ title: s.title, priority: s.priority, category: "other", durationMin: s.durationMin }); toast.success("Added to tasks"); }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add to tasks
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </FadeIn>
      </div>

      {plan && (
        <FadeIn delay={0.2} className="glass-card mt-5">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <Chip tone="primary"><CalendarDays className="w-3 h-3" /> Weekly plan</Chip>
              <h2 className="text-2xl font-display font-bold mt-2">{plan.theme}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{plan.rationale}</p>
            </div>
            <Button variant="outline" size="sm" onClick={generatePlan} disabled={planLoading}>
              <Wand2 className={cn("w-4 h-4 mr-1", planLoading && "animate-spin")} /> Regenerate
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {plan.days.map((d, i) => (
              <motion.div
                key={d.day}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-border/40 p-3 bg-card/60 flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold">{d.day}</p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {d.tasks.length} task{d.tasks.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic">{d.intent}</p>
                <div className="space-y-1.5 mt-3 flex-1">
                  {d.tasks.map((t, j) => (
                    <div key={j} className="text-xs p-2 rounded-lg bg-muted/40">
                      <p className="font-semibold leading-tight">{t.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Chip tone={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "warning" : t.priority === "medium" ? "accent" : "muted"}>
                          {t.priority}
                        </Chip>
                        <span className="text-[10px] text-muted-foreground">{t.durationMin}m</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-3 w-full text-xs" onClick={() => acceptDay(d)}>
                  <Plus className="w-3 h-3 mr-1" /> Add to tasks
                </Button>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      )}
    </AppShell>
  );
};

export default CoachPage;
