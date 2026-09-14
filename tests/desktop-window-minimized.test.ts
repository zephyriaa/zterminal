import assert from "node:assert/strict";
import test from "node:test";
import { clampPanel, panelBounds, type PanelLayout } from "../src/lib/panel-layout";

test("clampPanel prevents floating and minimized windows from being moved off-screen", () => {
  const viewportWidth = 1440;
  const viewportHeight = 900;

  // Normal window clamped within screen boundaries
  const normal = clampPanel({ x: -100, y: -50, width: 500, height: 400 }, viewportWidth, viewportHeight);
  assert.equal(normal.x, 0);
  assert.equal(normal.y, 0);
  assert.equal(normal.width, 500);
  assert.equal(normal.height, 400);

  // Dragged past right/bottom boundary
  const overflow = clampPanel({ x: 2000, y: 1500, width: 600, height: 500 }, viewportWidth, viewportHeight);
  assert.equal(overflow.x, 1440 - 600);
  assert.equal(overflow.y, 900 - 500);

  // Minimized floating window bounds (e.g. height=32, width=220)
  const minBounds = clampPanel({ x: 1400, y: 880, width: 220, height: 32 }, viewportWidth, viewportHeight);
  assert.equal(minBounds.x, 1440 - Math.min(240, minBounds.width));
  assert.ok(minBounds.y <= viewportHeight - 32);
});

test("panelBounds calculates floating panel bounds and preserves coordinates across status changes", () => {
  const layout: PanelLayout = {
    panels: {
      chart: { id: "chart", title: "Chart", placement: "center", bounds: { x: 0, y: 0, width: 800, height: 600 }, status: "open", maximized: false, order: 1 },
      strategy: { id: "strategy", title: "Strategy", placement: "floating", bounds: { x: 150, y: 120, width: 500, height: 400 }, status: "minimized", maximized: false, order: 2 },
    },
    left: 280,
    right: 420,
    bottom: 300,
    active: "chart",
  };

  const bounds = panelBounds(layout, "strategy", 1440, 900);
  assert.equal(bounds.x, 150);
  assert.equal(bounds.y, 120);
  assert.equal(bounds.width, 500);
  assert.equal(bounds.height, 400);
});
