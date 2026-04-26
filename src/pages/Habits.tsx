import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Flame, Trash2, Check } from "lucide-react";
import { format, subDays } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore, todayKey, type Habit } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const computeStreak = (history: string[]) => {
  if (history.length === 0) return 0;
  const set = new Set(history);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const k = cursor.toISOString().slice(0, 10);
    if (set.has(k)) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
};

const HabitsPage = () => {
  const { habits, toggleHabitToday, removeHabit, addHabit } = useAppStore();
  const today = todayKey();

  // 30-day grid
  const days = [...Array(30)].map((_, i) => format(subDays(new Date(), 29 - i), "yyyy-MM-dd"));

  return (
    <AppShell>
      <TopBar eyebrow="Daily" title="Habits" subtitle="Streaks and consistency, beautifully visualized." />

      <FadeIn className="flex justify-end mb-5">
        <NewHabitDialog onCreate={(h) => { addHabit(h); toast.success("Habit added"); }} />
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {habits.length === 0 && (
          <div className="glass-card md:col-span-2 text-center py-12">
            <p className="text-muted-foreground">No habits yet. Click "Add Habit" to start a streak.</p>
          </div>
        )}
        {habits.map((h, i) => {
          const streak = computeStreak(h.history);
          const set = new Set(h.history);
          const last7 = days.slice(-7).filter((d) => set.has(d)).length;
          return (
            <FadeIn key={h.id} delay={i * 0.05} className="glass-card group">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary/15 flex items-center justify-center text-2xl">
                  {h.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-lg truncate">{h.name}</h3>
                    <button onClick={() => { removeHabit(h.id); toast("Habit removed"); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth" aria-label="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Chip tone="warning"><Flame className="w-3 h-3" /> {streak} day{streak === 1 ? "" : "s"}</Chip>
                    <Chip tone="muted">{last7}/{h.targetPerWeek} this week</Chip>
                  </div>
                </div>
              </div>

              {/* heatmap */}
              <div className="grid grid-cols-15 gap-1 mt-4" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
                {days.map((d, idx) => {
                  const done = set.has(d);
                  return (
                    <motion.div
                      key={d}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.005 }}
                      className={cn(
                        "aspect-square rounded-sm",
                        done ? "bg-gradient-primary shadow-glow" : "bg-muted",
                        d === today && !done && "ring-1 ring-primary/40",
                      )}
                      title={`${format(new Date(d), "MMM d")}${done ? " ✓" : ""}`}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => toggleHabitToday(h.id)}
                className={cn(
                  "mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition-bounce flex items-center justify-center gap-2",
                  set.has(today)
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-gradient-primary text-primary-foreground shadow-elevated hover:shadow-glow",
                )}
              >
                {set.has(today) ? <><Check className="w-4 h-4" />Done today</> : "Mark done today"}
              </button>
            </FadeIn>
          );
        })}
      </div>
    </AppShell>
  );
};

const emojiOptions = ["💧","🏋️","📚","🧘","🏃","🥗","💤","✍️","🎯","🌱"];

const NewHabitDialog = ({ onCreate }: { onCreate: (h: Omit<Habit, "id" | "createdAt" | "history">) => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💧");
  const [target, setTarget] = useState(7);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:shadow-glow"><Plus className="w-4 h-4 mr-1" />Add Habit</Button>
      </DialogTrigger>
      <DialogContent className="glass border-border/40">
        <DialogHeader><DialogTitle className="font-display">New Habit</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meditate" autoFocus />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pick an emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {emojiOptions.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn("w-10 h-10 rounded-lg text-xl transition-bounce", emoji === e ? "bg-primary/15 ring-2 ring-primary scale-110" : "bg-muted hover:bg-primary/10")}
                >{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Target per week</label>
            <Input type="number" min={1} max={7} value={target} onChange={(e) => setTarget(Math.min(7, Math.max(1, +e.target.value || 7)))} />
          </div>
          <Button
            className="w-full bg-gradient-primary hover:shadow-glow"
            disabled={!name.trim()}
            onClick={() => { onCreate({ name: name.trim(), emoji, color: "primary", targetPerWeek: target }); setOpen(false); setName(""); }}
          >Create habit</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HabitsPage;
