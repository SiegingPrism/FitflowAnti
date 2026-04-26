# Typography

## Families
| Role | Font | Tailwind |
|---|---|---|
| Display (H1, hero) | Space Grotesk | `font-display` |
| Body | Inter | `font-sans` (default) |
| Numbers (scores, XP, timer) | JetBrains Mono | `.number-display` utility |

Loaded in `index.html` via Google Fonts with `display=swap`.

## Scale
| Class | Size / line-height | Use |
|---|---|---|
| `text-xs` | 12 / 16 | Labels, eyebrows |
| `text-sm` | 14 / 20 | Body small, secondary |
| `text-base` | 16 / 24 | Body |
| `text-lg` | 18 / 28 | Card titles |
| `text-xl` | 20 / 28 | Section headings |
| `text-2xl` | 24 / 32 | Page section |
| `text-3xl` | 30 / 36 | Sub-hero |
| `text-5xl` | 48 / 1 | Hero greeting |

## Weight
- 400 body
- 500 UI emphasis
- 600 buttons, eyebrows
- 700 display headings

## Rules
- One H1 per page (the TopBar title).
- Eyebrows are `text-xs uppercase tracking-[0.2em]` — never bold body to fake an eyebrow.
- Numbers ≥ `text-2xl` use the mono family for tabular alignment.
- Never use serif. Never use Poppins.
