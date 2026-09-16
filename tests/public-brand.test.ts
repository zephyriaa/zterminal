import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("public brand keeps the official slogan and removes obsolete motion reel identifiers", () => {
  const hero = read("src/components/landing/hero-scene.tsx");
  const landing = read("src/components/landing/landing-page.tsx") + hero;
  assert.match(landing, /See Further\./);
  assert.match(landing, /Guess Less\./);
  assert.match(hero, /Open in browser/);
  assert.match(hero, /Windows availability/);
  assert.doesNotMatch(hero, /Download for Windows/);
  assert.match(hero, /every idea can be checked against evidence/);
  assert.match(landing, /Price is only/);
  assert.match(landing, /the surface\./);
  const source = [landing, read("src/components/landing/research-loop.tsx"), read("src/app/download/page.tsx")].join("\n");
  assert.doesNotMatch(source, /ZT_MOTION_REEL_01|MOTION_REEL/i);
  assert.doesNotMatch(source, /mathematically proven alpha|institutional alpha|86\.4% historical win rate/i);
});
