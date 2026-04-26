# Component library

All primitives are shadcn/ui in `src/components/ui/*` — never edited directly. Variants are added via `cva`.

## Layout
- `AppShell` — wraps every page with sidebar + bottom nav + content grid
- `TopBar` — eyebrow + H1 + subtitle, used on every page
- `Sidebar` — desktop nav (lg+)
- `BottomNav` — mobile nav (<lg)

## Dashboard primitives
| Component | Purpose |
|---|---|
| `HeroCard` | Greeting + score + level + CTA |
| `PeakHourCard` | When-you-perform-best chart |
| `LevelCard` | XP bar + next-level preview |
| `TodayTasks` | Today's task list with inline complete |
| `HabitsStrip` | Today's habit chips |
| `QuickHealth` | Water / steps / mood quick logger |

## Shared
- `glass-card` utility class — the signature surface
- `gradient-text` utility — used for the user's name in the hero
- `Stat` (in `HeroCard.tsx`) — small label/value/sub triplet

## Variants
Buttons use shadcn variants extended with:
- `premium` — gradient-primary background, glow on hover (used on hero CTAs)
- `ghost-glass` — transparent on glass surfaces

Add new variants in `src/components/ui/button.tsx` via the `buttonVariants` cva — never re-style with arbitrary classes at the call site.

## Rules
1. New visuals start as a tokenized variant, not a one-off class string.
2. Animations use Framer Motion, not CSS keyframes — except the floating background orbs in the hero.
3. Never reach into shadcn primitives to override styles. Wrap and extend.
