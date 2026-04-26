import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { FadeIn } from "@/components/shared/UI";
import { useAppStore } from "@/lib/store";
import {
  BRANCH_META,
  BRANCH_PERKS,
  type Branch,
  branchLevelFromXp,
  nextPerk,
} from "@/lib/gamification";
import { motion } from "framer-motion";
import { Lock, Sparkles, Check } from "lucide-react";
import { useMemo } from "react";

const BRANCHES: Branch[] = ["focus", "health", "learning", "craft"];

const SkillTree = () => {
  const xpHistory = useAppStore((s) => s.xpHistory);

  const xpByBranch = useMemo(() => {
    const totals: Record<Branch, number> = { focus: 0, health: 0, learning: 0, craft: 0 };
    for (const e of xpHistory) totals[e.branch] = (totals[e.branch] ?? 0) + e.amount;
    return totals;
  }, [xpHistory]);

  const overall = useMemo(() => {
    const sum = BRANCHES.reduce((acc, b) => acc + branchLevelFromXp(xpByBranch[b]).level, 0);
    return Math.round((sum / BRANCHES.length) * 10) / 10;
  }, [xpByBranch]);

  const totalEvents = xpHistory.length;

  return (
    <AppShell>
      <TopBar
        eyebrow="Progression"
        title="Skill Tree"
        subtitle="Every action you take routes XP into one of four branches. Level them up, unlock perks."
      />

      {/* Overall summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-6">
        <FadeIn className="md:col-span-2 glass-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Overall</p>
          <div className="flex items-end gap-3 mt-1">
            <span className="number-display text-5xl md:text-6xl gradient-text">{overall}</span>
            <span className="text-sm text-muted-foreground mb-2">avg branch level</span>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {totalEvents === 0
              ? "Complete tasks, hit habits, or finish a focus session to start earning branch XP."
              : `${totalEvents} XP events recorded · ${Object.values(xpByBranch).reduce((a, b) => a + b, 0)} total branch XP`}
          </p>
        </FadeIn>
        <FadeIn delay={0.05} className="glass-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">How routing works</p>
          <ul className="mt-2 text-sm space-y-1.5 text-muted-foreground">
            <li><span className="font-semibold text-foreground">⚡ Focus</span> — work tasks, Pomodoros</li>
            <li><span className="font-semibold text-foreground">🌱 Health</span> — health tasks, water, mood, workouts</li>
            <li><span className="font-semibold text-foreground">📚 Learning</span> — learning tasks, reading habits</li>
            <li><span className="font-semibold text-foreground">🎨 Craft</span> — personal &amp; creative</li>
          </ul>
        </FadeIn>
      </div>

      {/* Branch grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {BRANCHES.map((branch, idx) => (
          <BranchCard key={branch} branch={branch} xp={xpByBranch[branch]} delay={idx * 0.05} />
        ))}
      </div>
    </AppShell>
  );
};

const BranchCard = ({ branch, xp, delay }: { branch: Branch; xp: number; delay: number }) => {
  const meta = BRANCH_META[branch];
  const info = branchLevelFromXp(xp);
  const perks = BRANCH_PERKS[branch];
  const upcoming = nextPerk(branch, info.level);

  const tone = meta.tone as "primary" | "accent" | "warning" | "success";
  const ringColor = {
    primary: "from-primary to-primary-glow",
    accent: "from-accent to-primary",
    warning: "from-warning to-destructive",
    success: "from-success to-accent",
  }[tone];

  return (
    <FadeIn delay={delay}>
      <div className="glass-card h-full flex flex-col">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-2xl">
              {meta.emoji}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Branch</p>
              <h3 className="text-xl font-display font-bold">{meta.label}</h3>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Level</p>
            <p className={`number-display text-3xl bg-gradient-to-br ${ringColor} bg-clip-text text-transparent`}>
              {info.level}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{info.xpInLevel} / {info.xpForNext - info.xpForCurrent} XP</span>
            <span>{info.xpToNext} to L{info.level + 1}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(info.progress * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className={`h-full bg-gradient-to-r ${ringColor}`}
            />
          </div>
        </div>

        {/* Perks */}
        <div className="mt-5 space-y-2">
          {perks.map((perk) => {
            const unlocked = info.level >= perk.level;
            const isNext = upcoming?.level === perk.level;
            return (
              <div
                key={perk.level}
                className={`rounded-xl p-3 border transition-smooth ${
                  unlocked
                    ? "bg-primary/5 border-primary/20"
                    : isNext
                      ? "bg-muted/40 border-border"
                      : "bg-muted/20 border-border opacity-70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                      unlocked ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {unlocked ? <Check className="w-4 h-4" /> : isNext ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{perk.label}</p>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground shrink-0">
                        L{perk.level}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{perk.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </FadeIn>
  );
};

export default SkillTree;
