import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SectionTitle = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      {eyebrow && <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{eyebrow}</p>}
      <h2 className="text-xl md:text-2xl font-display font-bold mt-1">{title}</h2>
    </div>
    {action}
  </div>
);

export const Chip = ({ children, tone = "primary", className }: { children: ReactNode; tone?: "primary" | "accent" | "warning" | "success" | "muted" | "destructive"; className?: string }) => {
  const tones = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    muted: "bg-muted text-muted-foreground",
    destructive: "bg-destructive/15 text-destructive",
  };
  return <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold", tones[tone], className)}>{children}</span>;
};

export const FadeIn = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.4, 0, 0.2, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);
