import { NavLink } from "react-router-dom";
import { Home, ListChecks, Timer, Trophy, Sparkles, Settings, CalendarDays, Activity, BarChart3, Network, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/tasks", icon: ListChecks, label: "Tasks" },
  { to: "/focus", icon: Timer, label: "Focus" },
  { to: "/habits", icon: Activity, label: "Habits" },
  { to: "/life", icon: Compass, label: "Cross-Life" },
  { to: "/coach", icon: Sparkles, label: "AI Coach" },
];

export const Sidebar = () => {
  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-20 lg:w-24 flex-col items-center justify-between py-6 z-30">
      <div className="flex flex-col items-center gap-2">
        <NavLink
          to="/"
          className="w-12 h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-display font-bold text-xl flex items-center justify-center shadow-elevated hover:scale-105 transition-bounce"
        >
          F
        </NavLink>
        <nav className="mt-4 flex flex-col gap-1.5">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "group relative w-12 h-12 rounded-xl flex items-center justify-center transition-smooth",
                  "hover:bg-primary/10 hover:text-primary",
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5" strokeWidth={2} />
                  {isActive && (
                    <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-primary" />
                  )}
                  <span className="absolute left-full ml-3 px-2 py-1 rounded-md text-xs font-medium bg-popover text-popover-foreground shadow-elevated opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-smooth z-50">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-smooth hover:bg-primary/10 hover:text-primary",
            isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
          )
        }
        aria-label="Settings"
      >
        <Settings className="w-5 h-5" />
      </NavLink>
    </aside>
  );
};
