import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { PeakHourCard, LevelCard } from "@/components/dashboard/SideCards";
import { TodayTasks } from "@/components/dashboard/TodayTasks";
import { QuickHealth } from "@/components/dashboard/QuickHealth";
import { HabitsStrip } from "@/components/dashboard/HabitsStrip";
import { format } from "date-fns";

const Dashboard = () => {
  return (
    <AppShell>
      <TopBar
        eyebrow="Dashboard"
        title="Good to see you."
        subtitle={format(new Date(), "EEEE, MMMM d")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <HeroCard />
        <div className="flex flex-col gap-4 md:gap-5">
          <PeakHourCard />
          <LevelCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mt-4 md:mt-5">
        <div className="lg:col-span-2">
          <TodayTasks />
        </div>
        <HabitsStrip />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mt-4 md:mt-5">
        <div className="lg:col-span-2">
          <QuickHealth />
        </div>
        <div className="glass-card flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Smart Layer</p>
            <h2 className="text-xl font-display font-bold mt-1">AI Coach</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Adaptive suggestions powered by your patterns. Open the coach to see today's nudge.
            </p>
          </div>
          <a
            href="/coach"
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-elevated hover:shadow-glow transition-smooth"
          >
            Open coach →
          </a>
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
