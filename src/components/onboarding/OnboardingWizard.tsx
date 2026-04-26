import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore, type PrimaryGoal, type Habit } from "@/lib/store";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

type StarterHabit = Omit<Habit, "id" | "createdAt" | "history">;

interface GoalDef {
  id: PrimaryGoal;
  emoji: string;
  label: string;
  tagline: string;
}

const GOALS: GoalDef[] = [
  { id: "ship", emoji: "🚀", label: "Ship more", tagline: "Build, write, code, create — finish what you start." },
  { id: "fit", emoji: "💪", label: "Get fit", tagline: "Move daily, hit goals, feel stronger week over week." },
  { id: "learn", emoji: "📚", label: "Learn", tagline: "Read, study, practice — deep focus over time." },
  { id: "recover", emoji: "🌿", label: "Recover", tagline: "Lower the bar, rebuild rhythm, protect your energy." },
];

const STARTER_HABITS: Record<PrimaryGoal, StarterHabit[]> = {
  ship: [
    { name: "Deep work block", emoji: "⚡", color: "primary", targetPerWeek: 5, category: "work" },
    { name: "Plan tomorrow", emoji: "📝", color: "accent", targetPerWeek: 7, category: "work" },
    { name: "Ship one thing", emoji: "🚀", color: "warning", targetPerWeek: 5, category: "work" },
    { name: "Inbox to zero", emoji: "📬", color: "muted", targetPerWeek: 5, category: "work" },
  ],
  fit: [
    { name: "Workout", emoji: "🏋️", color: "primary", targetPerWeek: 4, category: "health" },
    { name: "10k steps", emoji: "🏃", color: "success", targetPerWeek: 7, category: "health" },
    { name: "Drink water", emoji: "💧", color: "accent", targetPerWeek: 7, category: "health" },
    { name: "8h sleep", emoji: "😴", color: "muted", targetPerWeek: 7, category: "health" },
  ],
  learn: [
    { name: "Read 20 min", emoji: "📚", color: "success", targetPerWeek: 5, category: "learning" },
    { name: "Study session", emoji: "🧠", color: "primary", targetPerWeek: 5, category: "learning" },
    { name: "Take notes", emoji: "✍️", color: "accent", targetPerWeek: 5, category: "learning" },
    { name: "Review yesterday", emoji: "🔁", color: "muted", targetPerWeek: 7, category: "learning" },
  ],
  recover: [
    { name: "Meditate", emoji: "🧘", color: "accent", targetPerWeek: 5, category: "health" },
    { name: "Walk outside", emoji: "🚶", color: "success", targetPerWeek: 5, category: "health" },
    { name: "No screen 1h before bed", emoji: "🌙", color: "primary", targetPerWeek: 7, category: "personal" },
    { name: "Journal", emoji: "📓", color: "warning", targetPerWeek: 5, category: "personal" },
  ],
};

const FOCUS_TARGETS = [25, 50, 90] as const;

export const OnboardingWizard = () => {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<PrimaryGoal | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState<number>(50);

  const totalSteps = 5;

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return goal !== null;
    if (step === 3) return picked.length >= 2 && picked.length <= 3;
    if (step === 4) return true;
    return false;
  };

  const next = () => setStep((s) => Math.min(totalSteps - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    if (!goal) return;
    const pool = STARTER_HABITS[goal];
    const starterHabits = pool.filter((h) => picked.includes(h.name));
    completeOnboarding({
      userName: name.trim() || "Friend",
      primaryGoal: goal,
      dailyFocusTargetMin: focus,
      starterHabits,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-gradient-primary" : i < step ? "w-4 bg-primary/60" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="glass-card min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              {step === 0 && <WelcomeStep />}
              {step === 1 && <NameStep name={name} setName={setName} />}
              {step === 2 && <GoalStep goal={goal} setGoal={(g) => { setGoal(g); setPicked([]); }} />}
              {step === 3 && goal && (
                <HabitsStep goal={goal} picked={picked} setPicked={setPicked} />
              )}
              {step === 4 && <FocusStep focus={focus} setFocus={setFocus} />}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={back}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {step < totalSteps - 1 ? (
              <button
                onClick={next}
                disabled={!canNext()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-elevated hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-smooth"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={finish}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-elevated hover:shadow-glow transition-smooth"
              >
                Enter FlowSphere <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Takes under a minute · You can change everything later in Settings.
        </p>
      </div>
    </div>
  );
};

const WelcomeStep = () => (
  <div className="text-center my-auto">
    <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-primary flex items-center justify-center text-4xl shadow-elevated">
      🌐
    </div>
    <h1 className="text-3xl md:text-4xl font-display font-bold mt-6">Welcome to FlowSphere</h1>
    <p className="text-muted-foreground mt-3 max-w-md mx-auto">
      One adaptive surface for tasks, habits, focus, and an AI coach. Earn XP, level up branches, build a life you'd brag about.
    </p>
    <div className="grid grid-cols-3 gap-3 mt-8 max-w-sm mx-auto text-left">
      {[
        { e: "🎯", t: "Capture" },
        { e: "🎮", t: "Game" },
        { e: "🧠", t: "Coach" },
      ].map((b) => (
        <div key={b.t} className="rounded-xl bg-muted/50 p-3 text-center">
          <div className="text-2xl">{b.e}</div>
          <div className="text-xs font-semibold mt-1">{b.t}</div>
        </div>
      ))}
    </div>
  </div>
);

const NameStep = ({ name, setName }: { name: string; setName: (v: string) => void }) => (
  <div className="my-auto">
    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Step 1 of 4</p>
    <h2 className="text-2xl md:text-3xl font-display font-bold mt-1">What should we call you?</h2>
    <p className="text-sm text-muted-foreground mt-2">First name or a handle — whatever the Coach should use.</p>
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="e.g. Alex"
      className="mt-6 w-full px-4 py-3.5 rounded-xl bg-background border border-input text-lg font-display focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
    />
  </div>
);

const GoalStep = ({ goal, setGoal }: { goal: PrimaryGoal | null; setGoal: (g: PrimaryGoal) => void }) => (
  <div>
    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Step 2 of 4</p>
    <h2 className="text-2xl md:text-3xl font-display font-bold mt-1">Pick a primary goal</h2>
    <p className="text-sm text-muted-foreground mt-2">This shapes the starter habits and how the Coach prioritizes.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
      {GOALS.map((g) => {
        const active = goal === g.id;
        return (
          <button
            key={g.id}
            onClick={() => setGoal(g.id)}
            className={`text-left p-4 rounded-2xl border-2 transition-smooth ${
              active
                ? "border-primary bg-primary/5 shadow-elevated"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center text-2xl">
                {g.emoji}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">{g.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{g.tagline}</p>
              </div>
              {active && <Check className="w-5 h-5 text-primary shrink-0" />}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const HabitsStep = ({
  goal,
  picked,
  setPicked,
}: {
  goal: PrimaryGoal;
  picked: string[];
  setPicked: (v: string[]) => void;
}) => {
  const pool = STARTER_HABITS[goal];
  const toggle = (name: string) => {
    if (picked.includes(name)) setPicked(picked.filter((n) => n !== name));
    else if (picked.length < 3) setPicked([...picked, name]);
  };
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Step 3 of 4</p>
      <h2 className="text-2xl md:text-3xl font-display font-bold mt-1">Pick 2–3 starter habits</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Don't overdo it. You can add more anytime. <span className="font-semibold text-foreground">Picked: {picked.length}/3</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
        {pool.map((h) => {
          const active = picked.includes(h.name);
          const disabled = !active && picked.length >= 3;
          return (
            <button
              key={h.name}
              onClick={() => toggle(h.name)}
              disabled={disabled}
              className={`text-left p-3 rounded-xl border-2 transition-smooth flex items-center gap-3 ${
                active
                  ? "border-primary bg-primary/5"
                  : disabled
                    ? "border-border opacity-40 cursor-not-allowed"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center text-xl shrink-0">
                {h.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.targetPerWeek}× / week</p>
              </div>
              {active && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FocusStep = ({ focus, setFocus }: { focus: number; setFocus: (n: number) => void }) => (
  <div className="my-auto">
    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Step 4 of 4</p>
    <h2 className="text-2xl md:text-3xl font-display font-bold mt-1">Daily focus target</h2>
    <p className="text-sm text-muted-foreground mt-2">How many minutes of deep focus per day feel right?</p>
    <div className="grid grid-cols-3 gap-3 mt-6">
      {FOCUS_TARGETS.map((t) => {
        const active = focus === t;
        return (
          <button
            key={t}
            onClick={() => setFocus(t)}
            className={`p-5 rounded-2xl border-2 transition-smooth ${
              active
                ? "border-primary bg-primary/5 shadow-elevated"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <p className={`number-display text-3xl ${active ? "gradient-text" : ""}`}>{t}</p>
            <p className="text-xs text-muted-foreground mt-1">minutes</p>
            <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-semibold">
              {t === 25 ? "Light" : t === 50 ? "Standard" : "Ambitious"}
            </p>
          </button>
        );
      })}
    </div>
    <p className="text-xs text-muted-foreground mt-5 text-center">
      Used to compute your daily productivity score. You can change it anytime.
    </p>
  </div>
);
