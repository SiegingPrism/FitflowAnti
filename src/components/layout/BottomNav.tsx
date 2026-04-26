import { NavLink } from "react-router-dom";
import { Home, ListChecks, Timer, Sparkles, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/tasks", icon: ListChecks, label: "Tasks" },
  { to: "/life", icon: Compass, label: "Life" },
  { to: "/focus", icon: Timer, label: "Focus" },
  { to: "/coach", icon: Sparkles, label: "AI" },
];

export const BottomNav = () => (
  <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 glass rounded-3xl px-2 py-2 flex items-center justify-around shadow-elevated">
    {items.map(({ to, icon: Icon, label }, i) => {
      const isCenter = i === Math.floor(items.length / 2);
      return (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-smooth text-[10px] font-semibold uppercase tracking-wider",
              isActive
                ? "text-primary-foreground bg-gradient-primary shadow-glow"
                : "text-muted-foreground hover:text-foreground",
              isCenter && "scale-110",
            )
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      );
    })}
  </nav>
);
