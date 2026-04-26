import { useEffect, useState } from "react";
import { Download, Upload, Trash2, User, Lock, Check, Beaker, ShieldCheck, AlertTriangle, LogOut, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Chip, FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import { isThemeUnlocked, THEMES, type Theme, verifyThemeApplied, type ThemeHealthReport } from "@/lib/theme";
import { useTheme } from "@/hooks/use-theme";
import { levelFromXp } from "@/lib/gamification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SettingsPage = () => {
  const { userName, setUserName, totalXP, tasks, habits, focusSessions, healthLogs, xpHistory, grantDebugXp, logFocusSession, clearLocal } = useAppStore();
  const { user, signOut } = useAuth();
  const [name, setName] = useState(userName);
  const [theme, setTheme] = useTheme();
  const userLevel = levelFromXp(totalXP).level;
  const [health, setHealth] = useState<ThemeHealthReport | null>(null);

  // Re-run the runtime check whenever the theme changes — gives an instant
  // visual confirmation that the right class landed on <html>.
  useEffect(() => {
    // wait one frame so the DOM mutation lands before we read it
    const id = requestAnimationFrame(() => setHealth(verifyThemeApplied(theme)));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ tasks, habits, focusSessions, healthLogs, xpHistory, totalXP, userName }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `flowsphere-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    toast.error("Import is no longer supported now that data syncs to the cloud. Use Export to keep a backup.");
    e.target.value = "";
  };

  const resetAll = async () => {
    if (!user) return;
    if (!confirm("This will permanently erase all your tasks, habits, focus sessions, and progress. Continue?")) return;
    try {
      await Promise.all([
        supabase.from("tasks").delete().eq("user_id", user.id),
        supabase.from("habits").delete().eq("user_id", user.id),
        supabase.from("focus_sessions").delete().eq("user_id", user.id),
        supabase.from("health_logs").delete().eq("user_id", user.id),
        supabase.from("xp_events").delete().eq("user_id", user.id),
        supabase.from("profiles").update({ total_xp: 0, onboarded_at: null, primary_goal: null }).eq("user_id", user.id),
      ]);
      clearLocal();
      localStorage.removeItem("flowsphere-store");
      toast.success("Reset complete. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset data.");
    }
  };

  const switchTheme = (t: Theme) => {
    if (!isThemeUnlocked(t, totalXP)) {
      const meta = THEMES.find((m) => m.id === t)!;
      toast.error(`${meta.label} unlocks at level ${meta.unlockLevel}. You're level ${userLevel}.`);
      return;
    }
    setTheme(t);
    toast.success(`Theme: ${THEMES.find((m) => m.id === t)?.label}`);
  };

  return (
    <AppShell>
      <TopBar eyebrow="You" title="Settings" subtitle="Profile, theme, and data." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FadeIn className="glass-card">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary text-primary-foreground font-display font-bold text-2xl flex items-center justify-center shadow-elevated">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Profile</p>
              <h2 className="text-xl font-display font-bold">{userName}</h2>
              <Chip tone="primary" className="mt-1">{totalXP} XP</Chip>
            </div>
          </div>
          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><User className="w-3 h-3" /> Display name</label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
            <Button onClick={() => { setUserName(name.trim() || "Friend"); toast.success("Name updated"); }} className="bg-gradient-primary">Save</Button>
          </div>
          {user?.email && (
            <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Signed in as</p>
                <p className="text-sm font-medium truncate">{user.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
              </Button>
            </div>
          )}
        </FadeIn>

        <FadeIn delay={0.05} className="glass-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Appearance</p>
            <Chip tone="muted">Level {userLevel}</Chip>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map((m) => {
              const unlocked = isThemeUnlocked(m.id, totalXP);
              const active = theme === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => switchTheme(m.id)}
                  className={cn(
                    "relative p-3 rounded-xl border-2 transition-smooth flex flex-col items-start gap-2 text-left overflow-hidden group",
                    active ? "border-primary shadow-glow" : "border-border/40 hover:border-primary/30",
                    !unlocked && "opacity-60",
                  )}
                >
                  <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: m.swatch }} />
                  <div className="relative w-full h-10 rounded-lg border border-border/30" style={{ background: m.swatch }} />
                  <div className="relative flex items-center justify-between w-full">
                    <span className="text-sm font-semibold">{m.label}</span>
                    {active ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : !unlocked ? (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : null}
                  </div>
                  <p className="relative text-[10px] text-muted-foreground leading-tight">
                    {unlocked ? m.description : `Unlocks at level ${m.unlockLevel}`}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Runtime theme health indicator — verifies the right class landed on <html> */}
          {health && (
            <div
              className={cn(
                "mt-4 rounded-xl border p-3 flex items-start gap-3 transition-smooth",
                health.ok
                  ? "border-success/30 bg-success/5"
                  : "border-destructive/40 bg-destructive/5",
              )}
              role="status"
              aria-live="polite"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  health.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                )}
              >
                {health.ok ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-foreground">
                  {health.ok ? "Theme verified" : "Theme out of sync"}
                </p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  {health.ok ? (
                    <>
                      Class <code className="font-mono text-foreground/90">
                        {theme === "light" ? "light" : theme === "dark" ? "dark" : `dark theme-${theme}`}
                      </code>{" "}
                      mounted on <code className="font-mono text-foreground/90">&lt;html&gt;</code>. Stored:{" "}
                      <code className="font-mono text-foreground/90">{health.storedValue}</code>.
                    </>
                  ) : (
                    <>{health.issues.join(" · ")}</>
                  )}
                </p>
              </div>
              <Chip tone={health.ok ? "success" : "destructive"}>
                {health.ok ? "OK" : `${health.issues.length} issue${health.issues.length === 1 ? "" : "s"}`}
              </Chip>
            </div>
          )}
        </FadeIn>

        <FadeIn delay={0.1} className="glass-card lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Your data</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Tasks" value={tasks.length} />
            <Stat label="Habits" value={habits.length} />
            <Stat label="Focus sessions" value={focusSessions.length} />
            <Stat label="Health logs" value={healthLogs.length} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}><Download className="w-4 h-4 mr-1" />Export</Button>
            <label>
              <input type="file" accept="application/json" className="hidden" onChange={importData} />
              <Button variant="outline" asChild><span className="cursor-pointer"><Upload className="w-4 h-4 mr-1" />Import</span></Button>
            </label>
            <Button variant="destructive" onClick={resetAll} className="ml-auto"><Trash2 className="w-4 h-4 mr-1" />Reset all data</Button>
          </div>
        </FadeIn>

        {import.meta.env.DEV && (
          <FadeIn delay={0.13} className="glass-card lg:col-span-2 border-warning/40 border-2 border-dashed bg-warning/5">
            <div className="flex items-center gap-2 mb-2">
              <Beaker className="w-4 h-4 text-warning" />
              <p className="text-xs uppercase tracking-wider text-warning font-bold">Dev tools</p>
              <Chip tone="warning">Hidden in production</Chip>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Quick XP grants for testing the level curve and theme unlocks. Aurora unlocks at L3 (540 XP), Carbon at L7 (2940 XP), Solar at L12 (8640 XP).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const needed = Math.max(0, 540 - totalXP);
                  if (needed === 0) { toast.info(`Already at level ${userLevel}.`); return; }
                  grantDebugXp(needed, "Debug: jump to L3");
                  toast.success(`+${needed} XP → level 3 (Aurora unlocked)`);
                }}
              >
                Jump to L3 (Aurora)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const needed = Math.max(0, 2940 - totalXP);
                  if (needed === 0) { toast.info(`Already at level ${userLevel}.`); return; }
                  grantDebugXp(needed, "Debug: jump to L7");
                  toast.success(`+${needed} XP → level 7 (Carbon unlocked)`);
                }}
              >
                Jump to L7 (Carbon)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const needed = Math.max(0, 8640 - totalXP);
                  if (needed === 0) { toast.info(`Already at level ${userLevel}.`); return; }
                  grantDebugXp(needed, "Debug: jump to L12");
                  toast.success(`+${needed} XP → level 12 (Solar unlocked)`);
                }}
              >
                Jump to L12 (Solar)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  grantDebugXp(100, "Debug: +100 XP");
                  toast.success("+100 XP");
                }}
              >
                +100 XP
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logFocusSession({ durationMin: 25 });
                  toast.success("Logged a 25-minute focus session");
                }}
              >
                Log 25m focus
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem("flowsphere-unlocked-themes-seen");
                  toast.success("Unlock celebrations reset — refresh to re-trigger modals.");
                }}
              >
                Reset unlock modals
              </Button>
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.15} className="glass-card lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">About</p>
          <h3 className="text-lg font-display font-bold">FlowSphere</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your productivity, beautifully tracked. Tasks, focus, habits, wellbeing, and an AI coach — all local-first, all yours.
          </p>
        </FadeIn>
      </div>
    </AppShell>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="p-3 rounded-xl bg-muted/40">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="number-display text-xl mt-0.5">{value}</p>
  </div>
);

export default SettingsPage;
