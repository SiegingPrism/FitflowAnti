import { getISTDate, getISTISOString } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { useAppStore, type TaskCategory } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Activity, Dumbbell, BookOpen, Brain, Briefcase, ListChecks } from "lucide-react";

const categories = [
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "study", label: "Study", icon: BookOpen },
  { id: "mental_health", label: "Mental Health", icon: Brain },
  { id: "work", label: "Work", icon: Briefcase },
] as const;

export default function Life() {
  const { tasks, habits, toggleTask, toggleHabitToday } = useAppStore();
  const [activeTab, setActiveTab] = useState<TaskCategory>("fitness");

  const todayStr = getISTISOString().slice(0, 10);

  const getTasks = (category: TaskCategory) => tasks.filter(t => t.category === category && (!t.completed || t.completedAt?.startsWith(todayStr)));
  const getHabits = (category: TaskCategory) => habits.filter(h => h.category === category);

  return (
    <AppShell>
      <TopBar eyebrow="Behavior Engine" title="Cross-Life OS" subtitle="A unified view of your personal operating system." />
      <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col gap-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskCategory)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-16 bg-black/20 p-1.5 rounded-2xl">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger key={cat.id} value={cat.id} className="rounded-xl flex gap-2 items-center text-xs md:text-sm">
                  <Icon className="w-4 h-4 hidden sm:block" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {categories.map((cat) => {
            const catTasks = getTasks(cat.id);
            const catHabits = getHabits(cat.id);
            
            return (
              <TabsContent key={cat.id} value={cat.id} className="mt-6 space-y-8 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-6 md:grid-cols-2"
                >
                  {/* Habits Section */}
                  <div className="glass-card p-6 flex flex-col gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" /> Daily Routines
                    </h2>
                    {catHabits.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No routines mapped to {cat.label} yet. Add them in Habits.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {catHabits.map(h => {
                          const done = h.history.includes(todayStr);
                          return (
                            <button
                              key={h.id}
                              onClick={() => toggleHabitToday(h.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl transition-smooth text-left border ${done ? 'bg-primary/10 border-primary/20 text-foreground shadow-glow' : 'bg-background/50 border-border/40 hover:bg-white/5'}`}
                            >
                              <div className="text-2xl">{h.emoji}</div>
                              <div className="flex-1 font-medium">{h.name}</div>
                              {done ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tasks Section */}
                  <div className="glass-card p-6 flex flex-col gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <ListChecks className="w-5 h-5 text-accent" /> Action Items
                    </h2>
                    {catTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No action items scheduled. Add them in Tasks.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {catTasks.map(t => (
                          <button
                            key={t.id}
                            onClick={() => toggleTask(t.id)}
                            className={`flex items-start gap-3 p-3 rounded-xl transition-smooth text-left border ${t.completed ? 'bg-accent/10 border-accent/20 opacity-70' : 'bg-background/50 border-border/40 hover:bg-white/5'}`}
                          >
                            <div className="mt-0.5">
                              {t.completed ? <CheckCircle2 className="w-5 h-5 text-accent" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                            </div>
                            <div className="flex flex-col flex-1">
                              <span className={`font-medium ${t.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.title}</span>
                              <div className="flex gap-2 mt-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">{t.priority}</span>
                                <span className="text-[10px] uppercase font-bold text-primary">{t.xp} XP</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppShell>
  );
}
