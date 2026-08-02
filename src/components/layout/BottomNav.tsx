import { NavLink } from "react-router-dom";
import { Home, ListChecks, Timer, Sparkles, Compass, Brain, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/tasks", icon: ListChecks, label: "Tasks" },
  { to: "/import", icon: Clipboard, label: "Import" },
  { to: "/life", icon: Compass, label: "Life" },
  { to: "/coach", icon: Sparkles, label: "AI" },
];

export const BottomNav = () => {
  const { user } = useAuth();
  const isDeveloper = user?.email === "dev@fitflow.app" || user?.email === "ishanibassin@gmail.com";

  const navItems = isDeveloper
    ? [...items, { to: "/mind-developer", icon: Brain, label: "Mind" }]
    : items;

  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 glass rounded-3xl px-2 py-2 flex items-center justify-around shadow-elevated">
      {navItems.map(({ to, icon: Icon, label }, i) => {
        const isCenter = i === Math.floor(navItems.length / 2);
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
};
