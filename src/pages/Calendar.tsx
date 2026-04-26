import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Zap } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const CalendarPage = () => {
  const tasks = useAppStore((s) => s.tasks);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const k = t.dueDate.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return map;
  }, [tasks]);

  const selectedTasks = tasksByDay.get(format(selected, "yyyy-MM-dd")) ?? [];

  return (
    <AppShell>
      <TopBar eyebrow="Planning" title="Calendar" subtitle="Monthly view with task signals." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FadeIn className="glass-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-display font-bold">{format(cursor, "MMMM yyyy")}</h2>
            <div className="flex gap-1">
              <button onClick={() => setCursor(subMonths(cursor, 1))} className="w-9 h-9 rounded-lg glass hover:bg-primary/10 transition-smooth flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setCursor(new Date())} className="px-3 h-9 rounded-lg glass hover:bg-primary/10 transition-smooth text-sm font-medium">Today</button>
              <button onClick={() => setCursor(addMonths(cursor, 1))} className="w-9 h-9 rounded-lg glass hover:bg-primary/10 transition-smooth flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center text-[10px] uppercase tracking-widest text-muted-foreground font-semibold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(k) ?? [];
              const inMonth = isSameMonth(d, cursor);
              const isSel = isSameDay(d, selected);
              return (
                <button
                  key={k}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition-smooth relative p-1",
                    !inMonth && "opacity-30",
                    isSel ? "bg-gradient-primary text-primary-foreground shadow-elevated" : "hover:bg-primary/10",
                    isToday(d) && !isSel && "ring-1 ring-primary/40",
                  )}
                >
                  <span className={cn("text-sm font-semibold", isToday(d) && !isSel && "text-primary")}>{format(d, "d")}</span>
                  {dayTasks.length > 0 && (
                    <div className="flex gap-0.5">
                      {dayTasks.slice(0, 3).map((t) => (
                        <span key={t.id} className={cn("w-1 h-1 rounded-full", isSel ? "bg-primary-foreground" : "bg-primary")} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </FadeIn>

        <FadeIn delay={0.1} className="glass-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Selected day</p>
              <h2 className="text-xl font-display font-bold mt-1">{format(selected, "EEEE, MMM d")}</h2>
            </div>
            <Chip tone="primary">{selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"}</Chip>
          </div>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((t) => (
                <li key={t.id} className={cn("p-3 rounded-xl border border-border/40", t.completed && "opacity-60")}>
                  <p className={cn("font-medium text-sm", t.completed && "line-through")}>{t.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="capitalize">{t.priority}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{t.durationMin}m</span>
                    <span className="inline-flex items-center gap-1 text-primary"><Zap className="w-3 h-3" />{t.xp}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FadeIn>
      </div>
    </AppShell>
  );
};

export default CalendarPage;
