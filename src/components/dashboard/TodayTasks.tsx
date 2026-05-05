import { getISTTodayStr } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppStore, type Task, type Priority } from "@/lib/store";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const priorityColor: Record<Priority, string> = {
  low: "bg-muted-foreground/20 text-muted-foreground",
  medium: "bg-accent/15 text-accent",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export const TodayTasks = () => {
  const tasks = useAppStore((s) => s.tasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const hellMode = useAppStore((s) => s.hellMode);
  const todayStr = getISTTodayStr();
  const todays = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr)).slice(0, 6);
  const done = todays.filter((t) => t.completed).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card"
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {hellMode ? "Today's Focus" : "Priority Queue"}
          </p>
          <h2 className={cn("text-2xl font-display font-bold mt-1", hellMode && "text-red-500 tracking-wider")}>
            {hellMode ? "UNFORGIVING BURDENS" : "Today's Focus"}
          </h2>
          {hellMode && <p className="text-xs text-red-500/80 mt-1 uppercase tracking-widest font-bold">Fail at your own risk. ({todays.length - done}/{todays.length} Tasks Overdue)</p>}
        </div>
        {!hellMode && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-success/15 text-success">
            {done}/{todays.length} done
          </span>
        )}
      </div>

      {todays.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {todays.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t.id)} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Link
        to="/tasks"
        className="mt-5 block w-full text-center py-2.5 rounded-xl border border-border/60 hover:bg-primary/5 hover:border-primary/30 transition-smooth text-sm font-medium text-foreground/80"
      >
        View all tasks →
      </Link>
    </motion.section>
  );
};

const TaskRow = ({ task, onToggle }: { task: Task; onToggle: () => void }) => (
  <motion.li
    layout
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 10 }}
    className={cn(
      "group flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-smooth",
      task.completed && "opacity-60",
    )}
  >
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-bounce",
        task.completed
          ? "bg-gradient-primary border-transparent text-primary-foreground scale-110"
          : "border-border hover:border-primary",
      )}
      aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
    >
      {task.completed && <Check className="w-4 h-4" strokeWidth={3} />}
    </button>
    <div className="flex-1 min-w-0">
      <p className={cn("font-medium text-sm truncate", task.completed && "line-through", document.body.classList.contains("hell-mode") && "text-red-300 font-creepster tracking-widest text-lg")}>{task.title}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
        {document.body.classList.contains("hell-mode") ? (
           <span className="text-red-500 font-bold uppercase tracking-widest bg-red-950/50 px-2 py-0.5 rounded border border-red-500/30">EXPIRED</span>
        ) : (
          <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase", priorityColor[task.priority])}>
            {task.priority}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> {task.durationMin}m
        </span>
      </div>
    </div>
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
      <Zap className="w-3 h-3" /> {task.xp}
    </span>
  </motion.li>
);

const EmptyState = () => (
  <div className="text-center py-8">
    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary/10 flex items-center justify-center mb-3">
      <Check className="w-7 h-7 text-primary" />
    </div>
    <p className="font-semibold">All clear for today</p>
    <p className="text-sm text-muted-foreground mt-1">Add tasks to fill your queue.</p>
  </div>
);
