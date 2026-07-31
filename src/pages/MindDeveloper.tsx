import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { FadeIn, Chip } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { getGeminiApiKey } from "@/lib/gemini-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Brain,
  Timer,
  Calculator,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Moon,
  Dumbbell,
  GlassWater,
  Sun,
  FileText,
  HelpCircle,
  RefreshCw,
  Flame,
  BookOpen,
  Send,
  Sparkles,
  Info,
  ChevronRight,
  TrendingUp,
  GraduationCap
} from "lucide-react";

// List of words for memorization game
const WORD_POOL = [
  "algorithm", "entropy", "gradient", "heuristic", "paradigm",
  "recursion", "synthesis", "quantum", "cognitive", "dendrite",
  "synapse", "matrix", "vector", "compiler", "asymptotic",
  "stochastic", "bayesian", "refactoring", "determinism", "empirical",
  "neuromorphic", "durable", "attention", "transformer", "weights",
  "topology", "probabilistic", "inference", "tensor", "concurrency"
];

// Creative prompts
const CREATIVE_PROMPTS = [
  "Think of 20 alternative uses for a paperclip.",
  "What if YouTube had no recommendations? Design the flow and layout.",
  "How would you design a search engine that has no links, only synthesized logic?",
  "Reverse engineer Spotify's offline sync protocol from first principles.",
  "Design a better, non-distracting version of an email inbox.",
  "What if standard keyboards had no backspace key? How would writing software change?",
  "How would you build a search-by-whistling music finder without any deep learning?",
  "Design a device that helps people sleep by altering ambient light based on breathing."
];

interface ChecklistState {
  read: boolean;
  write: boolean;
  solve: boolean;
  hardSkill: boolean;
  breath: boolean;
  noLazy: boolean;
  sleep: boolean;
  exercise: boolean;
  protein: boolean;
  sunlight: boolean;
  logicProblem: boolean;
  chessTactics: boolean;
  weeklyEssay: boolean;
  buildNoTutorial: boolean;
  teachOthers: boolean;
}

export default function MindDeveloper() {
  const { user } = useAuth();
  const { grantDebugXp, selectedModel, mindDevMode, setMindDevMode, syncMindDevTasksAndHabits } = useAppStore();

  // Load and save state locally for the developer
  const [activeMonth, setActiveMonth] = useState<1 | 2 | 3>(() => {
    return Number(localStorage.getItem("mind-dev-active-month") || "1") as 1 | 2 | 3;
  });

  // Automatically sync tasks and habits when month or active state changes
  useEffect(() => {
    if (mindDevMode) {
      syncMindDevTasksAndHabits(activeMonth);
    }
  }, [activeMonth, mindDevMode, syncMindDevTasksAndHabits]);

  const [aiProvider, setAiProvider] = useState<"gemini" | "chatgpt">(() => {
    return (localStorage.getItem("mind-dev-ai-provider") || "gemini") as "gemini" | "chatgpt";
  });

  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    return localStorage.getItem("mind-dev-openai-key") || "";
  });

  const [checklist, setChecklist] = useState<ChecklistState>(() => {
    const saved = localStorage.getItem("mind-dev-checklist-today");
    if (saved) {
      try { return JSON.parse(saved); } catch (_) { /* ignore parse errors */ }
    }
    return {
      read: false,
      write: false,
      solve: false,
      hardSkill: false,
      breath: false,
      noLazy: false,
      sleep: false,
      exercise: false,
      protein: false,
      sunlight: false,
      logicProblem: false,
      chessTactics: false,
      weeklyEssay: false,
      buildNoTutorial: false,
      teachOthers: false,
    };
  });

  // Save checklist & options
  useEffect(() => {
    localStorage.setItem("mind-dev-checklist-today", JSON.stringify(checklist));
  }, [checklist]);

  useEffect(() => {
    localStorage.setItem("mind-dev-active-month", activeMonth.toString());
  }, [activeMonth]);

  useEffect(() => {
    localStorage.setItem("mind-dev-ai-provider", aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    localStorage.setItem("mind-dev-openai-key", openaiApiKey);
  }, [openaiApiKey]);

  // Handle date reset
  useEffect(() => {
    const lastCheckDate = localStorage.getItem("mind-dev-last-check-date");
    const todayStr = new Date().toDateString();
    if (lastCheckDate !== todayStr) {
      localStorage.setItem("mind-dev-last-check-date", todayStr);
      setChecklist({
        read: false,
        write: false,
        solve: false,
        hardSkill: false,
        breath: false,
        noLazy: false,
        sleep: false,
        exercise: false,
        protein: false,
        sunlight: false,
        logicProblem: false,
        chessTactics: false,
        weeklyEssay: false,
        buildNoTutorial: false,
        teachOthers: false,
      });
    }
  }, []);

  // Shared AI call helper
  const callAI = async (systemPrompt: string, userPrompt: string) => {
    if (aiProvider === "gemini") {
      const apiKey = getGeminiApiKey();
      if (!apiKey) throw new Error("Gemini API key is not configured.");
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }]
        })
      });
      if (!response.ok) throw new Error(`Gemini status ${response.status}`);
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No feedback received.";
    } else {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || openaiApiKey;
      if (!apiKey) throw new Error("OpenAI API key is not configured. Please enter your API key in the AI Engine Config panel.");
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7
        })
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `OpenAI status ${response.status}`);
      }
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || "No feedback received.";
    }
  };

  // 1. Focus Timer
  const [focusTimeLeft, setFocusTimeLeft] = useState<number | null>(null);
  const [focusActive, setFocusActive] = useState(false);
  const focusTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startFocusTimer = (minutes: number) => {
    if (focusTimerRef.current) clearInterval(focusTimerRef.current);
    setFocusTimeLeft(minutes * 60);
    setFocusActive(true);
    toast.success(`Deep work block started for ${minutes} mins! Keep phone outside!`, { icon: "⏱️" });
  };

  const stopFocusTimer = () => {
    if (focusTimerRef.current) clearInterval(focusTimerRef.current);
    setFocusActive(false);
    setFocusTimeLeft(null);
  };

  useEffect(() => {
    if (focusActive && focusTimeLeft !== null) {
      if (focusTimeLeft <= 0) {
        setFocusActive(false);
        setFocusTimeLeft(null);
        grantDebugXp(200, "Completed Mind Dev Deep Focus Block");
        toast.success("Incredible! You completed a Deep Focus Block (+200 XP)!", { icon: "🔥" });
        if (focusTimerRef.current) clearInterval(focusTimerRef.current);
      } else {
        focusTimerRef.current = setTimeout(() => {
          setFocusTimeLeft((prev) => (prev !== null ? prev - 1 : null));
        }, 1000);
      }
    }
    return () => {
      if (focusTimerRef.current) clearInterval(focusTimerRef.current);
    };
  }, [focusActive, focusTimeLeft, grantDebugXp]);

  // Format focus time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // 2. Concentration Breath Timer
  const [breathTimeLeft, setBreathTimeLeft] = useState<number | null>(null);
  const [breathActive, setBreathActive] = useState(false);
  const breathTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startBreathTimer = (minutes: number) => {
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    setBreathTimeLeft(minutes * 60);
    setBreathActive(true);
    toast.info(`Breath concentration block of ${minutes}m started. Focus only on breathing.`, { icon: "🫁" });
  };

  useEffect(() => {
    if (breathActive && breathTimeLeft !== null) {
      if (breathTimeLeft <= 0) {
        setBreathActive(false);
        setBreathTimeLeft(null);
        grantDebugXp(100, "Completed Concentration Habit");
        setChecklist(prev => ({ ...prev, breath: true }));
        toast.success("Concentration session complete (+100 XP)!", { icon: "🧘" });
      } else {
        breathTimerRef.current = setTimeout(() => {
          setBreathTimeLeft((prev) => (prev !== null ? prev - 1 : null));
        }, 1000);
      }
    }
    return () => {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, [breathActive, breathTimeLeft, grantDebugXp]);

  // 3. Working Memory: Mental Math Mini-Game
  const [mathActive, setMathActive] = useState(false);
  const [mathQuestion, setMathQuestion] = useState("");
  const [mathAnswer, setMathAnswer] = useState("");
  const [mathCorrectAnswer, setMathCorrectAnswer] = useState<number | null>(null);
  const [mathStreak, setMathStreak] = useState(0);

  const generateMathQuestion = () => {
    const type = Math.floor(Math.random() * 3); // 0: add/sub, 1: mul, 2: three-term
    let question = "";
    let ans = 0;

    if (type === 0) {
      const a = Math.floor(Math.random() * 180) + 20;
      const b = Math.floor(Math.random() * 180) + 20;
      const sub = Math.random() > 0.5;
      question = sub ? `${a} - ${b}` : `${a} + ${b}`;
      ans = sub ? a - b : a + b;
    } else if (type === 1) {
      const a = Math.floor(Math.random() * 16) + 4;
      const b = Math.floor(Math.random() * 15) + 6;
      question = `${a} * ${b}`;
      ans = a * b;
    } else {
      const a = Math.floor(Math.random() * 80) + 10;
      const b = Math.floor(Math.random() * 80) + 10;
      const c = Math.floor(Math.random() * 40) + 5;
      question = `${a} + ${b} - ${c}`;
      ans = a + b - c;
    }

    setMathQuestion(question);
    setMathCorrectAnswer(ans);
    setMathAnswer("");
  };

  const startMathGame = () => {
    setMathActive(true);
    setMathStreak(0);
    generateMathQuestion();
  };

  const checkMathAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (mathCorrectAnswer === null) return;
    const parsed = parseInt(mathAnswer.trim());
    if (parsed === mathCorrectAnswer) {
      const newStreak = mathStreak + 1;
      setMathStreak(newStreak);
      toast.success(`Correct! Streak: ${newStreak}`, { duration: 1000 });
      if (newStreak % 5 === 0) {
        grantDebugXp(25, `Mental Math 5x streak`);
        toast.success("Streak reward (+25 XP)!");
      }
      generateMathQuestion();
    } else {
      toast.error(`Incorrect. Correct answer was ${mathCorrectAnswer}. Streak reset.`);
      setMathStreak(0);
      generateMathQuestion();
    }
  };

  // 4. Working Memory: Word Memorization Game
  const [memoState, setMemoState] = useState<"idle" | "memorize" | "recall" | "result">("idle");
  const [memoWords, setMemoWords] = useState<string[]>([]);
  const [memoCountdown, setMemoCountdown] = useState(30);
  const [memoInput, setMemoInput] = useState("");
  const [memoCorrectList, setMemoCorrectList] = useState<string[]>([]);
  const [memoIncorrectList, setMemoIncorrectList] = useState<string[]>([]);
  const memoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startMemoGame = () => {
    // Select 20 random words
    const shuffled = [...WORD_POOL].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 20);
    setMemoWords(selected);
    setMemoState("memorize");
    setMemoCountdown(30);
    setMemoInput("");

    if (memoTimerRef.current) clearInterval(memoTimerRef.current);
    memoTimerRef.current = setInterval(() => {
      setMemoCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(memoTimerRef.current!);
          setMemoState("recall");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const checkMemoRecall = () => {
    const inputWords = memoInput
      .toLowerCase()
      .split(/[\s,.;]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    const correct: string[] = [];
    const incorrect: string[] = [];

    inputWords.forEach(w => {
      if (memoWords.includes(w) && !correct.includes(w)) {
        correct.push(w);
      } else if (w.length > 0 && !incorrect.includes(w)) {
        incorrect.push(w);
      }
    });

    setMemoCorrectList(correct);
    setMemoIncorrectList(incorrect);
    setMemoState("result");

    const xpEarned = correct.length * 10;
    if (xpEarned > 0) {
      grantDebugXp(xpEarned, `Word Memorization: ${correct.length}/20 recalled`);
      toast.success(`Recall complete! Got ${correct.length}/20 right. (+${xpEarned} XP)`);
    } else {
      toast.info("No correct words recalled. Keep training your Working Memory!");
    }
  };

  // 5. Logical Review: AI Reviewer
  const [logicalProblem, setLogicalProblem] = useState("");
  const [logicalDerivation, setLogicalDerivation] = useState("");
  const [logicalCritique, setLogicalCritique] = useState("");
  const [logicalLoading, setLogicalLoading] = useState(false);

  const requestLogicalCritique = async () => {
    if (!logicalProblem || !logicalDerivation) {
      toast.error("Please fill in both the problem and your step-by-step derivation.");
      return;
    }

    setLogicalLoading(true);
    setLogicalCritique("");
    try {
      const systemPrompt = `You are a strict, world-class Computer Science and Mathematics professor review agent. 
Analyze the user's derivation/logical argument.
Assess the logic for:
1. Mathematical rigor and logical correctness.
2. Hidden assumptions.
3. Logical jumps.
Address the key prompt: "Why is this the only correct answer?" or "Are there edge cases where this fails?"
Provide a direct, critical, but constructive critique. Output in clean Markdown formatting. Highlight strengths and list specific critical flaws or improvements.`;

      const userPrompt = `Problem:\n${logicalProblem}\n\nUser's Step-by-Step Derivation:\n${logicalDerivation}`;

      const text = await callAI(systemPrompt, userPrompt);
      setLogicalCritique(text);
      grantDebugXp(50, `Requested Logic Critique via ${aiProvider}`);
      setChecklist(prev => ({ ...prev, logicProblem: true }));
      toast.success(`AI Logic Review complete via ${aiProvider}! (+50 XP)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generating AI critique.");
    } finally {
      setLogicalLoading(false);
    }
  };

  // 6. Long-term Memory: Active Recall
  const [recallPhase, setRecallPhase] = useState<"read" | "recall" | "compare">("read");
  const [originalText, setOriginalText] = useState("");
  const [recalledText, setRecalledText] = useState("");
  const [conceptMatches, setConceptMatches] = useState<string[]>([]);
  const [retentionScore, setRetentionScore] = useState<number | null>(null);

  const calculateRetention = () => {
    const origClean = originalText.toLowerCase().split(/[\s,.;:!?()]+/).filter(w => w.length > 3);
    const recallClean = recalledText.toLowerCase().split(/[\s,.;:!?()]+/).filter(w => w.length > 3);

    // Stop words
    const stopWords = ["with", "that", "this", "then", "there", "their", "they", "from", "have", "were", "about", "which"];
    const keywords = Array.from(new Set(origClean)).filter(w => !stopWords.includes(w));

    if (keywords.length === 0) {
      setRetentionScore(0);
      setConceptMatches([]);
      setRecallPhase("compare");
      return;
    }

    const matched = keywords.filter(w => recallClean.includes(w));
    const score = Math.round((matched.length / keywords.length) * 100);

    setConceptMatches(matched);
    setRetentionScore(score);
    setRecallPhase("compare");

    const xpEarned = Math.round(score * 1.5);
    if (xpEarned > 0) {
      grantDebugXp(xpEarned, `Active Recall Diff: ${score}% retention`);
      toast.success(`Active Recall session finished! Retention Score: ${score}% (+${xpEarned} XP)`);
    }
  };

  // 7. Creative Thinking Exercise
  const [creativePromptIndex, setCreativePromptIndex] = useState(0);
  const [creativeAnswer, setCreativeAnswer] = useState("");
  const [creativeCritique, setCreativeCritique] = useState("");
  const [creativeLoading, setCreativeLoading] = useState(false);

  const loadNextCreativePrompt = () => {
    setCreativePromptIndex((prev) => (prev + 1) % CREATIVE_PROMPTS.length);
    setCreativeAnswer("");
    setCreativeCritique("");
  };

  const getCreativeFeedback = async () => {
    if (!creativeAnswer) {
      toast.error("Please type your creative solution first.");
      return;
    }
    setCreativeLoading(true);
    setCreativeCritique("");
    try {
      const systemPrompt = `You are a Creative Thinking Coach. The user is practicing lateral thinking exercises.
Analyze their ideas for the prompt. Suggest 3 additional wild, outside-the-box improvements or adaptations.
Acknowledge the user's creativity, score it from 1 to 10 on lateral expansion, and offer ideas that force them to think even further (e.g. from first principles or inverted assumptions). Keep your response short and inspiring.`;

      const userPrompt = `Creative Prompt:\n${CREATIVE_PROMPTS[creativePromptIndex]}\n\nUser's Creative Output:\n${creativeAnswer}`;

      const text = await callAI(systemPrompt, userPrompt);
      setCreativeCritique(text);
      grantDebugXp(60, `Completed Creative Brainstorm via ${aiProvider}`);
      toast.success(`AI Creative Brainstorm completed via ${aiProvider}! (+60 XP)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error generating critique.");
    } finally {
      setCreativeLoading(false);
    }
  };

  // Thinking Journal State
  const [journalText, setJournalText] = useState("");

  const saveJournalEntry = () => {
    if (!journalText.trim()) {
      toast.error("Journal cannot be empty.");
      return;
    }
    const savedLogs = JSON.parse(localStorage.getItem("mind-dev-journal-logs") || "[]");
    const entry = {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      text: journalText
    };
    localStorage.setItem("mind-dev-journal-logs", JSON.stringify([entry, ...savedLogs]));
    setJournalText("");
    setChecklist(prev => ({ ...prev, write: true }));
    grantDebugXp(100, "Wrote in Thinking Journal");
    toast.success("Thinking Journal entry saved (+100 XP)!", { icon: "📓" });
  };

  // Helper to toggle checklist item
  const toggleChecklistItem = (key: keyof ChecklistState, xp: number) => {
    const current = checklist[key];
    setChecklist(prev => ({ ...prev, [key]: !current }));
    if (!current) {
      grantDebugXp(xp, `Mind Dev habit: ${key}`);
      toast.success(`Completed! +${xp} XP`, { duration: 1500 });
    } else {
      toast.info("Item unchecked.");
    }
  };

  return (
    <AppShell>
      <TopBar eyebrow="Developer Mode" title="Mind Developer" subtitle="Cognitive enhancement protocol for building ambitious AI." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left Column: 90-Day Plan Selector, AI engine selector, and targets */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <FadeIn delay={0.02} className="glass-card border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-primary animate-pulse" />
              <h3 className="font-display font-bold text-lg">90-Day Brain Upgrade</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Consistently engage in difficult mental work to rebuild your brain's tolerance for effort. Track your month's phase:
            </p>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/40 mb-3">
              {[1, 2, 3].map((month) => (
                <button
                  key={month}
                  onClick={() => setActiveMonth(month as 1 | 2 | 3)}
                  className={cn(
                    "py-2 px-1 text-xs font-semibold rounded-lg transition-smooth border border-transparent",
                    activeMonth === month 
                      ? "bg-primary text-primary-foreground shadow-elevated" 
                      : "hover:bg-muted/60 text-muted-foreground"
                  )}
                >
                  Month {month}
                </button>
              ))}
            </div>

            <div className="border-t border-border/20 pt-4 mt-3 mb-5">
              <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 shadow-[inset_0_0_10px_rgba(99,102,241,0.1)] text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />
                
                <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 mb-3.5 relative z-10 flex items-center justify-center gap-1.5">
                  {mindDevMode ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                      <span className="text-green-400 font-semibold drop-shadow-sm">Upgrade Protocol: ACTIVE</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      <span>Upgrade Protocol: OFFLINE</span>
                    </>
                  )}
                </p>

                <Button
                  size="default"
                  className={cn(
                    "w-full transition-all duration-300 font-bold tracking-wide uppercase text-xs py-5 rounded-xl shadow-md border relative z-10",
                    mindDevMode 
                      ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.35)]" 
                      : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:scale-[1.02] active:scale-[0.98]"
                  )}
                  onClick={() => {
                    const target = !mindDevMode;
                    setMindDevMode(target);
                    if (target) {
                      syncMindDevTasksAndHabits(activeMonth);
                      toast.success(`Protocol Initialized! Month ${activeMonth} cognitive load compiled.`, { icon: "🧠" });
                    } else {
                      toast.info("Protocol paused. Standard OS active.", { icon: "⏸️" });
                    }
                  }}
                >
                  <Brain className="w-4 h-4 mr-1.5 shrink-0" />
                  {mindDevMode ? "ABORT PROTOCOL" : "START COGNITIVE UPGRADE"}
                </Button>
                
                <p className="text-[9px] text-muted-foreground mt-2.5 relative z-10 leading-relaxed max-w-[220px] mx-auto">
                  {mindDevMode 
                    ? `Currently compiling Month ${activeMonth} habits and logical thinking tasks.` 
                    : "Starts data synchronization, primary goals routing, and dashboard adaptations."}
                </p>
              </div>
            </div>

            {activeMonth === 1 && (
              <div className="text-xs space-y-2 text-foreground/90">
                <p className="font-semibold text-primary mb-1 uppercase tracking-wider text-[10px]">Month 1: Rebuild Discipline</p>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>2–3 hours of deep work daily</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Read one challenging technical book</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>20 minutes attention/concentration training</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span className="text-primary-foreground/90 font-medium">Daily logic or programming derivation (+50 XP)</span>
                </div>
                <div className="flex items-start gap-2 text-warning">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Eliminate short-form videos completely</span>
                </div>
              </div>
            )}

            {activeMonth === 2 && (
              <div className="text-xs space-y-2 text-foreground/90">
                <p className="font-semibold text-primary mb-1 uppercase tracking-wider text-[10px]">Month 2: Increase Cognitive Load</p>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>4 hours of deep work daily</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Harder mathematics and algorithm proofs</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Learn chess tactics / patterns</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Mental math practice (+25 XP)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Weekly essay written entirely from memory</span>
                </div>
              </div>
            )}

            {activeMonth === 3 && (
              <div className="text-xs space-y-2 text-foreground/90">
                <p className="font-semibold text-primary mb-1 uppercase tracking-wider text-[10px]">Month 3: Peak Thinking</p>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>5–6 hours of quality deep work daily</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Build complex projects from scratch without tutorials</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Teach advanced concepts to others</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Solve complex, multi-step problems</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Review and refine your thinking process weekly</span>
                </div>
              </div>
            )}
          </FadeIn>

          {/* AI Engine Configuration */}
          <FadeIn delay={0.03} className="glass-card border-indigo-500/20 bg-indigo-950/10">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              AI Engine Config
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-muted-foreground mb-1">Active AI Provider</label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as "gemini" | "chatgpt")}
                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini">Gemini 3.6</option>
                  <option value="chatgpt">ChatGPT 5.5</option>
                </select>
              </div>

              {aiProvider === "chatgpt" && (
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-muted-foreground mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder={import.meta.env.VITE_OPENAI_API_KEY ? "Loaded from ENV" : "Paste your sk-... key here"}
                    disabled={!!import.meta.env.VITE_OPENAI_API_KEY}
                    className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {!import.meta.env.VITE_OPENAI_API_KEY && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Stored locally in browser cache.
                    </p>
                  )}
                </div>
              )}
            </div>
          </FadeIn>

          {/* Daily Mind Habits Checklist */}
          <FadeIn delay={0.04} className="glass-card">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Daily Protocols
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checklist.read}
                    onChange={() => toggleChecklistItem("read", 60)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold">Read challenging books (30m)</p>
                    <p className="text-[10px] text-muted-foreground">Math, CS, Physics, Philosophy</p>
                  </div>
                </div>
                <Chip tone="success" className="text-[10px]">+60 XP</Chip>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checklist.write}
                    onChange={() => toggleChecklistItem("write", 100)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold">Thinking Journal (30m)</p>
                    <p className="text-[10px] text-muted-foreground">Structure and reflect thoughts</p>
                  </div>
                </div>
                <Chip tone="success" className="text-[10px]">+100 XP</Chip>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checklist.solve}
                    onChange={() => toggleChecklistItem("solve", 120)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold">Solve Problems (1h)</p>
                    <p className="text-[10px] text-muted-foreground">Struggle 20-30m before seeking help</p>
                  </div>
                </div>
                <Chip tone="success" className="text-[10px]">+120 XP</Chip>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checklist.hardSkill}
                    onChange={() => toggleChecklistItem("hardSkill", 150)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold">Practice 1 Hard Skill</p>
                    <p className="text-[10px] text-muted-foreground">Advanced Math, Algorithms, ML, System Design</p>
                  </div>
                </div>
                <Chip tone="success" className="text-[10px]">+150 XP</Chip>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checklist.noLazy}
                    onChange={() => toggleChecklistItem("noLazy", 80)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-xs font-semibold">Lazy-Brain Blockers Active</p>
                    <p className="text-[10px] text-muted-foreground">No short-form content, no immediate searching</p>
                  </div>
                </div>
                <Chip tone="success" className="text-[10px]">+80 XP</Chip>
              </div>

              {activeMonth === 1 && (
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checklist.logicProblem}
                      onChange={() => toggleChecklistItem("logicProblem", 50)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-xs font-semibold">Daily Logic Problem solved</p>
                      <p className="text-[10px] text-muted-foreground">1 math/CS logic puzzle</p>
                    </div>
                  </div>
                  <Chip tone="success" className="text-[10px]">+50 XP</Chip>
                </div>
              )}

              {activeMonth === 2 && (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checklist.chessTactics}
                        onChange={() => toggleChecklistItem("chessTactics", 60)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-xs font-semibold">Chess Tactics training</p>
                        <p className="text-[10px] text-muted-foreground">Train visualization</p>
                      </div>
                    </div>
                    <Chip tone="success" className="text-[10px]">+60 XP</Chip>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checklist.weeklyEssay}
                        onChange={() => toggleChecklistItem("weeklyEssay", 120)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-xs font-semibold">Weekly Memory Essay</p>
                        <p className="text-[10px] text-muted-foreground">Draft concepts from memory</p>
                      </div>
                    </div>
                    <Chip tone="success" className="text-[10px]">+120 XP</Chip>
                  </div>
                </>
              )}

              {activeMonth === 3 && (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checklist.buildNoTutorial}
                        onChange={() => toggleChecklistItem("buildNoTutorial", 200)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-xs font-semibold">Build without Tutorial</p>
                        <p className="text-[10px] text-muted-foreground">First-principles engineering</p>
                      </div>
                    </div>
                    <Chip tone="success" className="text-[10px]">+200 XP</Chip>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checklist.teachOthers}
                        onChange={() => toggleChecklistItem("teachOthers", 150)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="text-xs font-semibold">Feynman Method (Teach others)</p>
                        <p className="text-[10px] text-muted-foreground">Explain concept without notes</p>
                      </div>
                    </div>
                    <Chip tone="success" className="text-[10px]">+150 XP</Chip>
                  </div>
                </>
              )}
            </div>
          </FadeIn>

          {/* Body Biomechanics */}
          <FadeIn delay={0.06} className="glass-card">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Body Biomechanics
            </h3>
            <p className="text-[11px] text-muted-foreground mb-4">
              Your brain depends on your body. Keep these bio-habit indicators high:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toggleChecklistItem("sleep", 40)}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-smooth text-center",
                  checklist.sleep 
                    ? "bg-purple-950/30 border-purple-500/50 text-purple-200" 
                    : "border-border/40 hover:bg-muted/10 text-muted-foreground"
                )}
              >
                <Moon className="w-5 h-5 text-purple-400" />
                <span className="text-[11px] font-semibold">7.5–9h Sleep</span>
              </button>

              <button
                onClick={() => toggleChecklistItem("exercise", 45)}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-smooth text-center",
                  checklist.exercise 
                    ? "bg-rose-950/30 border-rose-500/50 text-rose-200" 
                    : "border-border/40 hover:bg-muted/10 text-muted-foreground"
                )}
              >
                <Dumbbell className="w-5 h-5 text-rose-400" />
                <span className="text-[11px] font-semibold">Cardio + Strength</span>
              </button>

              <button
                onClick={() => toggleChecklistItem("protein", 30)}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-smooth text-center",
                  checklist.protein 
                    ? "bg-blue-950/30 border-blue-500/50 text-blue-200" 
                    : "border-border/40 hover:bg-muted/10 text-muted-foreground"
                )}
              >
                <GlassWater className="w-5 h-5 text-blue-400" />
                <span className="text-[11px] font-semibold">Protein & Hydrate</span>
              </button>

              <button
                onClick={() => toggleChecklistItem("sunlight", 30)}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-smooth text-center",
                  checklist.sunlight 
                    ? "bg-amber-950/30 border-amber-500/50 text-amber-200" 
                    : "border-border/40 hover:bg-muted/10 text-muted-foreground"
                )}
              >
                <Sun className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] font-semibold">Daily Sunlight</span>
              </button>
            </div>
          </FadeIn>
        </div>

        {/* Center/Right Column: Interactive Tools */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Pillar 1 & Breath Timer Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Focus Trainer */}
            <FadeIn delay={0.08} className="glass-card relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] rounded-full pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Pillar 1: Focus Block</h3>
                </div>
                {focusActive && <Chip tone="warning" className="animate-pulse">Active</Chip>}
              </div>

              {focusActive && focusTimeLeft !== null ? (
                <div className="text-center py-6">
                  <h4 className="text-4xl font-display font-bold font-mono tracking-wider mb-2 text-primary drop-shadow-md">
                    {formatTime(focusTimeLeft)}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">Focus deeply on one task. No lyric music. Phone outside.</p>
                  <Button variant="outline" size="sm" className="border-red-500/30 hover:bg-red-500/10 text-red-400" onClick={stopFocusTimer}>
                    Cancel Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Start an uninterrupted deep work block. This trains your attention control by keeping your brain on one target.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" onClick={() => startFocusTimer(45)}>45 Min</Button>
                    <Button variant="outline" size="sm" onClick={() => startFocusTimer(60)}>60 Min</Button>
                    <Button variant="outline" size="sm" onClick={() => startFocusTimer(90)}>90 Min</Button>
                  </div>
                </div>
              )}
            </FadeIn>

            {/* Concentration (Breath) Trainer */}
            <FadeIn delay={0.1} className="glass-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h3 className="font-display font-bold text-lg">Concentration Trainer</h3>
                </div>
                {breathActive && <Chip tone="accent" className="animate-pulse">Focusing</Chip>}
              </div>

              {breathActive && breathTimeLeft !== null ? (
                <div className="text-center py-6">
                  <h4 className="text-4xl font-display font-bold font-mono tracking-wider mb-2 text-purple-400 drop-shadow-md">
                    {formatTime(breathTimeLeft)}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">Focus ONLY on breathing. If mind wanders, return gently.</p>
                  <Button variant="outline" size="sm" className="border-purple-500/30 hover:bg-purple-500/10 text-purple-400" onClick={() => { setBreathActive(false); setBreathTimeLeft(null); }}>
                    Stop Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Train concentration with simple, non-relaxing attention control. Focus only on breathing patterns.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => startBreathTimer(10)}>10 Min (Beginner)</Button>
                    <Button variant="outline" size="sm" onClick={() => startBreathTimer(20)}>20 Min (Advanced)</Button>
                  </div>
                </div>
              )}
            </FadeIn>
          </div>

          {/* Pillar 2: Working Memory Trainer Games */}
          <FadeIn delay={0.12} className="glass-card">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-cyan-400" />
              <h3 className="font-display font-bold text-lg">Pillar 2: Working Memory Trainer (Brain's RAM)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Mental Math Mini Game */}
              <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Mental Math Arena
                </h4>
                
                {mathActive ? (
                  <form onSubmit={checkMathAnswer} className="space-y-3">
                    <div className="p-3 rounded-lg bg-black/40 text-center border border-border/20">
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-mono">Solve the Equation</p>
                      <p className="text-xl font-bold font-mono text-cyan-400">{mathQuestion}</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={mathAnswer}
                        onChange={(e) => setMathAnswer(e.target.value)}
                        placeholder="Your answer..."
                        className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-cyan-500"
                        autoFocus
                      />
                      <Button type="submit" size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white">
                        Submit
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>Streak: <strong className="text-cyan-400">{mathStreak}</strong></span>
                      <button type="button" className="underline hover:text-foreground" onClick={() => setMathActive(false)}>
                        Exit Game
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Strengthen working memory by calculating multidigit sums, differences, and products without writing them down.
                    </p>
                    <Button size="sm" className="w-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-400 font-semibold" onClick={startMathGame}>
                      Start Math Challenge
                    </Button>
                  </div>
                )}
              </div>

              {/* Word Memorization Game */}
              <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-400" />
                  20-Word Recall Task
                </h4>

                {memoState === "idle" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You will have 30 seconds to memorize 20 scientific and computer science words. After that, recall as many as you can.
                    </p>
                    <Button size="sm" className="w-full bg-purple-950/80 hover:bg-purple-900 border border-purple-500/30 text-purple-400 font-semibold" onClick={startMemoGame}>
                      Start Memorization
                    </Button>
                  </div>
                )}

                {memoState === "memorize" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-purple-400">MEMORIZE NOW</span>
                      <span className="text-amber-400 font-bold">Time left: {memoCountdown}s</span>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-purple-500/20 max-h-36 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-center font-mono">
                        {memoWords.map((w, idx) => (
                          <span key={w} className="py-0.5 px-1 bg-purple-950/20 rounded border border-purple-500/10 text-purple-200">
                            {idx + 1}. {w}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => { if (memoTimerRef.current) clearInterval(memoTimerRef.current); setMemoState("recall"); }}>
                      I'm Ready to Recall
                    </Button>
                  </div>
                )}

                {memoState === "recall" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Type as many words as you can remember. Separate them with spaces or commas.</p>
                    <textarea
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      placeholder="e.g. algorithm, entropy, compiling..."
                      className="w-full h-24 p-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold" onClick={checkMemoRecall}>
                      Check Recall Results
                    </Button>
                  </div>
                )}

                {memoState === "result" && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-400">Results: {memoCorrectList.length}/20 Recalled</span>
                      <button className="underline text-muted-foreground hover:text-foreground" onClick={() => setMemoState("idle")}>
                        Play Again
                      </button>
                    </div>
                    
                    <div className="p-2 rounded bg-black/30 border border-border/20 max-h-24 overflow-y-auto space-y-1">
                      <p className="font-semibold text-[10px] text-green-400">Correctly Recalled:</p>
                      <p className="font-mono text-green-200">{memoCorrectList.join(", ") || "None"}</p>
                      
                      <p className="font-semibold text-[10px] text-red-400">Incorrect / Misremembered:</p>
                      <p className="font-mono text-red-200">{memoIncorrectList.join(", ") || "None"}</p>
                    </div>
                    
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Keep training! High working memory capacity allows your brain to hold more variables when constructing code or solving proofs.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Pillar 3: Logical Thinking Proof Critiquer */}
          <FadeIn delay={0.14} className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-bold text-lg">Pillar 3: Logical Derivation Critique</h3>
              </div>
              <Chip tone="success" className="text-[10px] capitalize">{aiProvider} Coached</Chip>
            </div>
            
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              When solving math or algorithmic problems, input your solution steps below. The AI will audit your assumptions, check for logical jumps, and review: <em>"Why is this the only correct answer?"</em>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-muted-foreground mb-1">Problem Statement</label>
                <input
                  type="text"
                  value={logicalProblem}
                  onChange={(e) => setLogicalProblem(e.target.value)}
                  placeholder="e.g. Prove that the sum of the first n odd numbers is n^2."
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-muted-foreground mb-1">Your Derivation / Proof Steps</label>
                <textarea
                  value={logicalDerivation}
                  onChange={(e) => setLogicalDerivation(e.target.value)}
                  placeholder="Explain step-by-step. E.g. Base case n=1 is 1 = 1^2. Assume true for k: 1+3+...+(2k-1)=k^2. Then for k+1..."
                  className="w-full h-24 p-2.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <Button
                size="sm"
                onClick={requestLogicalCritique}
                disabled={logicalLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
              >
                {logicalLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Auditing Derivation...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Verify Logical Rigor
                  </>
                )}
              </Button>

              {logicalCritique && (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-xs text-emerald-100 mt-4 leading-relaxed font-sans max-h-64 overflow-y-auto">
                  <div className="flex items-center gap-1 text-emerald-400 font-bold mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    AI Logical Critique Report ({aiProvider}):
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap font-mono text-[11px]">
                    {logicalCritique}
                  </div>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Pillar 4: Long-Term Memory (Active Recall) */}
          <FadeIn delay={0.16} className="glass-card">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <h3 className="font-display font-bold text-lg">Pillar 4: Long-Term Memory (Active Recall Playground)</h3>
            </div>
            
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Read technical content, close the book, write down what you remember, and run a comparison check. This strengthens retrieval pathways in your neural network.
            </p>

            {recallPhase === "read" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-muted-foreground mb-1">Paste Technical Passage to Read</label>
                  <textarea
                    value={originalText}
                    onChange={(e) => setOriginalText(e.target.value)}
                    placeholder="Paste the paragraph or technical book section you are studying..."
                    className="w-full h-32 p-2.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={originalText.trim().length === 0}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                  onClick={() => setRecallPhase("recall")}
                >
                  Close Book & Write Notes
                </Button>
              </div>
            )}

            {recallPhase === "recall" && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-center">
                  <p className="text-xs text-amber-300 font-semibold">Passage hidden! Write down everything you remember below.</p>
                </div>
                <textarea
                  value={recalledText}
                  onChange={(e) => setRecalledText(e.target.value)}
                  placeholder="Start recalling concepts, derivations, keywords, definitions..."
                  className="w-full h-32 p-2.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                    onClick={calculateRetention}
                  >
                    Compare Recall Accuracy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRecallPhase("read")}>
                    Show Original Passage
                  </Button>
                </div>
              </div>
            )}

            {recallPhase === "compare" && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-border/20">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Memory Retention Score</p>
                    <p className="text-3xl font-bold text-amber-400">{retentionScore}%</p>
                  </div>
                  <Chip tone={retentionScore !== null && retentionScore > 60 ? "success" : "warning"}>
                    {retentionScore !== null && retentionScore > 60 ? "Excellent Retrieval" : "Needs Review"}
                  </Chip>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/10 border border-border/20">
                    <p className="font-semibold text-muted-foreground mb-1 text-[10px] uppercase">Keywords Matched ({conceptMatches.length}):</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {conceptMatches.map((word) => (
                        <span key={word} className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/40 text-green-300 rounded font-mono text-[10px]">
                          {word}
                        </span>
                      ))}
                      {conceptMatches.length === 0 && <span className="text-muted-foreground italic">None matched yet. Try again!</span>}
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted/10 border border-border/20">
                    <p className="font-semibold text-muted-foreground mb-1 text-[10px] uppercase">Study Tips:</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Re-read the original passage, then wait 5 minutes and try recalling it again. The cognitive friction of trying to retrieve the memory is what strengthens the connections.
                    </p>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => { setOriginalText(""); setRecalledText(""); setRecallPhase("read"); setRetentionScore(null); }}>
                  Reset & Start New Recall
                </Button>
              </div>
            )}
          </FadeIn>

          {/* Pillar 5: Creative Thinking Exercises */}
          <FadeIn delay={0.18} className="glass-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-300 animate-bounce" />
                <h3 className="font-display font-bold text-lg">Pillar 5: Lateral & Creative Thinking</h3>
              </div>
              <Button size="sm" variant="ghost" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={loadNextCreativePrompt}>
                <RefreshCw className="w-3 h-3" /> Next Prompt
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Force your brain to generate ideas instead of consuming them. Below is a lateral thinking challenge:
            </p>

            <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 mb-4">
              <p className="text-sm font-semibold text-amber-200">"{CREATIVE_PROMPTS[creativePromptIndex]}"</p>
            </div>

            <div className="space-y-3">
              <textarea
                value={creativeAnswer}
                onChange={(e) => setCreativeAnswer(e.target.value)}
                placeholder="Type your creative solutions, assumptions, or architectural designs..."
                className="w-full h-24 p-2.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-amber-500"
              />

              <Button
                size="sm"
                onClick={getCreativeFeedback}
                disabled={creativeLoading}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5"
              >
                {creativeLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating Brainstorm...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Lateral Review
                  </>
                )}
              </Button>

              {creativeCritique && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/20 text-xs text-amber-100 mt-4 leading-relaxed font-sans max-h-64 overflow-y-auto">
                  <div className="flex items-center gap-1 text-amber-400 font-bold mb-2">
                    <Sparkles className="w-4 h-4" />
                    AI Creative Coach Ideas ({aiProvider}):
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap font-mono text-[11px]">
                    {creativeCritique}
                  </div>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Thinking Journal */}
          <FadeIn delay={0.2} className="glass-card">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Daily Thinking Journal (30m)
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Writing forces chaotic thoughts into structured forms. Reflect: <em>What did you learn? What confused you? What questions remain? How does it connect?</em>
            </p>

            <div className="space-y-4">
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="Log your reflections here..."
                className="w-full h-32 p-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-indigo-500"
              />
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                onClick={saveJournalEntry}
              >
                Save Journal Entry
              </Button>
            </div>
          </FadeIn>

        </div>
      </div>
    </AppShell>
  );
}
