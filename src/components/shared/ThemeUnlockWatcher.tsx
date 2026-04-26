import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  applyTheme,
  getUnseenUnlocks,
  markUnlockSeen,
  type ThemeMeta,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";

/**
 * Watches XP totals and pops a celebratory modal whenever a new theme
 * crosses its unlock threshold. Mount once near the app root.
 */
export const ThemeUnlockWatcher = () => {
  const totalXP = useAppStore((s) => s.totalXP);
  const [queue, setQueue] = useState<ThemeMeta[]>([]);

  useEffect(() => {
    const unseen = getUnseenUnlocks(totalXP);
    if (unseen.length > 0) setQueue((q) => [...q, ...unseen.filter((u) => !q.find((x) => x.id === u.id))]);
  }, [totalXP]);

  const current = queue[0];

  const dismiss = () => {
    if (!current) return;
    markUnlockSeen(current.id);
    setQueue((q) => q.slice(1));
  };

  const apply = () => {
    if (!current) return;
    applyTheme(current.id);
    markUnlockSeen(current.id);
    setQueue((q) => q.slice(1));
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-foreground/40 backdrop-blur-sm p-6"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl bg-card p-8 shadow-elevated border border-border/40 overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: current.swatch }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Theme unlocked
              </div>
              <h2 className="mt-4 text-3xl font-display font-bold">{current.label}</h2>
              <p className="text-muted-foreground mt-1">{current.description}</p>

              <div
                className="mt-5 h-24 rounded-2xl border border-border/40 shadow-glass"
                style={{ background: current.swatch }}
              />

              <p className="mt-4 text-xs text-muted-foreground">
                Reached level {current.unlockLevel}. New themes await as you climb.
              </p>

              <div className="mt-6 flex gap-2">
                <Button onClick={apply} className="flex-1 bg-gradient-primary">
                  <Check className="w-4 h-4 mr-1" /> Apply now
                </Button>
                <Button onClick={dismiss} variant="outline" className="flex-1">
                  Maybe later
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
