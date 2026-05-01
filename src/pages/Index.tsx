import { getISTDate } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { PeakHourCard, LevelCard } from "@/components/dashboard/SideCards";
import { TodayTasks } from "@/components/dashboard/TodayTasks";
import { QuickHealth } from "@/components/dashboard/QuickHealth";
import { HabitsStrip } from "@/components/dashboard/HabitsStrip";
import { LifeBalanceRadar } from "@/components/dashboard/LifeBalanceRadar";
import { format } from "date-fns";

const Dashboard = () => {
  return (
    <AppShell>
      <TopBar
        eyebrow="Dashboard"
        title="Good to see you."
        subtitle={format(getISTDate(), "EEEE, MMMM d")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-8">
          <HeroCard />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-4">
          <PeakHourCard />
          <LevelCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 mt-4 md:mt-5">
        <div className="lg:col-span-4">
          <LifeBalanceRadar />
        </div>
        <div className="lg:col-span-8">
          <TodayTasks />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 mt-4 md:mt-5">
        <div className="lg:col-span-8">
          <QuickHealth />
        </div>
        <div className="lg:col-span-4">
          <HabitsStrip />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 md:gap-5 mt-4 md:mt-5">
        <div className="glass-card flex flex-col md:flex-row items-center justify-between gap-6 p-8">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Intelligence Layer</p>
            <h2 className="text-2xl font-display font-bold mt-1">AI Flow Coach</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              The Cross-Life OS is analyzing your patterns across 8 branches. 
              Based on your Focus levels and Health ritual consistency, I've prepared a custom optimization plan.
            </p>
          </div>
          <a
            href="/coach"
            className="w-full md:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold shadow-glow hover:scale-105 transition-bounce whitespace-nowrap"
          >
            Open Coach Insights →
          </a>
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
