# DESIGN_SYSTEM

Z TERMINAL is a dark-first professional market terminal. The palette is
restrained on purpose: serious traders stare at this surface for many hours
a day, so every color, radius, and density decision answers the question
**"would a serious trader stare at this for 8 hours?"** If the answer is no,
the choice is wrong.

Source of truth: `src/app/globals.css` and
`src/components/terminal/primitives.tsx`.

## 1. Palette — graphite ramp + warm off-white

The dark theme (`.dark`) is the terminal identity. Surfaces form a graphite
ramp from near-black to charcoal:

| Token         | OKLCH (dark)         | Use |
|---------------|----------------------|------|
| `--base`      | `oklch(0.155 0.004 95)`  | App background — near-black, slightly warm |
| `--panel`     | `oklch(0.185 0.005 95)`  | Panels (graphite) |
| `--surface`   | `oklch(0.215 0.005 95)`  | Cards / raised surfaces (charcoal) |
| `--elevated`  | `oklch(0.245 0.006 95)`  | Popovers / dropdowns |
| `--hover`     | `oklch(0.285 0.006 95)`  | Hover states |
| `--foreground`| `oklch(0.91 0.004 95)`   | Warm off-white text |

There is **no blue dominance** and **no neon**. The hue `95` is a very
slight warm shift, not a color.

## 2. Semantic accents

Accents are **semantic, not decorative**. They mean something and are used
consistently:

| Token        | OKLCH (dark)        | Meaning |
|--------------|---------------------|---------|
| `--pos`      | `oklch(0.72 0.15 158)` | Positive — emerald (PnL up, buy side) |
| `--neg`      | `oklch(0.65 0.21 25)`  | Negative — red (PnL down, sell side) |
| `--warn`     | `oklch(0.78 0.13 75)`  | Warning — amber/gold (SIMULATED tag, caution) |
| `--research` | `oklch(0.68 0.12 295)` | Research — violet (analytics, lab views) |
| `--mdata`    | `oklch(0.74 0.1 205)`  | Market data — cyan (data flow, status) |

Soft variants (`--pos-soft`, `--neg-soft`) are low-saturation backgrounds
for subtle highlights. The five `chart-1..5` tokens alias to these accents
so chart series stay consistent with the semantic system.

Light theme exists (in `:root`) but is secondary; the terminal defaults to
dark via `color-scheme: dark` on `<html>`.

## 3. Radii, borders, density

- **Radius:** `--radius: 0.375rem` (6px) — tight, professional. Panels and
  pills use `rounded-[6px]` or `rounded-[3px]`. No large rounded corners.
- **Borders:** Hairline — `color-mix(in oklch, var(--foreground) 8%,
  transparent)` via the `.hairline` utility. Strong variant at 14%. No
  heavy box-shadows; depth comes from the surface ramp, not shadows.
- **Density:** Compact. `PanelHeader` is `h-8` (32px). `StatRow` rows are
  `py-1`. Body text is `11.5–12px`; labels are `10–11px` uppercase with
  wide letter-spacing (`tracking-[0.12em]` to `0.16em`).

## 4. Typography

- **Fonts:** Geist Sans (`--font-geist-sans`) for UI, Geist Mono
  (`--font-geist-mono`) for figures and code.
- **Tabular numerals:** The `.tnum` utility sets
  `font-variant-numeric: tabular-nums` so financial columns align. The
  `.font-mono-num` utility combines Geist Mono with tabular numerals for
  price figures.
- **Body feature settings:** `cv11`, `ss01`, `ss03` enabled for legibility;
  antialiased with `text-rendering: optimizeLegibility`.

## 5. Primitives

`src/components/terminal/primitives.tsx` — the building blocks every view
uses:

| Primitive      | Purpose |
|----------------|---------|
| `Panel`        | Hairline-bordered graphite container — the standard panel. |
| `PanelHeader`  | `h-8` bar with uppercase title, optional `right` actions. |
| `SectionLabel` | Tiny uppercase tracking-wide label for subsections. |
| `StatRow`      | Label/value row, tabular-aligned, with `tone` (`pos`/`neg`/`warn`/`muted`/`default`). |
| `SimulatedTag` | Amber badge surfaced wherever mock data is shown — non-negotiable. |
| `Pill`         | Small status pill with semantic tones (`pos`/`neg`/`warn`/`mdata`/`research`/`default`). |

## 6. The sticky-bottom footer rule

The terminal shell is a full-screen flex layout (`h-screen w-screen`).
`Sidebar` + `Topbar` + `<main>` fill the viewport. The SIMULATED badge and
connection state are surfaced persistently (in the topbar and on every data
panel) so a trader can never lose track of whether they are looking at
SIMULATED or LIVE data. This is a hard rule — hiding the badge is a defect
(see `PROJECT_RULES.md` §5).

## 7. Mobile-first responsive

The shell is mobile-first: the sidebar collapses (`sidebarCollapsed`),
views stack vertically on narrow viewports, and the command palette (`?`)
is keyboard-accessible. Resizable panes use shadcn `resizable` (react-
resizable-panels). Charts and tables scale down to phone width but the
terminal is designed for desktop-class screens first.

## 8. The 8-hour test

Every visual decision must pass:

> **Would a serious trader stare at this for 8 hours without eye strain,
> without distraction, and without losing information density?**

Concretely:

- **No decorative color.** Every accent conveys semantics.
- **No neon.** Accents are restrained OKLCH values, not pure RGB.
- **No large radii.** 6px max — terminals are dense, not playful.
- **No heavy shadows.** Depth = surface ramp + hairline borders.
- **Tabular numerals** wherever a financial number appears.
- **Reduced-motion respect** — `@media (prefers-reduced-motion)` collapses
  animations and transitions to near-zero.
- **Compact scrollbars** (`.scroll-thin`) — 8px, semi-transparent, no
  layout shift.

If a design choice fails this test, it is wrong, regardless of how it
looks in a screenshot.
