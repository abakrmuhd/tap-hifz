# Tap Hifz Navigation Offline Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make jump/search reliable for real surah names, make the Quran corpus available offline from install time, and move app persistence to IndexedDB with legacy `localStorage` migration.

**Architecture:** Add app-owned navigation metadata plus a pure search resolver, extract a testable precache manifest for the service worker, and introduce a small browser storage module that prefers IndexedDB while importing any existing `localStorage` state once. Keep the current single-page app structure and minimize UI churn.

**Tech Stack:** Static HTML app, browser ES modules, service worker module, native IndexedDB, Node built-in test runner, bundled mushaf JSON corpus.

---

### Task 1: Add failing tests for search, storage, and offline manifest

**Files:**
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\navigation-logic.test.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\storage.test.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\offline-assets.test.js`

- [ ] Write a failing search resolver test for `juz`, page number, Arabic name, transliteration, and English surah queries.
- [ ] Write a failing storage test for importing legacy `localStorage` data into IndexedDB-backed persistence helpers.
- [ ] Write a failing offline-assets test asserting the precache list contains shell assets, metadata assets, and all 604 mushaf page JSON files.

### Task 2: Add metadata and helper modules

**Files:**
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\data\navigation-logic.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\data\storage.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\data\offline-assets.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\data\navigation-metadata.json`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\scripts\generate-navigation-metadata.js`

- [ ] Implement normalized query helpers and deterministic target resolution.
- [ ] Implement IndexedDB-first storage helpers with pure migration utilities and safe `localStorage` fallback.
- [ ] Implement a shared precache asset list used by both tests and the service worker.
- [ ] Generate committed navigation metadata from the existing mushaf metadata plus bundled surah naming data.

### Task 3: Wire the app runtime to the new modules

**Files:**
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\app.js`
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\package.json`

- [ ] Load state through the new storage module instead of direct `localStorage` access.
- [ ] Resolve search/jump input through navigation metadata instead of the current heuristic parser.
- [ ] Surface richer surah labels in the Surahs tab where available without changing the overall layout.
- [ ] Add generator and check scripts to keep navigation metadata reproducible.

### Task 4: Upgrade offline install behavior

**Files:**
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\sw.js`
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\app.js`

- [ ] Convert service worker registration to module mode.
- [ ] Precache shell, metadata, and all mushaf page files during install.
- [ ] Keep runtime cache behavior for same-origin GET requests after install.

### Task 5: Verify

**Files:**
- Test: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\navigation-logic.test.js`
- Test: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\storage.test.js`
- Test: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\offline-assets.test.js`

- [ ] Run `npm.cmd test`
- [ ] Run `npm.cmd run check`
- [ ] Reload the app and confirm `Baqarah`, `Yasin`, and `Juz 3` navigation works.
- [ ] Confirm previously saved state still loads after the storage layer change.
