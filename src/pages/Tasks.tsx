import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Trash2, Calendar as CalIcon, Check, Clock, Zap, Filter } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore, type Priority, type TaskCategory, type Task } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const priorities: Priority[] = ["low", "medium", "high", "urgent"];
const categories: TaskCategory[] = ["work", "personal", "health", "learning", "other"];

const priorityChip: Record<Priority, "muted" | "accent" | "warning" | "destructive"> = {
  low: "muted", medium: "accent", high: "warning", urgent: "destructive",
};

const TasksPage = () => {
  const { tasks, addTask, toggleTask, removeTask } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      return true;
    });
  }, [tasks, search, filterPriority, filterCategory]);

  const open = filtered.filter((t) => !t.completed);
  const done = filtered.filter((t) => t.completed);

  return (
    <AppShell>
      <TopBar eyebrow="Plan" title="Tasks" subtitle="Capture, prioritize, and ship." />

      <FadeIn className="glass-card mb-5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="pl-9 bg-background/60 border-border/60"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Priority | "all")}>
            <SelectTrigger className="w-36 bg-background/60"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              {priorities.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as TaskCategory | "all")}>
            <SelectTrigger className="w-36 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <NewTaskDialog onCreate={(t) => { addTask(t); toast.success("Task created"); }} />
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FadeIn delay={0.05} className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold">Open <span className="text-muted-foreground font-sans font-medium">({open.length})</span></h2>
            <Chip tone="primary">Active</Chip>
          </div>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {open.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No open tasks. Add one above.</p>
              ) : open.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t.id)} onRemove={() => { removeTask(t.id); toast("Task removed"); }} />
              ))}
            </AnimatePresence>
          </ul>
        </FadeIn>

        <FadeIn delay={0.1} className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold">Completed <span className="text-muted-foreground font-sans font-medium">({done.length})</span></h2>
            <Chip tone="success">Done</Chip>
          </div>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {done.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Completed tasks will appear here.</p>
              ) : done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t.id)} onRemove={() => { removeTask(t.id); toast("Task removed"); }} />
              ))}
            </AnimatePresence>
          </ul>
        </FadeIn>
      </div>
    </AppShell>
  );
};

const TaskRow = ({ task, onToggle, onRemove }: { task: Task; onToggle: () => void; onRemove: () => void }) => (
  <motion.li
    layout
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 10 }}
    className={cn("group flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-smooth", task.completed && "opacity-70")}
  >
    <button
      onClick={onToggle}
      className={cn(
        "w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-bounce",
        task.completed ? "bg-gradient-primary border-transparent text-primary-foreground" : "border-border hover:border-primary",
      )}
    >
      {task.completed && <Check className="w-4 h-4" strokeWidth={3} />}
    </button>
    <div className="flex-1 min-w-0">
      <p className={cn("font-medium text-sm truncate", task.completed && "line-through")}>{task.title}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
        <Chip tone={priorityChip[task.priority]} className="!py-0">{task.priority}</Chip>
        <span className="capitalize">{task.category}</span>
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{task.durationMin}m</span>
        {task.dueDate && <span className="inline-flex items-center gap-1"><CalIcon className="w-3 h-3" />{format(new Date(task.dueDate), "MMM d")}</span>}
      </div>
    </div>
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Zap className="w-3 h-3" />{task.xp}</span>
    <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth" aria-label="Delete">
      <Trash2 className="w-4 h-4" />
    </button>
  </motion.li>
);

const NewTaskDialog = ({ onCreate }: { onCreate: (t: { title: string; priority: Priority; category: TaskCategory; durationMin: number; dueDate?: string; notes?: string }) => void }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<TaskCategory>("work");
  const [durationMin, setDurationMin] = useState(25);
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");

  const reset = () => { setTitle(""); setPriority("medium"); setCategory("work"); setDurationMin(25); setDueDate(new Date()); setNotes(""); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:shadow-glow transition-smooth"><Plus className="w-4 h-4 mr-1" />Add Task</Button>
      </DialogTrigger>
      <DialogContent className="glass border-border/40">
        <DialogHeader><DialogTitle className="font-display">New Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{priorities.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Duration (min)</label>
              <Input type="number" min={5} step={5} value={durationMin} onChange={(e) => setDurationMin(Math.max(5, +e.target.value || 25))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Due date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalIcon className="w-4 h-4 mr-2" />
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePicker mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} />
          <Button
            className="w-full bg-gradient-primary hover:shadow-glow"
            disabled={!title.trim()}
            onClick={() => {
              onCreate({
                title: title.trim(), priority, category, durationMin,
                dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
                notes: notes.trim() || undefined,
              });
              setOpen(false); reset();
            }}
          >
            Create task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TasksPage;
