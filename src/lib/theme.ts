import { levelFromXp } from "./gamification";
import { ALL_THEME_IDS, getThemeConfig, THEME_CONFIGS, type ThemeId } from "./themes.config";

/**
 * Backward-compatible theme façade.
 *
 * The actual injection logic now lives in <ThemeProvider>. This module
 * is kept so existing call-sites (useTheme, ThemeUnlockWatcher, Settings,
 * the inline boot script in index.html) keep working with the same API.
 */

export type Theme = ThemeId;

const KEY = "flowsphere-theme";

export interface ThemeMeta {
  id: Theme;
  label: string;
  description: string;
  unlockLevel: number;
  swatch: string;
}

export const THEMES: ThemeMeta[] = THEME_CONFIGS.map((c) => ({
  id: c.id,
  label: c.label,
  description: c.description,
  unlockLevel: c.unlockLevel,
  swatch: c.swatch,
}));

// ─── pub/sub ───
type Listener = (t: Theme) => void;
const listeners = new Set<Listener>();
export const subscribeTheme = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (t: Theme) => listeners.forEach((fn) => fn(t));

export const getTheme = (): Theme => {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(KEY) as Theme | null;
  if (stored && (ALL_THEME_IDS as string[]).includes(stored)) return stored;
  return "dark";
};

/**
 * Apply a theme by writing the storage key + emitting. The provider listens
 * to storage events and React state already handles the same-tab path,
 * but we also inject directly so calls from non-React code (boot script,
 * unlock modal, dev tools) work without a re-render dependency.
 */
export const applyTheme = (t: Theme) => {
  if (!(ALL_THEME_IDS as string[]).includes(t)) return;
  localStorage.setItem(KEY, t);
  // Direct DOM injection for non-React callers / FOUC-free paths.
  injectThemeDirect(t);
  emit(t);
  // Manually fire a storage-like ping so any other tabs/listeners react
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: t }));
};

// ─── direct DOM injection (also called from boot script via window) ───
const TOKEN_VARS: Array<[string, string]> = [
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

export const injectThemeDirect = (t: Theme) => {
  const cfg = getThemeConfig(t);
  const root = document.documentElement;
  for (const id of ALL_THEME_IDS) root.classList.remove(`theme-${id}`);
  root.classList.remove("light", "dark");
  root.classList.add(cfg.scheme);
  root.classList.add(`theme-${cfg.id}`);
  root.style.colorScheme = cfg.scheme;

  const tokens = cfg.tokens as unknown as Record<string, string>;
  for (const [key, cssVar] of TOKEN_VARS) {
    root.style.setProperty(cssVar, tokens[key]);
  }
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
  root.dataset.themeAnimation = cfg.animation;
  root.dataset.themeMood = cfg.lighting.mood;
};

export const isThemeUnlocked = (t: Theme, totalXp: number): boolean => {
  const meta = THEMES.find((m) => m.id === t);
  if (!meta) return false;
  if (meta.unlockLevel === 0) return true;
  return levelFromXp(totalXp).level >= meta.unlockLevel;
};

const SEEN_KEY = "flowsphere-unlocked-themes-seen";
export const getSeenUnlocks = (): Theme[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; }
};
export const markUnlockSeen = (t: Theme) => {
  const seen = new Set(getSeenUnlocks());
  seen.add(t);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
};
export const getUnseenUnlocks = (totalXp: number): ThemeMeta[] => {
  const seen = new Set(getSeenUnlocks());
  return THEMES.filter((m) => m.unlockLevel > 0 && isThemeUnlocked(m.id, totalXp) && !seen.has(m.id));
};

// ─── runtime verification ───
export interface ThemeHealthReport {
  expected: Theme;
  rootElement: "html";
  htmlClasses: string[];
  bodyClasses: string[];
  hasCorrectClass: boolean;
  hasStrayClasses: boolean;
  primaryTokenResolved: string;
  backgroundTokenResolved: string;
  storedValue: string | null;
  ok: boolean;
  issues: string[];
}

export const verifyThemeApplied = (expected: Theme): ThemeHealthReport => {
  const cfg = getThemeConfig(expected);
  const html = document.documentElement;
  const htmlClasses = Array.from(html.classList);
  const bodyClasses = Array.from(document.body.classList);
  const issues: string[] = [];

  const expectedThemeClass = `theme-${expected}`;
  const hasCorrectClass = htmlClasses.includes(cfg.scheme) && htmlClasses.includes(expectedThemeClass);
  if (!hasCorrectClass) issues.push(`Missing "${cfg.scheme}" + "${expectedThemeClass}" on <html>`);

  const otherThemes = ALL_THEME_IDS.filter((t) => t !== expected);
  const stray = otherThemes.filter((t) => htmlClasses.includes(`theme-${t}`));
  if (stray.length) issues.push(`Stray theme classes: ${stray.map((s) => `theme-${s}`).join(", ")}`);

  const bodyHasTheme = bodyClasses.some((c) => c === "light" || c === "dark" || c.startsWith("theme-"));
  if (bodyHasTheme) issues.push("Theme class found on <body> (should only be on <html>)");

  const styles = getComputedStyle(html);
  const primaryTokenResolved = styles.getPropertyValue("--primary").trim();
  const backgroundTokenResolved = styles.getPropertyValue("--background").trim();
  if (!primaryTokenResolved) issues.push("--primary did not resolve");
  if (!backgroundTokenResolved) issues.push("--background did not resolve");

  const storedValue = localStorage.getItem(KEY);
  if (storedValue !== expected) issues.push(`localStorage out of sync (${storedValue})`);

  return {
    expected,
    rootElement: "html",
    htmlClasses,
    bodyClasses,
    hasCorrectClass,
    hasStrayClasses: stray.length > 0,
    primaryTokenResolved,
    backgroundTokenResolved,
    storedValue,
    ok: issues.length === 0,
    issues,
  };
};

// ─── cross-tab sync (storage-event mirror) ───
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue && (ALL_THEME_IDS as string[]).includes(e.newValue)) {
      injectThemeDirect(e.newValue as Theme);
      emit(e.newValue as Theme);
    }
  });
}
