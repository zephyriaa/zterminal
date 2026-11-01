---
name: ZTerminal native parity audit
description: Observed native visual system and supplied-reference reconciliation; documentation only
colors:
  primary: "#B5A2E8"
  workspace: "#090A10"
  panel: "#14111D"
  chart: "#0B0A10"
  text: "#F0EFF5"
  muted: "#A8A2B5"
  border: "#302A3D"
typography:
  body:
    fontFamily: Geist
    fontSize: "13px"
  code:
    fontFamily: Geist Mono
    fontSize: "12px"
rounded:
  control: "8px"
spacing:
  compact: "8px"
  content: "16px"
---

# Observed native design

## Overview

This is the DesignSystem **document** workflow scoped to Phase 01's factual audit. Tokens are extracted from `apps/windows-host/winui/App.xaml` and control values in `MainWindow.xaml`; they describe the incumbent native UI. No new creative direction, global root DESIGN.md, implementation tokens or component-preview sidecar is introduced. The user's audit scope takes precedence over a full design-system authoring/interview flow.

The current native window is a dark chart workspace with navigation on the left and data/Python/report context on the right. It is visibly short of the supplied Home reference and the shipped web product. That screenshot is evidence of the present state, not acceptance of it.

## Colors

Violet is the current selection accent. Graphite workspace/chart surfaces and the slightly violet panel surface separate work areas; light text and muted metadata provide hierarchy. These exact incumbent native brush values do not establish a perfect match with either supplied image.

The pinned web default Violet appearance uses the same core workspace/panel/chart/accent values in `src/lib/terminal-appearance.ts`. Its dashboard has its own CSS values (for example page `#111017`, card `#18151f`, CTA `#b79be8`); do not pretend one native token table captures all deployed surfaces. The welcome image's blue CTA is permitted only as the scoped onboarding treatment in the common contract.

## Typography

Native body text uses bundled Geist; code preview uses Geist Mono. Current body/code values are above. Existing XAML also uses smaller metadata and a larger chart-empty heading. Audit confirms bundled font files and the current source declarations; font/text-scaling accessibility across devices remains NOT TESTED.

## Layout

Current window: 48-DIP title region, 28-DIP status row, 194-DIP expanded navigation, 42-DIP compact rail; context is hidden below 1100 DIP or in Chart focus preset. Expanded context is about 30% of the remaining width, capped at 420 DIP. Chart/context composition comes from existing code, not the Home image.

Supplied reference 1 is **first-open welcome only**: approved logo, two exact actions, native window controls, successful account/offline routing to Home. It is not a persistent launcher. Supplied reference 2 requires Home, top tabs, search, real studies/workspaces and truthful previews/storage labels. Current native source supplies none of that Home composition. The image's Windows taskbar is outside the app and must not be rendered inside it.

Web currently separates dashboard and workspace routes and opens workspaces in browser tabs. Native Home/workspace tabs must preserve the same independent ownership in the app. Web dashboard has text workspace summaries; illustrated studies/thumbnails are target work, not shipped functions established by the image.

## Elevation & Depth

Incumbent XAML uses solid brushes and borders, not an implemented dynamic material system. The Appearance dialog's Rich/Reduced effects/Opaque options have no apply/persistence handlers. Do not label that control as working material support. Welcome must have an opaque, readable fallback; previous liquid-glass plans do not override readability or the supplied latest references.

## Shapes

Native buttons use the extracted control radius. Preserve actual native hit targets, focus and caption behavior. The native `Assets/mark.png` and deployed kit PNG are different assets; both were inspected visually, but no exact approved-kit geometry equivalence was established. Use the approved Logo Kit v1 directly in Phase 02; preserve all three independent pieces, spacing and negative space. Do not trace the generated reference screenshot.

## Components

- **Native navigation:** Chart, Strategy developer, Dataset inspector, Workspaces and Settings; collapsed controls keep accessibility names. Not a substitute for Home/top workspace tabs.
- **Workspace actions:** create/reload/save/import CSV flyout with real Store operations. Full lifecycle and unsaved/recovery behavior still need parity work.
- **Data context:** truthful retained CSV/spot identity/units/hash details; exchange authenticity remains unverified. No live provider is implied.
- **Python/report tabs:** saved strategy preview/editor exists; Run and archived report selection remain explicitly disconnected.
- **Empty state:** actual native screenshot shows no dataset and LOCAL DATA UNAVAILABLE. Keep this truthful behavior as features are connected.

## Do's and Don'ts

- Preserve graphite/violet identity, native controls, approved logo geometry and actual product content.
- Label unknown/offline/stale/loading/failed data honestly; local mode does not fabricate a live feed.
- Build real Home records, search and previews; keep empty and missing-artifact states visible.
- Treat GEX, community labels and cloud badges as illustrative until actual supported functionality is verified.
- Do not claim the current native screenshot, an old Figma metadata export or backend tests establish visual/interaction parity.
- Do not embed a browser chart/editor or copy third-party renderer internals into the native implementation.

## User-directed visual correction — 28 October 2026

The user rejected the Settings-like appearance of the first native implementation. Keep WinUI as infrastructure while giving ZTerminal the visible shell and control language. The supplied welcome/dashboard references remain the visual authority. Replace the broad utility sidebar with a 48-DIP chart tool rail, keep workspace tabs above the canvas, use neutral graphite panels and sparse violet selection, and give buttons/inputs/dialogs consistent compact geometry and bundled Geist typography. No decorative Mica/Acrylic backdrop is required. Preserve native keyboard input, focus, accessibility and caption behavior. This is a visible product correction, not a change to local-first storage or rendering ownership.
