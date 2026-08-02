import { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore, type Priority, type TaskCategory } from "@/lib/store";
import { getGeminiApiKey } from "@/lib/gemini-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Clipboard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Compass,
  Zap,
  RotateCcw,
  Target,
  Activity,
  Bookmark,
  Scale
} from "lucide-react";
import { computeBurnout } from "@/lib/burnout";

interface ParsedGoal {
  title: string;
  category: TaskCategory;
}

interface ParsedTask {
  title: string;
  priority: Priority;
  category: TaskCategory;
  durationMin: number;
}

interface ParsedHabit {
  name: string;
  emoji: string;
  color: string;
  targetPerWeek: number;
  category: TaskCategory;
}

interface ParsedMilestone {
  title: string;
  category: TaskCategory;
}

interface ParsedPlan {
  goals: ParsedGoal[];
  tasks: ParsedTask[];
  habits: ParsedHabit[];
  milestones: ParsedMilestone[];
  unrealisticWarnings: string[];
}

export const ImportPage = () => {
  const state = useAppStore();
  const addTask = useAppStore((s) => s.addTask);
  const addHabit = useAppStore((s) => s.addHabit);
  const selectedModel = useAppStore((s) => s.selectedModel);

  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan | null>(null);

  // Editable lists
  const [selectedTasks, setSelectedTasks] = useState<ParsedTask[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<ParsedHabit[]>([]);
  const [selectedMilestones, setSelectedMilestones] = useState<ParsedMilestone[]>([]);

  // User historical behavior comparison
  const burnout = useMemo(
    () => computeBurnout({ healthLogs: state.healthLogs, tasks: state.tasks, xpHistory: state.xpHistory }),
    [state.healthLogs, state.tasks, state.xpHistory]
  );

  const totalFocusPast14Days = useMemo(() => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    return state.focusSessions
      .filter((s) => new Date(s.completedAt) >= fourteenDaysAgo)
      .reduce((acc, s) => acc + s.durationMin, 0);
  }, [state.focusSessions]);

  const averageDailyFocusMinutes = Math.round(totalFocusPast14Days / 14);

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error("Please paste an AI plan or prompt to parse.");
      return;
    }

    setParsing(true);
    try {
      const GEMINI_API_KEY = getGeminiApiKey();
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not configured. Add it in settings.");
      }

      const systemPrompt = `You are FitflowAnti's Plan Extraction Engine.
Analyze the user's pasted plan, schedule, study roadmap, or prompt. Extract and map:
- Goals (primary outcomes/subjects, categories are: "work" | "personal" | "health" | "learning" | "other")
- Tasks (concrete execution items, category matches, priority is: "low" | "medium" | "high" | "urgent", durationMin estimates)
- Habits (recurring behaviors/routines, choose a suitable emoji and color code)
- Milestones (intermediate achievements or deadlines)
- Compare the extracted plan metrics to find unrealistic assumptions (e.g. studying 8 hours/day, waking up at 4 AM, working out 3 hours daily) and return specific "unrealisticWarnings" detailing the danger.

You must return a valid JSON structure matching the schema.`;

      const userPrompt = `Pasted Plan:\n${rawText}\n\nExtract and personalize.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  goals: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        title: { type: "STRING" },
                        category: { type: "STRING", enum: ["work", "personal", "health", "learning", "other"] }
                      },
                      required: ["title", "category"]
                    }
                  },
                  tasks: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        title: { type: "STRING" },
                        priority: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
                        category: { type: "STRING", enum: ["work", "personal", "health", "learning", "other"] },
                        durationMin: { type: "NUMBER" }
                      },
                      required: ["title", "priority", "category", "durationMin"]
                    }
                  },
                  habits: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        emoji: { type: "STRING" },
                        color: { type: "STRING" },
                        targetPerWeek: { type: "NUMBER" },
                        category: { type: "STRING", enum: ["work", "personal", "health", "learning", "other"] }
                      },
                      required: ["name", "emoji", "color", "targetPerWeek", "category"]
                    }
                  },
                  milestones: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        title: { type: "STRING" },
                        category: { type: "STRING", enum: ["work", "personal", "health", "learning", "other"] }
                      },
                      required: ["title", "category"]
                    }
                  },
                  unrealisticWarnings: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                  }
                },
                required: ["goals", "tasks", "habits", "milestones", "unrealisticWarnings"]
              }
            }
          })
        }
      );

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const res = await response.json();
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Could not retrieve clean response from Gemini.");

      const data: ParsedPlan = JSON.parse(text);
      setParsedPlan(data);
      setSelectedTasks(data.tasks);
      setSelectedHabits(data.habits);
      setSelectedMilestones(data.milestones);
      toast.success("AI plan successfully processed!");
    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "Failed to process plan. Please try again.";
      toast.error(errorMessage);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = () => {
    let tasksAdded = 0;
    let habitsAdded = 0;

    selectedTasks.forEach((t) => {
      addTask({
        title: t.title,
        priority: t.priority,
        category: t.category,
        durationMin: t.durationMin
      });
      tasksAdded++;
    });

    selectedHabits.forEach((h) => {
      addHabit({
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        targetPerWeek: h.targetPerWeek,
        category: h.category
      });
      habitsAdded++;
    });

    // Milestones mapped to high priority tasks or notes for simple structure
    selectedMilestones.forEach((m) => {
      addTask({
        title: `🏆 Milestone: ${m.title}`,
        priority: "high",
        category: m.category,
        durationMin: 30
      });
      tasksAdded++;
    });

    toast.success(`Successfully imported ${tasksAdded} tasks and ${habitsAdded} habits!`);
    setParsedPlan(null);
    setRawText("");
  };

  // Optimization recommendations based on historical data
  const loadWarnings = useMemo(() => {
    const warnings: string[] = [];
    
    // Check total tasks to import
    if (selectedTasks.length > 10) {
      warnings.push("High Initial Task Load: Setting up over 10 tasks immediately can decrease adherence. Consider reducing to high-impact tasks first.");
    }

    // Check burnout level
    if (burnout.level === "high") {
      warnings.push("High Burnout Level Detected: Your metrics show high strain. Adding a heavy schedule now increases burnout risk. We recommend recovery-themed tasks first.");
    }

    // Focus constraints
    const totalNewDuration = selectedTasks.reduce((acc, t) => acc + t.durationMin, 0);
    if (totalNewDuration > averageDailyFocusMinutes * 3 && averageDailyFocusMinutes > 10) {
      warnings.push(`Extreme Focus Target: The plan requests ~${totalNewDuration} mins of work, while your daily average is ${averageDailyFocusMinutes} mins. Start smaller to build consistency.`);
    }

    return warnings;
  }, [selectedTasks, averageDailyFocusMinutes, burnout.level]);

  return (
    <AppShell>
      <TopBar
        eyebrow="Universal Execution"
        title="AI Plan Importer"
        subtitle="Transform ChatGPT roadmaps and AI strategies into actionable workflows."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left Side: Paste Zone */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <FadeIn className="glass-card flex flex-col gap-4 h-full">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clipboard className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-lg">Input AI Plan</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Paste any text plan, study program, workout template, or copy-paste transcripts directly from ChatGPT, Claude, or Gemini.
              </p>
            </div>

            <Textarea
              placeholder="Example: 'Create a 30-day DSA roadmap. Study DBMS for 3 hours daily, solve PYQs, revise notes, and sleep by 11 PM...'"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="flex-1 min-h-[300px] bg-background/40 border-border/40 font-mono text-sm leading-relaxed"
            />

            <div className="flex items-center justify-between gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRawText("")}
                disabled={parsing || !rawText}
                className="text-muted-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>

              <Button
                onClick={handleParse}
                disabled={parsing || !rawText.trim()}
                className="bg-gradient-primary hover:shadow-glow px-6 font-semibold"
              >
                {parsing ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Extracting Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract & Personalize
                  </>
                )}
              </Button>
            </div>
          </FadeIn>
        </div>

        {/* Right Side: Parsing & Personalized Customization Workbench */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!parsedPlan ? (
              <FadeIn className="glass-card flex flex-col items-center justify-center text-center py-16 px-4 h-full border-dashed">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <Compass className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="font-display font-bold text-lg">Execution Engine Workbench</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                  Paste a text plan on the left to extract tasks, habits, and milestones aligned with your behavior.
                </p>
              </FadeIn>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-5"
              >
                {/* Personalizer Insights */}
                <div className="glass-card border-accent/40 bg-accent/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-accent" />
                    <h3 className="font-display font-bold text-base text-accent-foreground">
                      Personalization Guard (AI Analysis)
                    </h3>
                  </div>

                  {/* AI Unrealistic warnings & Guard constraints */}
                  {(parsedPlan.unrealisticWarnings.length > 0 || loadWarnings.length > 0) ? (
                    <div className="space-y-2 mt-2">
                      {parsedPlan.unrealisticWarnings.map((w, idx) => (
                        <div key={idx} className="flex gap-2 text-xs text-amber-300 items-start bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                      {loadWarnings.map((w, idx) => (
                        <div key={idx} className="flex gap-2 text-xs text-red-400 items-start bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                          <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2 text-xs text-emerald-400 items-start bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 mt-2">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>This plan aligns beautifully with your current focus velocity and recovery levels. Ready to commit!</span>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs border-t border-border/40 pt-3">
                    <div>
                      <span className="text-muted-foreground">Historical Daily Focus:</span>
                      <p className="font-semibold mt-0.5 text-foreground">{averageDailyFocusMinutes} minutes</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Strain/Burnout watch:</span>
                      <p className="font-semibold mt-0.5 capitalize text-foreground">{burnout.level} ({Math.round(burnout.risk * 100)}%)</p>
                    </div>
                  </div>
                </div>

                {/* Extracted Goals */}
                {parsedPlan.goals.length > 0 && (
                  <div className="glass-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Goals & Focus Areas</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parsedPlan.goals.map((g, i) => (
                        <Chip key={i} tone="primary">
                          {g.title} <span className="opacity-60 text-[10px]">({g.category})</span>
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workbench Tasks Section */}
                <div className="glass-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                        Structured Tasks ({selectedTasks.length})
                      </h4>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedTasks.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 text-sm gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">{t.title}</span>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] uppercase text-muted-foreground">{t.category}</span>
                            <span className="text-[10px] text-accent font-medium">{t.priority}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{t.durationMin}m</span>
                          <input
                            type="checkbox"
                            checked={selectedTasks.includes(t)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTasks([...selectedTasks, t]);
                              else setSelectedTasks(selectedTasks.filter((item) => item !== t));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workbench Habits Section */}
                <div className="glass-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                        Recurring Habits ({selectedHabits.length})
                      </h4>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {selectedHabits.map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{h.emoji}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">{h.name}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">{h.category}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{h.targetPerWeek}x/week</span>
                          <input
                            type="checkbox"
                            checked={selectedHabits.includes(h)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedHabits([...selectedHabits, h]);
                              else setSelectedHabits(selectedHabits.filter((item) => item !== h));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workbench Milestones Section */}
                {parsedPlan.milestones.length > 0 && (
                  <div className="glass-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-primary" />
                        <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                          Milestones ({selectedMilestones.length})
                        </h4>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                      {selectedMilestones.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 text-sm gap-2">
                          <span className="font-semibold text-foreground truncate">{m.title}</span>
                          <input
                            type="checkbox"
                            checked={selectedMilestones.includes(m)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedMilestones([...selectedMilestones, m]);
                              else setSelectedMilestones(selectedMilestones.filter((item) => item !== m));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Committing Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setParsedPlan(null)}>
                    Discard
                  </Button>
                  <Button onClick={handleImport} className="bg-gradient-primary hover:shadow-glow font-bold px-8">
                    Convert to Action System
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
};

export default ImportPage;
