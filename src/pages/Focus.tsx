import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Coffee, Brain, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "focus" | "break";
const FOCUS_MIN = 25;
const BREAK_MIN = 5;

const FocusPage = () => {
  const tasks = useAppStore((s) => s.tasks);
  const logFocusSession = useAppStore((s) => s.logFocusSession);
  const focusSessions = useAppStore((s) => s.focusSessions);

  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [completedToday, setCompletedToday] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const openTasks = tasks.filter((t) => !t.completed);
  const total = mode === "focus" ? FOCUS_MIN * 60 : BREAK_MIN * 60;
  const pct = ((total - secondsLeft) / total) * 100;

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setCompletedToday(focusSessions.filter((s) => s.completedAt.startsWith(todayStr)).length);
  }, [focusSessions]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // session complete
          window.clearInterval(intervalRef.current!);
          setRunning(false);
          if (mode === "focus") {
            logFocusSession({ taskId, durationMin: FOCUS_MIN });
            toast.success("Focus session complete! +XP awarded", { description: "Take a 5-min break." });
            setMode("break");
            return BREAK_MIN * 60;
          } else {
            toast("Break over. Ready for another round?");
            setMode("focus");
            return FOCUS_MIN * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [running, mode, taskId, logFocusSession]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(mode === "focus" ? FOCUS_MIN * 60 : BREAK_MIN * 60);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setRunning(false);
    setSecondsLeft(m === "focus" ? FOCUS_MIN * 60 : BREAK_MIN * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // SVG ring
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <AppShell>
      <TopBar eyebrow="Deep Work" title="Focus Mode" subtitle="One task. No distractions." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FadeIn className="glass-card lg:col-span-2 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-primary opacity-20 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center py-6">
            <div className="flex gap-2 mb-6">
              <button onClick={() => switchMode("focus")} className={cn("inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-smooth", mode === "focus" ? "bg-gradient-primary text-primary-foreground shadow-elevated" : "glass text-muted-foreground hover:text-foreground")}>
                <Brain className="w-4 h-4" /> Focus
              </button>
              <button onClick={() => switchMode("break")} className={cn("inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-smooth", mode === "break" ? "bg-gradient-accent text-accent-foreground shadow-elevated" : "glass text-muted-foreground hover:text-foreground")}>
                <Coffee className="w-4 h-4" /> Break
              </button>
            </div>

            <div className="relative w-[260px] h-[260px] flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 240 240">
                <circle cx="120" cy="120" r={radius} stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                <motion.circle
                  cx="120" cy="120" r={radius}
                  stroke="url(#focusGrad)" strokeWidth="10" fill="none" strokeLinecap="round"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
                <defs>
                  <linearGradient id="focusGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--primary-glow))" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="text-center">
                <p className="number-display text-6xl tracking-tighter">{mm}:{ss}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{mode === "focus" ? "Focus block" : "Recovery"}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-8">
              <Button size="lg" onClick={() => setRunning(!running)} className="bg-gradient-primary hover:shadow-glow min-w-32">
                {running ? <><Pause className="w-4 h-4 mr-1" />Pause</> : <><Play className="w-4 h-4 mr-1" />Start</>}
              </Button>
              <Button size="lg" variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" />Reset</Button>
            </div>
          </div>
        </FadeIn>

        <div className="flex flex-col gap-5">
          <FadeIn delay={0.1} className="glass-card">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Focusing on</p>
            <Select value={taskId ?? "none"} onValueChange={(v) => setTaskId(v === "none" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Pick a task" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific task</SelectItem>
                {openTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {taskId && (
              <p className="text-xs text-muted-foreground mt-2">
                Completing this session counts toward this task's progress.
              </p>
            )}
          </FadeIn>

          <FadeIn delay={0.15} className="glass-card">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Today</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="number-display text-4xl">{completedToday}</p>
              <span className="text-sm text-muted-foreground">sessions</span>
            </div>
            <div className="flex gap-1 mt-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={cn("flex-1 h-1.5 rounded-full", i < completedToday ? "bg-gradient-primary" : "bg-muted")} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{Math.max(0, 8 - completedToday)} until daily ideal</p>
          </FadeIn>

          <FadeIn delay={0.2} className="glass-card">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Recent sessions</p>
            {focusSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sessions yet.</p>
            ) : (
              <ul className="space-y-2">
                {focusSessions.slice(0, 5).map((s) => {
                  const t = tasks.find((x) => x.id === s.taskId);
                  return (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      <span className="flex-1 truncate">{t?.title ?? "Untitled focus"}</span>
                      <Chip tone="muted" className="!py-0">{s.durationMin}m</Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </FadeIn>
        </div>
      </div>
    </AppShell>
  );
};

export default FocusPage;
