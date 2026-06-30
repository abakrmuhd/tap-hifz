import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildDeveloperSeedState } from "../src/data/developer-seed.js";
import { getJuzForPage } from "../src/data/juz.js";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const baseState = {
  ayahProgress: {},
  transitionProgress: {},
  lastPage: 1,
  lastRoute: { screen: "home", tab: "progress", page: 1, target: null },
  recentPages: [],
  ayahBookmarks: [],
  pageBookmarks: [],
  practiceEvents: [],
  settings: {
    theme: "dark",
    sound: false,
    vibration: "auto",
    developerMode: true,
    reviewQueueSize: 12,
    doubleTapWindow: 250,
    repetitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    transitionCountThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 }
  }
};

function buildMetadata(pageCount = 604, ayahsPerPage = 3) {
  const pages = {};
  const ayahToPage = {};
  let ayahNumber = 1;

  for (let page = 1; page <= pageCount; page += 1) {
    const ayahKeys = [];
    for (let index = 0; index < ayahsPerPage; index += 1) {
      const key = `2:${ayahNumber}`;
      ayahKeys.push(key);
      ayahToPage[key] = page;
      ayahNumber += 1;
    }
    pages[String(page)] = { ayahKeys };
  }

  return { pages, ayahToPage };
}

const metadata = buildMetadata();

function pageAyahCounts(seeded, page) {
  return (metadata.pages[String(page)]?.ayahKeys || []).map((key) => seeded.ayahProgress[key]?.repetitionCount || 0);
}

function pageTransitionCounts(seeded, page) {
  return Object.entries(seeded.transitionProgress)
    .filter(([key]) => Number(key.split("|")[0]) === page)
    .map(([, value]) => value.repetitionCount);
}

test("buildDeveloperSeedState creates mastered juz, in-progress juz, mixed juz, and empty areas", () => {
  const seeded = buildDeveloperSeedState(baseState, metadata);
  const masteredJuzPages = Array.from({ length: 21 }, (_, index) => index + 1);
  const progressingJuzPages = Array.from({ length: 20 }, (_, index) => index + 22);
  const emptyJuzPages = Array.from({ length: 20 }, (_, index) => index + 42);
  const mixedJuzPage = 282;

  assert.equal(seeded.settings.theme, "dark");
  assert.equal(seeded.settings.developerMode, true);
  assert.ok(Object.keys(seeded.ayahProgress).length > 100);
  assert.ok(Object.keys(seeded.transitionProgress).length > 50);
  assert.ok(seeded.practiceEvents.length >= 1);
  assert.ok(seeded.pageBookmarks.length >= 1);
  assert.ok(seeded.ayahBookmarks.length >= 1);
  assert.notDeepEqual(seeded.recentPages, []);
  assert.equal(seeded.lastRoute.screen, "reading");
  assert.equal(seeded.lastRoute.page, seeded.lastPage);

  masteredJuzPages.forEach((page) => {
    assert.ok(pageAyahCounts(seeded, page).every((count) => count > 39), `expected page ${page} to be fully mastered`);
    assert.ok(pageTransitionCounts(seeded, page).every((count) => count > 19), `expected page ${page} transitions to be strong`);
  });

  assert.ok(progressingJuzPages.some((page) => pageAyahCounts(seeded, page).some((count) => count > 0 && count <= 9)));
  assert.ok(progressingJuzPages.some((page) => pageAyahCounts(seeded, page).some((count) => count > 9 && count <= 39)));
  assert.ok(progressingJuzPages.some((page) => pageTransitionCounts(seeded, page).some((count) => count > 0 && count <= 19)));

  emptyJuzPages.forEach((page) => {
    assert.ok(pageAyahCounts(seeded, page).every((count) => count === 0), `expected page ${page} to remain empty`);
    assert.deepEqual(pageTransitionCounts(seeded, page), []);
  });

  const mixedCounts = pageAyahCounts(seeded, mixedJuzPage);
  assert.ok(mixedCounts.some((count) => count === 0));
  assert.ok(mixedCounts.some((count) => count > 0 && count <= 9));
  assert.ok(mixedCounts.some((count) => count > 39));
  assert.equal(getJuzForPage(mixedJuzPage)[0], 15);
});

test("settings exposes a developer-only seed action and handles it", () => {
  assert.match(appSource, /s\.developerMode[\s\S]*data-action="seed-test-data"/);
  assert.match(appSource, /s\.developerMode[\s\S]*data-action="restore-test-data"/);
  assert.match(appSource, /Seed once to enable restore/);
  assert.match(appSource, /data-action="restore-test-data"[^>]*\$\{hasSeedBackup \? "" : "disabled"\}/);
  assert.match(appSource, /if \(action === "seed-test-data"\) seedTestData\(\);/);
  assert.match(appSource, /if \(action === "restore-test-data"\) restoreSeedBackup\(\);/);
  assert.match(appSource, /function seedTestData\(\)/);
  assert.match(appSource, /function restoreSeedBackup\(\)/);
});

test("reading page exposes a bulk-fill action button and modal wiring", () => {
  assert.match(appSource, /class="\$\{bulkFillButtonClasses\}" data-action="open-bulk-fill"/);
  assert.match(appSource, /function openBulkFill\(\)/);
  assert.match(appSource, /function buildBulkFillDefaults\(/);
  assert.match(appSource, /function getBulkFillVerseMax\(/);
  assert.match(appSource, /function clampBulkFillAyah\(/);
  assert.match(appSource, /data-bulk-fill-modal/);
  assert.match(appSource, /function renderBulkFillWheel\(/);
  assert.match(appSource, /function renderBulkFillPickerMenu\(/);
  assert.match(appSource, /function stepBulkFillField\(/);
  assert.match(appSource, /function syncBulkFillWheel\(/);
  assert.match(appSource, /function bindBulkFillWheel\(/);
  assert.match(appSource, /function toggleBulkFillPicker\(/);
  assert.match(appSource, /function selectBulkFillPicker\(/);
  assert.match(appSource, /data-picker="surahNumber"/);
  assert.match(appSource, /data-picker="mode"/);
  assert.match(appSource, /key:\s*"startAyah"/);
  assert.match(appSource, /key:\s*"endAyah"/);
  assert.match(appSource, /key:\s*"repetitionCount"/);
  assert.match(appSource, /key:\s*"transitionCount"/);
  assert.match(appSource, /data-bulk-fill-wheel="\$\{key\}"/);
  assert.match(appSource, /data-action="toggle-bulk-fill-picker"/);
  assert.match(appSource, /data-action="select-bulk-fill-picker"/);
  assert.doesNotMatch(appSource, /data-bulk-fill-step=/);
  assert.match(appSource, /if \(key === "startAyah" \|\| key === "endAyah"\) \{/);
  assert.match(appSource, /syncBulkFillWheel\(key\);/);
  assert.match(appSource, /clampBulkFillAyah\(value, bulkFillForm\.surahNumber\)/);
  assert.match(appSource, /event\.deltaY > 0 \? -1 : 1/);
  assert.match(appSource, /event\.key === "ArrowUp"[\s\S]*stepBulkFillField\(wheel\.dataset\.bulkFillWheel, 1\);/);
  assert.match(appSource, /event\.key === "ArrowDown"[\s\S]*stepBulkFillField\(wheel\.dataset\.bulkFillWheel, -1\);/);
  assert.match(appSource, /dragDistance >= 6/);
  assert.match(appSource, /offsetY <= rect\.height \* clickZoneRatio[\s\S]*stepBulkFillField\(wheel\.dataset\.bulkFillWheel, 1\);/);
  assert.match(appSource, /offsetY >= rect\.height \* \(1 - clickZoneRatio\)[\s\S]*stepBulkFillField\(wheel\.dataset\.bulkFillWheel, -1\);/);
  assert.match(appSource, /if \(action === "open-bulk-fill"\) openBulkFill\(\);/);
  assert.match(appSource, /if \(action === "toggle-bulk-fill-picker"\) toggleBulkFillPicker\(el\.dataset\.picker\);/);
  assert.match(appSource, /if \(action === "select-bulk-fill-picker"\) selectBulkFillPicker\(el\.dataset\.picker, el\.dataset\.value\);/);
  assert.match(appSource, /if \(action === "close-bulk-fill"\) closeBulkFill\(\);/);
  assert.match(appSource, /if \(action === "submit-bulk-fill"\) \{ await submitBulkFill\(\); return; \}/);
});

test("bulk-fill button styling keeps the action fixed off the page navigation buttons", () => {
  assert.match(stylesSource, /\.reader-bulk-fill-btn/);
  assert.match(stylesSource, /position:\s*fixed/);
  assert.match(stylesSource, /inset-inline-end:/);
  assert.match(stylesSource, /bottom:\s*82px/);
  assert.match(stylesSource, /\.reader-bulk-fill-btn\.with-review/);
  assert.match(stylesSource, /\.bulk-fill-wheel/);
  assert.match(stylesSource, /\.bulk-fill-wheel-hit[\s\S]*pointer-events:\s*none/);
  assert.match(stylesSource, /\.bulk-fill-picker-menu/);
  assert.match(stylesSource, /\.bulk-fill-picker-option\.selected/);
});
