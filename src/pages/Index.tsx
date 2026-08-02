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
import { Brain } from "lucide-react";
import { useAppStore } from "@/lib/store";

const Dashboard = () => {
  const hellMode = useAppStore((s) => s.hellMode);
  const mindDevMode = useAppStore((s) => s.mindDevMode);
  const userName = useAppStore((s) => s.userName);

  return (
    <AppShell>
      <TopBar
        eyebrow="Dashboard"
        title={
          hellMode 
            ? `THE TRIAL HAS BEGUN, ${userName.toUpperCase()}.` 
            : `Good to see you, ${userName}.`
        }
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
        <div className="glass-card flex flex-col md:flex-row items-center justify-between gap-6 p-8 relative overflow-hidden">
          {hellMode ? (
            <>
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="flex-1 relative z-10">
                <p className="text-xs uppercase tracking-widest text-red-500 font-bold drop-shadow-sm">The Adversary</p>
                <h2 className="text-3xl font-display font-bold mt-1 text-red-100 drop-shadow-sm">I WATCH YOU FALL.</h2>
                <p className="text-red-200/80 mt-2 max-w-2xl leading-relaxed">
                  Your complacency is a disease. The Drill Sergeant has taken over your OS. 
                  Every misstep is tracked. Miss your targets, and suffer the consequences.
                </p>
              </div>
              <a
                href="/coach"
                className="relative z-10 w-full md:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-red-950/80 text-red-400 border border-red-500/50 hover:bg-red-900 transition-smooth font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] whitespace-nowrap"
              >
                Face Judgment →
              </a>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
