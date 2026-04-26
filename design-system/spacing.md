# Spacing & layout

## Scale
Tailwind default 4px scale. Use multiples of 4 only.

## Page rhythm
- Outer page padding: `px-4 md:px-6 lg:px-8`
- Section gap: `gap-4 md:gap-5`
- Card padding: `p-5 md:p-6` for standard cards, `p-6 md:p-8` for hero
- Inline icon + text gap: `gap-2`
- Stack gap inside cards: `gap-3` to `gap-4`

## Radii
| Token | Use |
|---|---|
| `rounded-md` (6px) | Inputs, badges |
| `rounded-xl` (12px) | Buttons, chips |
| `rounded-2xl` (16px) | Cards, glass surfaces |
| `rounded-full` | Avatars, status pills, FAB |

## Glass surface (signature)
`.glass-card` utility = `bg-card/60 backdrop-blur-xl border border-glass-border rounded-2xl shadow-elevated`. Used on every primary card. Defined once in `index.css`.

## Breakpoints
- `sm` 640 — phone landscape
- `md` 768 — tablet
- `lg` 1024 — desktop, sidebar appears
- `xl` 1280 — wide desktop

Mobile uses `BottomNav`; desktop uses `Sidebar`. Switch is hard at `lg`.
