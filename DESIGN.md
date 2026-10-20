---
name: "ZTerminal"
description: "Existing dark research application, extended with a calm workspace entry."
colors:
  background: "#111017"
  surface: "#1b1923"
  border: "#35313f"
  foreground: "#ddd7e6"
  secondary: "#bdb3cc"
  accent: "#b79be8"
  control-hover: "#292433"
  border-hover: "#77668b"
  divider: "#2b2634"
  heading: "#eee8f5"
  page-heading: "#f0ebf7"
  accent-ink: "#1a1128"
  accent-hover: "#c6aff0"
  link: "#d4bdf8"
  error-border: "#73505a"
  error-text: "#ffbdc9"
  metadata: "#b0a4bd"
  search-surface: "#16131e"
  card-surface: "#18151f"
  border-focus: "#8b739f"
  icon: "#c6b5de"
  separator: "#786d85"
  menu-hover: "#2b2435"
  menu-border: "#4d405a"
  menu-surface: "#211b2a"
  shadow: "#0006"
  empty-border: "#3d3449"
  selected-surface: "#251d32"
  label: "#c6bcd3"
  dialog-border: "#55445f"
  backdrop: "#0009"
  danger-surface: "#713343"
  danger-border: "#aa5b70"
  danger-text: "#ffe2e9"
  toolbar-hover: "#2a2435"
  panel-option-hover: "#3b2b4e"
  banner-border: "#574265"
  banner-text: "#e7d2ff"
  banner-action-border: "#735984"
  banner-action-text: "#eee0ff"
  banner-action-surface: "#30223e"
  alert-text: "#ffc4d1"
  alert-surface: "#291b25"
  recovery-border: "#5b466d"
  recovery-surface: "#21182d"
  recovery-text: "#d8befa"
typography:
  headline:
    fontFamily: "var(--font-geist-sans), sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.025em"
  headline-mobile:
    fontFamily: "var(--font-geist-sans), sans-serif"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.025em"
  card-title:
    fontFamily: "var(--font-geist-sans), sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-geist-sans), sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "var(--font-geist-sans), sans-serif"
    fontSize: "12px"
  market:
    fontFamily: "var(--font-geist-mono), monospace"
    fontSize: "11px"
    lineHeight: 1.7
rounded:
  compact: "3px"
  micro: "4px"
  sm: "6px"
  starter: "7px"
  container: "8px"
spacing:
  compact: "8px"
  control-gap: "10px"
  small: "12px"
  mobile-gutter: "16px"
  card-gap: "18px"
  card-inset: "20px"
  section: "24px"
  desktop-gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 13px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-ink}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 13px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "10px"
  workspace-card:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.container}"
    padding: "20px"
  workspace-navigation:
    textColor: "{colors.foreground}"
    rounded: "{rounded.micro}"
    padding: "5px 9px"
  starter-selected:
    backgroundColor: "{colors.selected-surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.starter}"
    padding: "20px"
---

# Design System: ZTerminal

## Overview

**Creative North Star: "The Existing Dark Research Workbench"**

Extend the incumbent near-black and violet ZTerminal identity with a calm entry surface. Pale text, hairline borders, Lucide line icons and compact controls keep saved work legible. This records the implemented web workspace extension; it does not replace the terminal appearance system or prescribe the public homepage.

The dashboard uses opaque surfaces. The terminal retains its existing configurable violet material, stationary glass chrome and opaque chart/editor areas. These are scoped expressions of the same research application, rather than a new global theme.

**Key Characteristics:**
- Near-black surfaces with restrained violet actions.
- Hairline controls and modest, role-specific corners.
- Geist for workspace reading; Geist Mono for market metadata.
- Explicit state and recovery text with Lucide icons.

## Colors

Near-black violet surfaces, warm pale text and a restrained lavender action accent extend the incumbent terminal identity. Frontmatter records exact workspace values; names describe their roles, not new CSS custom properties.

### Primary

The accent is for primary actions, selected starters and keyboard focus. Accent-hover lightens actionable fills; accent-ink preserves legibility on lavender. Link and recovery-text are related lighter action tones.

### Neutral

Background, search-surface, card-surface, surface and menu-surface form the opaque surface family. Foreground, heading, page-heading, secondary, label and metadata distinguish reading levels. Border, divider, border-hover, border-focus and the contextual menu/dialog/empty borders are hairlines of differing emphasis. Separator is a nonessential metadata delimiter, not body text.

### Status

Error and alert colors are rose variants tied to warnings and recovery. Danger-surface, danger-border and danger-text belong to destructive confirmation. Banner colors indicate ownership or save context, not market direction. These status families are intentional variants, not secondary decorative accents.

**The Scoped Palette Rule.** Use the workspace palette for workspace entry and wrapper controls. Keep terminal appearance variables and market semantic colors in their existing scope.

The 59 color findings in `.impeccable/review/detector.json` were repeated undocumented literal occurrences, not 59 new accents. Their workspace values are accounted for by the frontmatter's surface, text, border, action and state families; transparent black values serve shadow/backdrop only. Contextual colors are recorded to preserve the built states, not to recommend all shades for every future surface.

Terminal source has a separate base ramp in `globals.css` and configurable overrides in `terminal-glass.css`: reference terminal backgrounds, violet material, semantic bid/ask colors and appearance-derived CSS variables stay authoritative there. The violet override uses a dark surface ramp and accent mixes; the dashboard's slightly warmer lavender does not overwrite it. Legacy blue reference tokens remain implementation fallbacks, not a newly chosen dashboard identity.

## Typography

**Display and Body Font:** Bundled Geist through `var(--font-geist-sans), sans-serif`.
**Label/Mono Font:** Bundled Geist Mono through `var(--font-geist-mono), monospace` for exchange/symbol/timeframe metadata and existing terminal code/data.

The workspace page, toolbar, account, banner and recovery surfaces explicitly apply Geist. General headings remain sans; market metadata remains mono. The root layout loads the font variables; workspace rules select the family. Do not broaden this extension into a body-wide font reset.

### Hierarchy

- **Headline:** Workspace heading, with the desktop and mobile roles in frontmatter.
- **Title:** Workspace card names use card-title; the inline create heading is 20px at weight 500, the empty-state title 22px at weight 500, and recovery title 28px at weight 600.
- **Body:** Workspace reading and form controls use body; descriptive paragraphs use line-height 1.6–1.7.
- **Label:** Search/sort context and form labels use label; saved-card footer metadata is 11px.
- **Market:** Exchange, symbol and timeframe text use market, with word wrapping for long identifiers.

**The Loaded Face Rule.** Apply the bundled Geist CSS variable to the reading surface; loading a font variable alone does not apply a font family.

## Layout

The dashboard content is centered with max-width 1280px, desktop gutters of 32px and top padding 58px. Header minimum height is 72px on desktop. Saved cards use an auto-fill grid with minimum column width 280px and gap 18px. Cards have minimum height 196px and padding 20px. The search field is 340px wide at desktop.

At the observed 760px breakpoint, gutters become 16px, main top padding becomes 32px, header minimum height becomes 64px, heading/actions wrap, and search occupies its own full-width row. Starter choices change from three columns to one; form fields use two columns with the name spanning both. Footer content stacks. The workspace wrapper toolbar wraps independently; its canvas fills remaining viewport height without changing the terminal layout engine. These measurements describe the workspace surface, not every ZTerminal page.

## Elevation & Depth

The dashboard is flat at rest: opaque fills and one-pixel borders separate cards and controls. Menus use the existing soft shadow and deletion confirmation uses a black translucent native-dialog backdrop. There is no dashboard blur or decorative gradient. Terminal chrome retains stationary blur, accent-mixed violet material and inset highlights from its existing appearance system, with opaque chart/editor areas and reduced-transparency fallback.

### Shadow Vocabulary

- **Workspace menu:** `0 8px 24px #0006` for card action, account and add-panel menus.
- **Dialog backdrop:** `#0009`, an overlay fill rather than a shadow.
- **Terminal glass:** `0 10px 28px rgba(0, 0, 0, .31)` with the scoped material's inset highlight; never applied to dashboard cards.

**The Quiet Entry Rule.** Dashboard cards and controls stay opaque and flat; menus may cast the existing soft shadow. Terminal glass remains terminal-scoped.

## Shapes

The workspace corner vocabulary is role-based: compact (3px) for add-panel menu rows, micro (4px) for toolbar buttons and small menu triggers, sm (6px) for standard fields/buttons and menu shells, starter (7px) for selectable starter tiles, and container (8px) for saved cards, empty/loading containers and confirmation dialog. All are established CSS values. The 11 radius advisories in the saved detector report were repeated missing-documentation findings across these contexts, not eleven competing radius systems. The 7px starter tile sits between 6px controls and 8px containers; it is a contextual size, not a replacement global default.

The incumbent terminal independently uses tighter 3–4px tools, 6px floating windows, 7px material-backed controls, square maximized windows and circular status dots/avatars. Do not force these into one dashboard radius or prescribe circular status indicators as card shapes.

## Components

### Buttons

Compact, explicit text actions with Lucide where useful. Standard buttons are at least 38px high, with the primary/secondary padding and corners in frontmatter. Primary uses lavender and dark ink; secondary uses the control surface and hairline border. Hover changes background and border over 150ms. Disabled buttons use opacity .5. Workspace focus is a 2px accent outline offset 3–4px; terminal-scoped focus may use the existing inset material outline.

### Inputs / Fields

Opaque fields with hairline borders and modest corners. Standard inline-create inputs/selects use 10px padding. The search wrapper has its own darker fill, horizontal 12px padding and an icon; its input removes the inner border. Placeholder text uses the metadata tone. Keyboard focus remains explicit.

### Cards / Containers

Saved work uses a quiet opaque container with a text link, starter icon, market metadata and saved-state footer. Focus-within strengthens the card border; the title link carries hover/focus feedback. Cards have no decorative chart or image. Menus are separate elevated action surfaces.

### Navigation

Brand/help/account navigation stays compact; the workspace wrapper has a return link, workspace name, explicit save state and actions. Title links open workspace tabs; the Lucide external-arrow treatment makes that destination understandable. On mobile the wrapper wraps and the save-state label gets its own row.

### Starter selection and state feedback

Three radio choices use icon, title and description. Selection combines accent border, tinted fill and a real checked radio. At narrow widths choices stack. There is no general dashboard chip system to invent. Save/ownership banners and recovery views use the documented contextual palette with text and actions; color alone does not carry their meaning. The sort control says “Recent activity” because ordering considers the latest open or update time.

## Do's and Don'ts

### Do:
- Do use actual saved names, metadata and explicit state labels in workspace cards.
- Do use Lucide SVG icons and visible violet keyboard focus on workspace controls.
- Do keep workspace font and palette rules scoped; preserve chart semantics and terminal appearance settings.
- Do retain reduced-motion handling and the existing terminal transparency fallback.

### Don't:
- Don't add decorative glass, gradients or fabricated chart previews to the dashboard.
- Don't infer a global ban on glass or gradients from the opaque dashboard; the incumbent terminal uses both.
- Don't invent a status color or success claim for unavailable or unsynchronized work.
- Don't treat every literal shade as an independent brand accent or copy every contextual color into a new screen.

Evidence: `dashboard.module.css`, `workspaces.css`, root `layout.tsx`, `globals.css`, `terminal-glass.css` and `terminal-motion.css`; reviewed desktop/mobile dashboard and desktop workspace captures in `.impeccable/review/`. Final desktop/mobile dashboard and desktop workspace captures were visually rechecked after the scoped Geist and “Recent activity” corrections. They agree with the current source: Geist is applied to workspace reading surfaces and the sort label describes activity ordering. This visual review does not assert market connectivity; the workspace capture explicitly reports the feed unavailable. No legacy terminal eyebrow/glyph or contrast defects are canonized by this extension.
