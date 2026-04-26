/**
 * Centralized theme configuration registry.
 *
 * Every theme declares its full identity here:
 *   - HSL color tokens (background, foreground, primary, …)
 *   - Gradient overlays
 *   - Lighting + shadow mood
 *   - Animated background type
 *   - Particle settings
 *
 * To add a new theme: append a new ThemeConfig — no UI component needs to change.
 */

export type ThemeId = "light" | "dark" | "aurora" | "carbon" | "solar";

export type AnimationKind =
  | "ember"      // floating warm embers + sun beams (default dark)
  | "aurora"     // borealis ribbons drifting across the sky
  | "carbon"     // matte black + faint sparks + slow noise
  | "solar"      // pulsing radial heat + heat-distortion
  | "daylight";  // soft pastel gradient drift

export interface ParticleSettings {
  enabled: boolean;
  count: number;
  /** Color expressed as a CSS hsl string, e.g. "38 100% 60%" */
  hueRange: [number, number];
  saturation: number;
  lightness: number;
  speed: number; // pixels/sec base
  size: [number, number]; // min,max radius in px
  glow: number; // shadow blur multiplier
}

/**
 * HSL tokens — written as space-separated triplets so they slot directly
 * into `hsl(var(--token))` consumers. Never include the `hsl()` wrapper.
 */
export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  primaryGlow: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  // sidebar
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

export interface ThemeGradients {
  primary: string;
  accent: string;
  warm: string;
  mesh: string;
}

export interface ThemeLighting {
  glassBg: string;     // hsl-with-alpha string e.g. "24 16% 10% / 0.55"
  glassBorder: string;
  glassShadow: string;
  shadowGlow: string;  // CSS shadow value
  shadowElevated: string;
  shadowGlass: string;
  /** "soft" | "sharp" | "diffuse" — drives the AnimatedBackground intensity */
  mood: "soft" | "sharp" | "diffuse" | "warm";
}

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  description: string;
  unlockLevel: number;     // 0 = always unlocked
  swatch: string;          // CSS gradient for the picker thumbnail
  /** Whether this theme is fundamentally light or dark — controls color-scheme */
  scheme: "light" | "dark";
  tokens: ThemeTokens;
  gradients: ThemeGradients;
  lighting: ThemeLighting;
  animation: AnimationKind;
  particles: ParticleSettings;
}

// ───────────────────────── Theme definitions ─────────────────────────

export const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: "dark",
    label: "Ember Cosmos",
    description: "Warm-black canvas, sunlight beams from above, drifting embers.",
    unlockLevel: 0,
    swatch: "linear-gradient(135deg, hsl(24 18% 6%), hsl(38 100% 56%))",
    scheme: "dark",
    animation: "ember",
    particles: {
      enabled: true,
      count: 55,
      hueRange: [24, 42],
      saturation: 100,
      lightness: 60,
      speed: 14,
      size: [0.6, 2.4],
      glow: 6,
    },
    tokens: {
      background: "24 18% 6%",
      foreground: "38 30% 96%",
      card: "24 16% 9%",
      cardForeground: "38 30% 96%",
      popover: "24 16% 10%",
      popoverForeground: "38 30% 96%",
      primary: "38 100% 56%",
      primaryForeground: "24 30% 8%",
      primaryGlow: "28 100% 62%",
      secondary: "24 14% 14%",
      secondaryForeground: "38 25% 92%",
      muted: "24 12% 13%",
      mutedForeground: "30 12% 65%",
      accent: "28 100% 60%",
      accentForeground: "24 30% 8%",
      success: "150 60% 50%",
      successForeground: "24 30% 8%",
      warning: "38 100% 58%",
      warningForeground: "24 30% 8%",
      destructive: "8 85% 58%",
      destructiveForeground: "38 30% 96%",
      border: "28 20% 18%",
      input: "28 20% 16%",
      ring: "38 100% 56%",
      sidebarBackground: "24 18% 5%",
      sidebarForeground: "38 25% 88%",
      sidebarPrimary: "38 100% 56%",
      sidebarPrimaryForeground: "24 30% 8%",
      sidebarAccent: "24 14% 12%",
      sidebarAccentForeground: "38 25% 92%",
      sidebarBorder: "28 20% 16%",
      sidebarRing: "38 100% 56%",
    },
    gradients: {
      primary: "linear-gradient(135deg, hsl(38 100% 56%), hsl(22 100% 55%))",
      accent: "linear-gradient(135deg, hsl(28 100% 60%), hsl(15 95% 55%))",
      warm: "linear-gradient(135deg, hsl(45 100% 65%), hsl(15 95% 55%))",
      mesh: `
        radial-gradient(at 18% 12%, hsl(28 100% 55% / 0.32) 0px, transparent 45%),
        radial-gradient(at 85% 18%, hsl(38 100% 50% / 0.22) 0px, transparent 50%),
        radial-gradient(at 75% 90%, hsl(15 95% 50% / 0.28) 0px, transparent 50%),
        radial-gradient(at 10% 95%, hsl(38 100% 55% / 0.18) 0px, transparent 50%)`,
    },
    lighting: {
      glassBg: "24 16% 10% / 0.55",
      glassBorder: "38 60% 60% / 0.18",
      glassShadow: "24 30% 2% / 0.55",
      shadowGlow: "0 0 50px hsl(38 100% 55% / 0.45)",
      shadowElevated: "0 24px 70px -18px hsl(22 100% 40% / 0.5)",
      shadowGlass: "0 12px 40px hsl(24 30% 2% / 0.55), inset 0 1px 0 hsl(38 100% 80% / 0.06)",
      mood: "warm",
    },
  },

  {
    id: "light",
    label: "Daylight",
    description: "Warm cream with amber accents, soft ambient drift.",
    unlockLevel: 0,
    swatch: "linear-gradient(135deg, hsl(45 60% 94%), hsl(22 95% 52%))",
    scheme: "light",
    animation: "daylight",
    particles: {
      enabled: false,
      count: 0,
      hueRange: [38, 45],
      saturation: 70,
      lightness: 80,
      speed: 8,
      size: [0.8, 2.0],
      glow: 3,
    },
    tokens: {
      background: "45 60% 94%",
      foreground: "24 30% 12%",
      card: "45 50% 98%",
      cardForeground: "24 30% 12%",
      popover: "45 50% 98%",
      popoverForeground: "24 30% 12%",
      primary: "22 95% 52%",
      primaryForeground: "45 60% 98%",
      primaryGlow: "38 100% 58%",
      secondary: "45 40% 90%",
      secondaryForeground: "24 30% 18%",
      muted: "45 35% 88%",
      mutedForeground: "24 18% 38%",
      accent: "38 100% 52%",
      accentForeground: "24 30% 12%",
      success: "150 60% 38%",
      successForeground: "0 0% 100%",
      warning: "38 100% 50%",
      warningForeground: "24 30% 12%",
      destructive: "8 80% 50%",
      destructiveForeground: "0 0% 100%",
      border: "38 30% 80%",
      input: "38 30% 82%",
      ring: "22 95% 52%",
      sidebarBackground: "45 55% 96%",
      sidebarForeground: "24 30% 18%",
      sidebarPrimary: "22 95% 52%",
      sidebarPrimaryForeground: "45 60% 98%",
      sidebarAccent: "45 40% 90%",
      sidebarAccentForeground: "24 30% 18%",
      sidebarBorder: "38 30% 80%",
      sidebarRing: "22 95% 52%",
    },
    gradients: {
      primary: "linear-gradient(135deg, hsl(22 95% 52%), hsl(38 100% 58%))",
      accent: "linear-gradient(135deg, hsl(38 100% 52%), hsl(22 95% 55%))",
      warm: "linear-gradient(135deg, hsl(45 100% 60%), hsl(22 95% 55%))",
      mesh: `
        radial-gradient(at 18% 12%, hsl(38 100% 60% / 0.25) 0px, transparent 50%),
        radial-gradient(at 85% 18%, hsl(22 95% 55% / 0.18) 0px, transparent 50%),
        radial-gradient(at 75% 90%, hsl(38 100% 60% / 0.22) 0px, transparent 50%)`,
    },
    lighting: {
      glassBg: "45 50% 99% / 0.7",
      glassBorder: "38 60% 50% / 0.2",
      glassShadow: "24 30% 30% / 0.1",
      shadowGlow: "0 0 40px hsl(38 100% 60% / 0.4)",
      shadowElevated: "0 20px 60px -20px hsl(22 95% 45% / 0.3)",
      shadowGlass: "0 8px 32px hsl(24 30% 30% / 0.1), inset 0 1px 0 hsl(45 60% 100% / 0.6)",
      mood: "diffuse",
    },
  },

  {
    id: "aurora",
    label: "Aurora",
    description: "Borealis ribbons of teal & violet flowing across cobalt sky.",
    unlockLevel: 3,
    swatch: "linear-gradient(135deg, hsl(165 80% 45%), hsl(220 80% 25%))",
    scheme: "dark",
    animation: "aurora",
    particles: {
      enabled: true,
      count: 35,
      hueRange: [160, 220],
      saturation: 85,
      lightness: 70,
      speed: 10,
      size: [0.5, 1.8],
      glow: 8,
    },
    tokens: {
      background: "220 50% 8%",
      foreground: "165 30% 96%",
      card: "220 45% 12%",
      cardForeground: "165 30% 96%",
      popover: "220 45% 12%",
      popoverForeground: "165 30% 96%",
      primary: "165 80% 50%",
      primaryForeground: "220 50% 8%",
      primaryGlow: "180 90% 60%",
      secondary: "220 40% 14%",
      secondaryForeground: "165 30% 96%",
      muted: "220 35% 16%",
      mutedForeground: "165 20% 70%",
      accent: "200 95% 60%",
      accentForeground: "220 50% 8%",
      success: "150 70% 55%",
      successForeground: "220 50% 8%",
      warning: "45 95% 60%",
      warningForeground: "220 50% 8%",
      destructive: "350 80% 60%",
      destructiveForeground: "165 30% 96%",
      border: "220 35% 22%",
      input: "220 35% 20%",
      ring: "165 80% 50%",
      sidebarBackground: "220 50% 6%",
      sidebarForeground: "165 30% 90%",
      sidebarPrimary: "165 80% 50%",
      sidebarPrimaryForeground: "220 50% 8%",
      sidebarAccent: "220 40% 12%",
      sidebarAccentForeground: "165 30% 96%",
      sidebarBorder: "220 35% 18%",
      sidebarRing: "165 80% 50%",
    },
    gradients: {
      primary: "linear-gradient(135deg, hsl(165 80% 45%), hsl(180 90% 55%))",
      accent: "linear-gradient(135deg, hsl(200 95% 60%), hsl(180 90% 55%))",
      warm: "linear-gradient(135deg, hsl(180 90% 55%), hsl(200 95% 50%))",
      mesh: `
        radial-gradient(at 20% 15%, hsl(165 90% 50% / 0.25) 0px, transparent 50%),
        radial-gradient(at 80% 20%, hsl(200 95% 55% / 0.22) 0px, transparent 50%),
        radial-gradient(at 70% 85%, hsl(280 70% 60% / 0.2) 0px, transparent 55%),
        radial-gradient(at 15% 90%, hsl(165 80% 45% / 0.18) 0px, transparent 50%)`,
    },
    lighting: {
      glassBg: "220 45% 13% / 0.55",
      glassBorder: "165 60% 60% / 0.2",
      glassShadow: "220 50% 2% / 0.55",
      shadowGlow: "0 0 50px hsl(165 80% 50% / 0.45)",
      shadowElevated: "0 24px 70px -18px hsl(180 90% 35% / 0.5)",
      shadowGlass: "0 12px 40px hsl(220 50% 2% / 0.55), inset 0 1px 0 hsl(165 80% 80% / 0.06)",
      mood: "soft",
    },
  },

  {
    id: "carbon",
    label: "Carbon",
    description: "Pure matte black, occasional spark, surgical orange accent.",
    unlockLevel: 7,
    swatch: "linear-gradient(135deg, hsl(0 0% 6%), hsl(15 90% 55%))",
    scheme: "dark",
    animation: "carbon",
    particles: {
      enabled: true,
      count: 22,
      hueRange: [10, 25],
      saturation: 90,
      lightness: 55,
      speed: 6,
      size: [0.4, 1.2],
      glow: 10,
    },
    tokens: {
      background: "0 0% 5%",
      foreground: "0 0% 96%",
      card: "0 0% 9%",
      cardForeground: "0 0% 96%",
      popover: "0 0% 9%",
      popoverForeground: "0 0% 96%",
      primary: "15 90% 55%",
      primaryForeground: "0 0% 5%",
      primaryGlow: "30 95% 60%",
      secondary: "0 0% 11%",
      secondaryForeground: "0 0% 96%",
      muted: "0 0% 12%",
      mutedForeground: "0 0% 60%",
      accent: "15 90% 55%",
      accentForeground: "0 0% 5%",
      success: "150 60% 50%",
      successForeground: "0 0% 5%",
      warning: "38 95% 58%",
      warningForeground: "0 0% 5%",
      destructive: "8 85% 58%",
      destructiveForeground: "0 0% 96%",
      border: "0 0% 18%",
      input: "0 0% 16%",
      ring: "15 90% 55%",
      sidebarBackground: "0 0% 4%",
      sidebarForeground: "0 0% 88%",
      sidebarPrimary: "15 90% 55%",
      sidebarPrimaryForeground: "0 0% 5%",
      sidebarAccent: "0 0% 10%",
      sidebarAccentForeground: "0 0% 96%",
      sidebarBorder: "0 0% 14%",
      sidebarRing: "15 90% 55%",
    },
    gradients: {
      primary: "linear-gradient(135deg, hsl(15 90% 55%), hsl(30 95% 60%))",
      accent: "linear-gradient(135deg, hsl(15 90% 55%), hsl(0 0% 30%))",
      warm: "linear-gradient(135deg, hsl(30 95% 60%), hsl(15 90% 50%))",
      mesh: `
        radial-gradient(at 30% 20%, hsl(15 90% 50% / 0.12) 0px, transparent 50%),
        radial-gradient(at 80% 80%, hsl(30 95% 55% / 0.08) 0px, transparent 55%)`,
    },
    lighting: {
      glassBg: "0 0% 8% / 0.6",
      glassBorder: "15 80% 60% / 0.18",
      glassShadow: "0 0% 0% / 0.7",
      shadowGlow: "0 0 50px hsl(15 90% 55% / 0.45)",
      shadowElevated: "0 24px 60px -18px hsl(0 0% 0% / 0.6)",
      shadowGlass: "0 12px 40px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.04)",
      mood: "sharp",
    },
  },

  {
    id: "solar",
    label: "Solar",
    description: "Pulsing radial heat, golden hour every hour.",
    unlockLevel: 12,
    swatch: "linear-gradient(135deg, hsl(38 95% 55%), hsl(15 90% 55%))",
    scheme: "light",
    animation: "solar",
    particles: {
      enabled: true,
      count: 30,
      hueRange: [30, 50],
      saturation: 100,
      lightness: 65,
      speed: 12,
      size: [0.7, 2.2],
      glow: 5,
    },
    tokens: {
      background: "38 60% 96%",
      foreground: "20 30% 15%",
      card: "0 0% 100%",
      cardForeground: "20 30% 15%",
      popover: "0 0% 100%",
      popoverForeground: "20 30% 15%",
      primary: "20 95% 55%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "38 95% 60%",
      secondary: "38 50% 90%",
      secondaryForeground: "20 30% 15%",
      muted: "38 40% 92%",
      mutedForeground: "20 20% 40%",
      accent: "38 95% 55%",
      accentForeground: "20 30% 15%",
      success: "150 60% 40%",
      successForeground: "0 0% 100%",
      warning: "38 100% 50%",
      warningForeground: "20 30% 15%",
      destructive: "8 80% 50%",
      destructiveForeground: "0 0% 100%",
      border: "38 40% 85%",
      input: "38 40% 85%",
      ring: "20 95% 55%",
      sidebarBackground: "38 60% 94%",
      sidebarForeground: "20 30% 18%",
      sidebarPrimary: "20 95% 55%",
      sidebarPrimaryForeground: "0 0% 100%",
      sidebarAccent: "38 50% 88%",
      sidebarAccentForeground: "20 30% 18%",
      sidebarBorder: "38 40% 82%",
      sidebarRing: "20 95% 55%",
    },
    gradients: {
      primary: "linear-gradient(135deg, hsl(20 95% 55%), hsl(38 95% 60%))",
      accent: "linear-gradient(135deg, hsl(38 95% 55%), hsl(15 90% 55%))",
      warm: "linear-gradient(135deg, hsl(45 100% 60%), hsl(20 95% 55%))",
      mesh: `
        radial-gradient(at 50% 30%, hsl(38 100% 60% / 0.35) 0px, transparent 55%),
        radial-gradient(at 20% 80%, hsl(20 95% 55% / 0.22) 0px, transparent 50%),
        radial-gradient(at 80% 80%, hsl(45 100% 60% / 0.22) 0px, transparent 50%)`,
    },
    lighting: {
      glassBg: "0 0% 100% / 0.7",
      glassBorder: "38 80% 50% / 0.25",
      glassShadow: "20 50% 30% / 0.15",
      shadowGlow: "0 0 50px hsl(38 95% 60% / 0.5)",
      shadowElevated: "0 20px 60px -18px hsl(20 95% 50% / 0.35)",
      shadowGlass: "0 8px 32px hsl(20 50% 30% / 0.12), inset 0 1px 0 hsl(45 60% 100% / 0.6)",
      mood: "warm",
    },
  },
];

export const ALL_THEME_IDS: ThemeId[] = THEME_CONFIGS.map((t) => t.id);

export const getThemeConfig = (id: ThemeId): ThemeConfig =>
  THEME_CONFIGS.find((t) => t.id === id) ?? THEME_CONFIGS[0];
