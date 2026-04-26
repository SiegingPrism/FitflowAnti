import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ALL_THEME_IDS,
  getThemeConfig,
  THEME_CONFIGS,
  type ThemeConfig,
  type ThemeId,
} from "@/lib/themes.config";

const STORAGE_KEY = "flowsphere-theme";

// camelCase token name → CSS variable name
const TOKEN_VARS: Array<[keyof ThemeConfig["tokens"], string]> = [
  ["background", "--background"],
  ["foreground", "--foreground"],
  ["card", "--card"],
  ["cardForeground", "--card-foreground"],
  ["popover", "--popover"],
  ["popoverForeground", "--popover-foreground"],
  ["primary", "--primary"],
  ["primaryForeground", "--primary-foreground"],
  ["primaryGlow", "--primary-glow"],
  ["secondary", "--secondary"],
  ["secondaryForeground", "--secondary-foreground"],
  ["muted", "--muted"],
  ["mutedForeground", "--muted-foreground"],
  ["accent", "--accent"],
  ["accentForeground", "--accent-foreground"],
  ["success", "--success"],
  ["successForeground", "--success-foreground"],
  ["warning", "--warning"],
  ["warningForeground", "--warning-foreground"],
  ["destructive", "--destructive"],
  ["destructiveForeground", "--destructive-foreground"],
  ["border", "--border"],
  ["input", "--input"],
  ["ring", "--ring"],
  ["sidebarBackground", "--sidebar-background"],
  ["sidebarForeground", "--sidebar-foreground"],
  ["sidebarPrimary", "--sidebar-primary"],
  ["sidebarPrimaryForeground", "--sidebar-primary-foreground"],
  ["sidebarAccent", "--sidebar-accent"],
  ["sidebarAccentForeground", "--sidebar-accent-foreground"],
  ["sidebarBorder", "--sidebar-border"],
  ["sidebarRing", "--sidebar-ring"],
];

/**
 * Apply a theme's tokens to <html> as CSS variables. This is the *only*
 * place that touches DOM styles for theming — components stay pure.
 */
const injectTheme = (cfg: ThemeConfig) => {
  const root = document.documentElement;

  // Maintain class identity for shadcn dark-mode utilities + scoping
  for (const id of ALL_THEME_IDS) root.classList.remove(`theme-${id}`);
  root.classList.remove("light", "dark");
  root.classList.add(cfg.scheme);
  root.classList.add(`theme-${cfg.id}`);
  root.style.colorScheme = cfg.scheme;

  // Tokens
  for (const [key, cssVar] of TOKEN_VARS) {
    root.style.setProperty(cssVar, cfg.tokens[key]);
  }

  // Gradients + lighting
  root.style.setProperty("--gradient-primary", cfg.gradients.primary);
  root.style.setProperty("--gradient-accent", cfg.gradients.accent);
  root.style.setProperty("--gradient-warm", cfg.gradients.warm);
  root.style.setProperty("--gradient-mesh", cfg.gradients.mesh);

  root.style.setProperty("--glass-bg", cfg.lighting.glassBg);
  root.style.setProperty("--glass-border", cfg.lighting.glassBorder);
  root.style.setProperty("--glass-shadow", cfg.lighting.glassShadow);
  root.style.setProperty("--shadow-glow", cfg.lighting.shadowGlow);
  root.style.setProperty("--shadow-elevated", cfg.lighting.shadowElevated);
  root.style.setProperty("--shadow-glass", cfg.lighting.shadowGlass);

  // Expose the animation kind so non-React surfaces can read it
  root.dataset.themeAnimation = cfg.animation;
  root.dataset.themeMood = cfg.lighting.mood;
};

const readStored = (): ThemeId => {
  if (typeof window === "undefined") return "dark";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw && (ALL_THEME_IDS as string[]).includes(raw)) return raw as ThemeId;
  return "dark";
};

interface ThemeContextValue {
  theme: ThemeId;
  config: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  themes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => readStored());

  // Inject on mount + on every change. Idempotent.
  useEffect(() => {
    injectTheme(getThemeConfig(theme));
  }, [theme]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && (ALL_THEME_IDS as string[]).includes(e.newValue)) {
        setThemeState(e.newValue as ThemeId);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    if (!(ALL_THEME_IDS as string[]).includes(id)) return;
    localStorage.setItem(STORAGE_KEY, id);
    setThemeState(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, config: getThemeConfig(theme), setTheme, themes: THEME_CONFIGS }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeEngine = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeEngine must be used within <ThemeProvider>");
  return ctx;
};
