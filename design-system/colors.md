# Color tokens

All colors live in `src/index.css` as HSL CSS variables and are surfaced through Tailwind in `tailwind.config.ts`. **Never hardcode colors in components.**

## Semantic tokens
| Token | Role |
|---|---|
| `--background` | Page background |
| `--foreground` | Primary text |
| `--card` / `--card-foreground` | Card surface + text |
| `--muted` / `--muted-foreground` | Secondary surfaces + dim text |
| `--primary` / `--primary-foreground` | Primary action / brand |
| `--primary-glow` | Lighter primary used in gradients & shadows |
| `--accent` / `--accent-foreground` | Secondary brand accent |
| `--success` | Positive actions, completions |
| `--warning` | "On fire" states, attention |
| `--destructive` | Delete, danger, urgent priority |
| `--border` | Hairlines |
| `--ring` | Focus ring |

## Composite tokens
| Token | Purpose |
|---|---|
| `--gradient-primary` | Hero CTAs, level bars |
| `--gradient-accent` | Decorative orbs, accent surfaces |
| `--shadow-elevated` | Default raised card shadow |
| `--shadow-glow` | Hover shadow on primary CTAs |
| `--glass-border` | Border for glass-card surfaces |

## Rules
1. Always HSL — no hex, no rgb, no Tailwind `text-white`/`bg-black` in components.
2. Add new colors as semantic tokens first, *then* expose in `tailwind.config.ts`.
3. Light + dark theme must both be defined for every token.
4. Priority colors map: `low → muted-foreground`, `medium → accent`, `high → primary`, `urgent → destructive`.

## Themes (Tier 1 unlocks)
Each unlockable theme overrides only the surface + accent variables. Structure stays identical so layouts never break.
- **Default — Midnight**: deep slate background, electric blue primary
- **Aurora** (L3 unlock): green/violet accent, near-black background
- **Carbon** (L7): pure neutrals, no chroma — for deep-focus mode
- **Solar** (L12): warm amber/coral, light-mode-first
