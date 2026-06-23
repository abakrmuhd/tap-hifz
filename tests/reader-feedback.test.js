import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("ayah pulse starts at its peak and settles back to normal", () => {
  assert.match(styles, /0%\s*\{\s*transform:\s*scale\(1\.22\);\s*\}/);
  assert.match(styles, /100%\s*\{\s*transform:\s*scale\(1\);\s*\}/);
});

test("mutation feedback spawns a floating repetition count", () => {
  assert.match(appSource, /spawnAyahCountPop\(marker,\s*count,\s*app\)/);
  assert.match(styles, /\.ayah-count-pop/);
});

test("ayah marker gives immediate tap feedback before count commit", () => {
  assert.match(appSource, /handleAyahTap\(button\.dataset\.ayah,\s*button\)/);
  assert.match(appSource, /function playAyahTapFeedback\(marker\)/);
  assert.match(appSource, /marker\.animate\(/);
});

test("page shell pointerup routes non-drag ayah taps to feedback", () => {
  assert.match(appSource, /resolveAyahMarkerAtPoint\(event\.clientX,\s*event\.clientY\)/);
  assert.match(appSource, /lastPointerAyahTap/);
  assert.match(appSource, /handleAyahTap\(ayahMarker\.dataset\.ayah,\s*ayahMarker\)/);
});

test("ayah feedback animations stay visible in the app preview", () => {
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.pulse[\s\S]*animation-duration:\s*\.42s\s*!important/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.ayah-count-pop[\s\S]*animation-duration:\s*\.68s\s*!important/);
});

test("ayah pulse can replay on repeated taps", () => {
  assert.match(appSource, /restartAyahPulse\(marker\)/);
  assert.match(appSource, /playAyahTapFeedback\(marker\)/);
});

test("ayah feedback pop is positioned in an app overlay outside the marker", () => {
  assert.match(appSource, /getBoundingClientRect\(\)/);
  assert.match(appSource, /container\.append\(pop\)/);
  assert.match(styles, /\.ayah-count-pop[\s\S]*position:\s*fixed/);
});

test("page navigation click binding excludes ayah marker buttons", () => {
  assert.match(appSource, /querySelectorAll\("\[data-page\]:not\(\[data-ayah\]\)"/);
});

test("transition arc ring renders above the ayah marker surface", () => {
  assert.match(styles, /\.ayah-mark\.transition-weak::after,[\s\S]*z-index:\s*1/);
  assert.doesNotMatch(styles, /\.ayah-mark::after\s*\{[\s\S]*z-index:\s*-1/);
  assert.match(styles, /conic-gradient\(from -90deg,\s*#abda1a 0deg var\(--transition-arc, 0deg\)/);
});

test("transition arc ring is thick enough to be visible around ayah marker", () => {
  assert.match(styles, /--transition-ring-width:\s*5px/);
  assert.match(styles, /transparent calc\(100% - var\(--transition-ring-width\)\)/);
  assert.doesNotMatch(styles, /transparent calc\(100% - 2px\), #000 calc\(100% - 1px\)/);
});
