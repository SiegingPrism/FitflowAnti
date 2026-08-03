import { getISTTodayStr } from "@/lib/utils";
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
  Network,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn, getPastDays } from "@/lib/utils";
import { computeBurnout, recoveryMission } from "@/lib/burnout";
import { useAuth } from "@/contexts/AuthContext";
import { getGeminiApiKey } from "@/lib/gemini-client";

interface Insight { title: string; body: string; tone: "positive" | "neutral" | "warning"; }
interface Suggestion { title: string; priority: "low" | "medium" | "high" | "urgent"; durationMin: number; reason: string; }
interface CoachResponse { headline: string; insights: Insight[]; suggestions: Suggestion[]; }

interface PlanTask { title: string; priority: "low" | "medium" | "high" | "urgent"; durationMin: number; category: "work" | "personal" | "health" | "learning" | "other"; }
interface PlanDay { day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; intent: string; tasks: PlanTask[]; }
interface WeeklyPlan { theme: string; rationale: string; days: PlanDay[]; }

const buildSnapshot = (state: ReturnType<typeof useAppStore.getState>) => {
  const todayKey = getISTTodayStr();
  const last7 = getPastDays(7);

  const completionByHour = new Array(24).fill(0);
  state.tasks.filter((t) => t.completedAt).forEach((t) => completionByHour[new Date(t.completedAt!).getHours()]++);

  const habitConsistency = state.habits.map((h) => {
    const set = new Set(h.history);
    return { name: h.name, last7Done: last7.filter((d) => set.has(d)).length, target: h.targetPerWeek };
  });

  const todayHealth = state.healthLogs.find((l) => l.date === todayKey);

  return {
    primaryGoals: state.primaryGoals,
    today: todayKey,
    userName: state.userName,
    hellMode: state.hellMode,
    dailyFocusTargetMin: state.dailyFocusTargetMin,
    totalXP: state.totalXP,
    // Send all raw data
    tasks: state.tasks,
    habits: state.habits,
    focusSessions: state.focusSessions,
    healthLogs: state.healthLogs,
    xpHistory: state.xpHistory,
    // Helper/backwards-compatible computed fields:
    openTasks: state.tasks.filter((t) => !t.completed).slice(0, 10).map((t) => ({ title: t.title, priority: t.priority, category: t.category, durationMin: t.durationMin })),
    completedLast7Days: state.tasks.filter((t) => t.completedAt && last7.includes(t.completedAt.slice(0, 10))).length,
    peakHourBucket: completionByHour.indexOf(Math.max(...completionByHour)),
    focusMinutesLast7Days: state.focusSessions.filter((s) => last7.includes(s.completedAt.slice(0, 10))).reduce((a, s) => a + s.durationMin, 0),
    habitsConsistency: habitConsistency,
    health: todayHealth ?? null,
  };
};

const buildPlanSnapshot = (state: ReturnType<typeof useAppStore.getState>) => {
  const last14 = getPastDays(14);
  const completionByHour = new Array(24).fill(0);
  state.tasks.filter((t) => t.completedAt).forEach((t) => completionByHour[new Date(t.completedAt!).getHours()]++);
  const peakHours = completionByHour
    .map((c, h) => ({ h, c }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map((x) => x.h);

  return {
    primaryGoals: state.primaryGoals,
    dailyFocusTargetMin: state.dailyFocusTargetMin,
    totalXP: state.totalXP,
    userName: state.userName,
    hellMode: state.hellMode,
    // Send all raw data
    tasks: state.tasks,
    habits: state.habits,
    focusSessions: state.focusSessions,
    healthLogs: state.healthLogs,
    xpHistory: state.xpHistory,
    // Helper/backwards-compatible computed fields:
    openTasks: state.tasks.filter((t) => !t.completed).map((t) => ({
      title: t.title, priority: t.priority, category: t.category, durationMin: t.durationMin, dueDate: t.dueDate,
    })),
    completedLast14Days: state.tasks
      .filter((t) => t.completedAt && last14.includes(t.completedAt.slice(0, 10)))
      .map((t) => ({ title: t.title, category: t.category, completedAt: t.completedAt })),
    habitsConsistency: state.habits.map((h) => ({
      name: h.name,
      last14Done: last14.filter((d) => h.history.includes(d)).length,
      target: h.targetPerWeek,
    })),
    focusLast14Days: state.focusSessions
      .filter((s) => last14.includes(s.completedAt.slice(0, 10)))
      .map((s) => ({ durationMin: s.durationMin, completedAt: s.completedAt })),
    healthLast14Days: state.healthLogs.filter((l) => last14.includes(l.date)),
    peakHours,
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
  const hellMode = useAppStore((s) => s.hellMode);
  const toggleHellMode = useAppStore((s) => s.toggleHellMode);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [data, setData] = useState<CoachResponse | null>(() => ruleBasedFallback(state));
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [aiPowered, setAiPowered] = useState(false);
  const { user } = useAuth();
  const isDeveloper = user?.email === "dev@fitflow.app" || user?.email === "ishanibassin@gmail.com";

  const burnout = useMemo(
    () => computeBurnout({ healthLogs: state.healthLogs, tasks: state.tasks, xpHistory: state.xpHistory }),
    [state.healthLogs, state.tasks, state.xpHistory],
  );
  const recovery = burnout.risk > 0.6 ? recoveryMission() : [];

  const refreshAI = async () => {
    setLoading(true);
    try {
      const GEMINI_API_KEY = getGeminiApiKey();
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      const SYSTEM_PROMPT = `You are FlowSphere's AI Coach — a warm, sharp productivity coach.
Given a snapshot of the user's recent tasks, habits, focus sessions, wellbeing logs, and their primary focus goals,
return short, specific, actionable insights and 3 suggested next tasks.
Crucially, you must focus your advice and task suggestions STRICTLY on the user's selected primary goals (provided as \`primaryGoals\` in the snapshot).
Be concrete: reference actual data points (hours, counts, streaks). Avoid platitudes.

IMPORTANT: You must STRICTLY restrict your insights and task suggestions to the user's selected focus modes.
If asked or considering an unselected mode, politely remind the user of their current focus areas in the insights. Do not generate tasks for unselected modes.
If the user's snapshot has NO \`primaryGoals\` selected or the array is empty, politely inform them in the headline/insights that they need to select their focus modes in the settings to receive tailored advice, and provide general productivity advice in the meantime based ONLY on the predefined modes below.

The focus modes are:
- "fit" (Fitness/Workout Context): Generate weekly workout splits, provide specific exercise recommendations based on available equipment, and suggest optimal rest days.
- "learn" (Study Context): Act as a tutor/focus coach. Analyze in-app activity data (e.g., completion times) to suggest optimal study blocks. Recommend focus techniques (Pomodoro, Blurting) and specific instrumental playlists/frequencies.
- "recover" (Recovery Context): Suggest active recovery protocols, sleep hygiene tips, stretching routines, and mindfulness exercises tailored to recent task loads.
- "ship" (Career/Deep Work): Focus on time-blocking, email management strategies, networking tips, and preventing burnout.`;

      const userPrompt = `User snapshot:\n${JSON.stringify(buildSnapshot(state), null, 2)}\n\nGenerate insights and suggestions now.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                headline: { type: "STRING", description: "One-line summary of the user's current state." },
                insights: {
                  type: "ARRAY",
                  description: "3-5 short insights tied to data points.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING" },
                      body: { type: "STRING" },
                      tone: { type: "STRING", enum: ["positive", "neutral", "warning"] },
                    },
                    required: ["title", "body", "tone"]
                  },
                },
                suggestions: {
                  type: "ARRAY",
                  description: "3 concrete suggested tasks.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING" },
                      priority: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
                      durationMin: { type: "NUMBER" },
                      reason: { type: "STRING" },
                    },
                    required: ["title", "priority", "durationMin", "reason"]
                  },
                },
              },
              required: ["headline", "insights", "suggestions"],
            }
          }
        })
      });

      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI model");

      setData(JSON.parse(text));
      setAiPowered(true);
      toast.success("Coach updated with fresh AI insights");
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Unknown error";
      if (msg.includes("GEMINI_API_KEY")) toast.error("Please add GEMINI_API_KEY to your environment.");
      else toast.error("AI unavailable, showing local insights.");
      console.error("refreshAI error:", e);
      setData(ruleBasedFallback(state));
      setAiPowered(false);
    } finally { setLoading(false); }
  };

  const generatePlan = async () => {
    setPlanLoading(true);
    try {
      const GEMINI_API_KEY = getGeminiApiKey();
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      const SYSTEM_PROMPT = `You are FlowSphere's AI Coach planning a focused week.
Given the last 14 days of the user's tasks, habits, focus sessions, and wellbeing, and their primary focus goals,
return a Mon→Sun plan with a clear theme and 1–3 focus tasks per day.
Crucially, you must focus the plan and tasks STRICTLY on the user's selected primary goals.
Respect peak hours, protect a recovery slot, and keep load realistic — never more than 3 tasks/day.
Be concrete: tie tasks to actual data points (open tasks, lagging habits, focus debt).

IMPORTANT: You must STRICTLY restrict your weekly plan theme, rationale, and tasks to the user's selected focus modes (provided as \`primaryGoals\` in the snapshot).
Do not generate tasks or plans for unselected modes.
If the user's snapshot has NO \`primaryGoals\` selected or the array is empty, politely inform them in the rationale that they need to select their focus modes in the settings to receive tailored advice, and provide a general balanced plan based ONLY on the predefined modes below.

The focus modes are:
- "fit" (Fitness/Workout Context): Generate weekly workout splits, provide specific exercise recommendations based on available equipment, and suggest optimal rest days.
- "learn" (Study Context): Act as a tutor/focus coach. Analyze in-app activity data (e.g., peak hours) to suggest optimal study blocks. Recommend focus techniques (Pomodoro, Blurting) and specific instrumental playlists/frequencies.
- "recover" (Recovery Context): Suggest active recovery protocols, sleep hygiene tips, stretching routines, and mindfulness exercises tailored to recent task loads.
- "ship" (Career/Deep Work): Focus on time-blocking, email management strategies, networking tips, and preventing burnout.`;

      const userPrompt = `User snapshot (last 14 days):\n${JSON.stringify(buildPlanSnapshot(state), null, 2)}\n\nGenerate the weekly plan now.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                theme: { type: "STRING", description: "Short theme for the week (≤ 60 chars)." },
                rationale: { type: "STRING", description: "Why this theme — reference data." },
                days: {
                  type: "ARRAY",
                  description: "Exactly 7 days, Monday through Sunday in order.",
                  items: {
                    type: "OBJECT",
                    properties: {
                      day: { type: "STRING", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
                      intent: { type: "STRING", description: "One-line intent for this day." },
                      tasks: {
                        type: "ARRAY",
                        description: "1–3 focus tasks for this day.",
                        items: {
                          type: "OBJECT",
                          properties: {
                            title: { type: "STRING" },
                            priority: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
                            durationMin: { type: "NUMBER" },
                            category: { type: "STRING", enum: ["work", "personal", "health", "learning", "other"] },
                          },
                          required: ["title", "priority", "durationMin", "category"]
                        },
                      },
                    },
                    required: ["day", "intent", "tasks"]
                  },
                },
              },
              required: ["theme", "rationale", "days"],
            }
          }
        })
      });

      if (!response.ok) throw new Error(`Gemini API returned status ${response.status}`);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI model");

      setPlan(JSON.parse(text));
      toast.success(`Plan ready: ${JSON.parse(text).theme}`);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Unknown error";
      if (msg.includes("GEMINI_API_KEY")) toast.error("Please add GEMINI_API_KEY to your environment.");
      else toast.error("Couldn't generate plan. Try again.");
      console.error("generatePlan error:", e);
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
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 mt-4 md:mt-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Model</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-background/40 backdrop-blur-md border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium min-w-[200px]"
              >
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ultra Fast)</option>
                <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash (Latest)</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-auto">
              <Button onClick={() => refreshAI()} disabled={loading} className="bg-gradient-primary hover:shadow-glow">
                <Wand2 className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
                {loading ? "Thinking…" : "Get fresh insights"}
              </Button>
              <Button onClick={() => generatePlan()} disabled={planLoading} variant="outline">
                <CalendarDays className={cn("w-4 h-4 mr-1", planLoading && "animate-spin")} />
                {planLoading ? "Planning…" : "Generate weekly plan"}
              </Button>
              <Button
                onClick={async () => {
                  setLoading(true);
                  setPlanLoading(true);
                  toast.info("Invoking multi-agent pipeline (Insights & Planner)...");
                  try {
                    await Promise.all([
                      refreshAI().catch(e => {
                        console.error("Insights agent error:", e);
                        throw e;
                      }),
                      generatePlan().catch(e => {
                        console.error("Planner agent error:", e);
                        throw e;
                      })
                    ]);
                    toast.success("Multi-agent optimization complete");
                  } catch (err) {
                    toast.error("Multi-agent execution encountered issues");
                  } finally {
                    setLoading(false);
                    setPlanLoading(false);
                  }
                }}
                disabled={loading || planLoading}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow"
              >
                <Network className={cn("w-4 h-4 mr-1.5", (loading || planLoading) && "animate-spin")} />
                {loading || planLoading ? "Running Agents..." : "Multi-Agent Run"}
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>

      {isDeveloper && (
        <FadeIn delay={0.02} className="glass-card mb-5 border-red-500/50 bg-red-950/30 relative overflow-hidden ring-1 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl filter drop-shadow-md">🔥</span>
                <p className="text-xs uppercase tracking-widest text-red-400 font-bold drop-shadow-sm">Hell Mode (Developer Preview)</p>
              </div>
              <h3 className="text-xl font-display font-bold mt-2 text-red-100 drop-shadow-sm">The Drill Sergeant</h3>
              <p className="text-sm mt-1 max-w-xl text-red-200/80 leading-relaxed">
                "Attention, recruit! You're slacking. Complete 3 tasks in the next hour or lose 50 XP. Move it!"
              </p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-red-500 mt-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Blueprint complete. Core AI integration pending.
              </p>
            </div>
            <Button 
              className={cn(
                "border transition-smooth shadow-[0_0_15px_rgba(239,68,68,0.15)] font-semibold whitespace-nowrap",
                hellMode 
                  ? "bg-red-500 text-white border-red-400 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]" 
                  : "bg-red-950/80 text-red-400 border-red-500/50 hover:bg-red-900 hover:border-red-400"
              )}
              onClick={() => {
                toggleHellMode();
                toast(hellMode ? "Hell Mode Deactivated." : "Hell Mode Activated! Prepare to suffer.", { icon: "🔥" });
              }}
            >
              {hellMode ? "Deactivate Hell Mode" : "Engage Hell Mode"}
            </Button>
          </div>
        </FadeIn>
      )}

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
