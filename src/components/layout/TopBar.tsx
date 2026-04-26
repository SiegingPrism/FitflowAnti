import { Moon, Sun, Bell, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/lib/store";

export const TopBar = ({ title, eyebrow, subtitle }: { title: string; eyebrow?: string; subtitle?: string }) => {
  const [theme, setTheme] = useTheme();
  const userName = useAppStore((s) => s.userName);

  // Toggle only flips between the two free themes; unlocked themes are
  // chosen from Settings. Any custom theme leaves the toggle as a "go dark" hint.
  const toggle = () => {
    if (theme === "light") setTheme("dark");
    else setTheme("light");
  };
  const showSun = theme !== "light";

  return (
    <header className="flex items-start justify-between gap-4 mb-6 animate-fade-in-up">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80 mb-1.5">{eyebrow}</p>
        )}
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1.5 text-sm md:text-base">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:scale-105 transition-bounce text-foreground"
          aria-label="Toggle theme"
        >
          {showSun ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <Link
          to="/calendar"
          className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:scale-105 transition-bounce text-foreground"
          aria-label="Calendar"
        >
          <CalendarDays className="w-4 h-4" />
        </Link>
        <button
          className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:scale-105 transition-bounce text-foreground"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>
        <Link
          to="/settings"
          className="w-10 h-10 rounded-xl bg-gradient-primary text-primary-foreground font-display font-semibold flex items-center justify-center shadow-elevated hover:scale-105 transition-bounce"
          aria-label="Profile"
        >
          {userName.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
};
