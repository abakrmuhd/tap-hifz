# Transition Halo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reading-page inline `.transition-mark` with a transition-strength halo on the ayah badge so transition feedback no longer consumes line width or causes mushaf overflow.

**Architecture:** Move transition-strength presentation into the existing ayah-ending control instead of rendering a separate transition button/span. Add a small reader-facing helper module for ring-state derivation, then update the reader render path and CSS so one ayah badge carries both ayah strength and transition strength. Keep ayah tap, double tap, and long press behavior owned by the ayah badge, while preserving transition targeting for review highlight state and detail routing.

**Tech Stack:** Vanilla JS modules, static HTML/CSS, Node built-in test runner, browser verification through the local dev server

---

## File Structure

**Existing files**

- `src/app.js`
  - Reader rendering, event binding, ayah/transition interaction handling
- `src/styles.css`
  - Reading-page visual styles for `.ayah-mark`, `.transition-mark`, and mushaf line layout
- `tests/detail-logic.test.js`
  - Existing Node test style reference
- `package.json`
  - Verification commands: `npm.cmd run check` and `npm.cmd test`

**New files**

- `src/data/reader-halo-logic.js`
  - Small pure helpers for deriving transition ring state and accessibility text
- `tests/reader-halo-logic.test.js`
  - Unit tests for the new helper module

## Task 1: Add reader halo logic helpers

**Files:**
- Create: `src/data/reader-halo-logic.js`
- Test: `tests/reader-halo-logic.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAyahRingState,
  buildAyahAriaLabel
} from "../src/data/reader-halo-logic.js";

const ayahThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
const transitionThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };

test("buildAyahRingState maps ayah and transition counts into badge and ring classes", () => {
  assert.deepEqual(
    buildAyahRingState({
      ayahCount: 22,
      transitionCount: 12,
      ayahThresholds,
      transitionThresholds
    }),
    {
      ayahStrength: "strong",
      transitionStrength: "building",
      hasTransitionRing: true
    }
  );
});

test("buildAyahRingState omits the ring when no transition is available", () => {
  assert.deepEqual(
    buildAyahRingState({
      ayahCount: 3,
      transitionCount: null,
      ayahThresholds,
      transitionThresholds
    }),
    {
      ayahStrength: "weak",
      transitionStrength: null,
      hasTransitionRing: false
    }
  );
});

test("buildAyahAriaLabel appends transition strength only when a transition exists", () => {
  assert.equal(
    buildAyahAriaLabel({
      ayahLabel: "Surah 2:5",
      ayahStrength: "strong",
      transitionStrength: "building"
    }),
    "Surah 2:5, ayah strong, transition building"
  );

  assert.equal(
    buildAyahAriaLabel({
      ayahLabel: "Surah 1:1",
      ayahStrength: "weak",
      transitionStrength: null
    }),
    "Surah 1:1, ayah weak"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reader-halo-logic.test.js`
Expected: FAIL with module-not-found or missing export errors for `src/data/reader-halo-logic.js`

- [ ] **Step 3: Write minimal implementation**

```js
import { getStrengthClass } from "./metadata-logic.js";

export function buildAyahRingState({
  ayahCount,
  transitionCount,
  ayahThresholds,
  transitionThresholds
}) {
  return {
    ayahStrength: getStrengthClass(ayahCount, ayahThresholds),
    transitionStrength:
      transitionCount == null ? null : getStrengthClass(transitionCount, transitionThresholds),
    hasTransitionRing: transitionCount != null
  };
}

export function buildAyahAriaLabel({
  ayahLabel,
  ayahStrength,
  transitionStrength
}) {
  return transitionStrength
    ? `${ayahLabel}, ayah ${ayahStrength}, transition ${transitionStrength}`
    : `${ayahLabel}, ayah ${ayahStrength}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/reader-halo-logic.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/reader-halo-logic.test.js src/data/reader-halo-logic.js
git commit -m "test: add reader halo state helpers"
```

## Task 2: Move transition presentation into the ayah render path

**Files:**
- Modify: `src/app.js`
- Modify: `src/data/detail-logic.js`
- Test: `tests/detail-logic.test.js`
- Test: `tests/reader-halo-logic.test.js`

- [ ] **Step 1: Write the failing test for transition detail ownership and ring label composition**

```js
import test from "node:test";
import assert from "node:assert/strict";

import { describeDetailTarget } from "../src/data/detail-logic.js";
import { buildAyahAriaLabel } from "../src/data/reader-halo-logic.js";

const settings = {
  ayahThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
  transitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 }
};

test("ayah labels can include transition strength without changing detail-target semantics", () => {
  assert.equal(
    buildAyahAriaLabel({
      ayahLabel: "Surah 2:255",
      ayahStrength: "mastered",
      transitionStrength: "weak"
    }),
    "Surah 2:255, ayah mastered, transition weak"
  );
});

test("transition detail targets still resolve count and title without a rendered transition button", () => {
  const detail = describeDetailTarget(
    { kind: "transition", key: "10|2:1|2:2" },
    {
      settings,
      getAyahCount: () => 0,
      getTransitionCount: () => 3,
      labelAyah: (key) => `Ayah ${key}`,
      labelTransition: () => "2:1 -> 2:2",
      isAyahBookmarked: () => false
    }
  );

  assert.equal(detail.kindLabel, "Transition");
  assert.equal(detail.title, "2:1 -> 2:2");
  assert.equal(detail.count, 3);
}
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/detail-logic.test.js tests/reader-halo-logic.test.js`
Expected: FAIL because `buildAyahAriaLabel` is not yet imported/used in the reader flow and the new assertion may not compile until the helper exists in the expected module path

- [ ] **Step 3: Write minimal implementation in the reader**

```js
import {
  buildAyahAriaLabel,
  buildAyahRingState
} from "./data/reader-halo-logic.js";

function renderWord(word, activeTarget, options = {}) {
  const text = decodeText(word.word);
  const [surah, ayah] = word.location.split(":").map(Number);
  const match = text.match(/^(.*?)(?:\\s+)?([٠-٩]+)$/);
  if (!match) return `<span class="qword">${escapeHtml(text)}</span>`;

  const key = `${surah}:${ayah}`;
  const previous = options.previousAyahMap?.get(key) || null;
  const pageNumber = options.pageNumber || route.page;
  const transition = previous ? transitionKey(pageNumber, previous, key) : null;
  const ringState = buildAyahRingState({
    ayahCount: getAyahCount(key),
    transitionCount: transition ? getTransitionCount(transition) : null,
    ayahThresholds: state.settings.ayahThresholds,
    transitionThresholds: state.settings.transitionThresholds
  });
  const ayahActive = activeTarget?.kind === "Ayah" && activeTarget.key === key;
  const transitionActive = activeTarget?.kind === "Transition" && activeTarget.key === transition;
  const ayahClass = [
    "ayah-mark",
    ringState.ayahStrength,
    ringState.hasTransitionRing ? `transition-${ringState.transitionStrength}` : "",
    transitionActive ? "transition-target" : "",
    ayahActive ? "target" : ""
  ].filter(Boolean).join(" ");
  const ariaLabel = buildAyahAriaLabel({
    ayahLabel: labelAyah(key),
    ayahStrength: ringState.ayahStrength,
    transitionStrength: ringState.transitionStrength
  });

  if (options.inert) {
    return `
      <span class="qword">${escapeHtml(match[1])}</span>
      <span class="${ayahClass}" aria-hidden="true">${match[2]}</span>
    `;
  }

  return `
    <span class="qword">${escapeHtml(match[1])}</span>
    <button class="${ayahClass}" data-ayah="${key}" data-page="${pageNumber}" aria-label="${ariaLabel}">${match[2]}</button>
  `;
}
```

- [ ] **Step 4: Remove transition-button binding and preserve transition detail routing through existing state**

```js
app.querySelectorAll("button.ayah-mark[data-ayah]").forEach((button) => {
  button.addEventListener("click", () => handleAyahTap(button.dataset.ayah));
  bindLongPress(button, () => {
    detailTarget = { kind: "ayah", key: button.dataset.ayah, page: Number(button.dataset.page) };
    render();
  });
});
```

And delete this block entirely:

```js
app.querySelectorAll("button.transition-mark[data-transition]").forEach((button) => {
  bindLongPress(button, () => {
    detailTarget = { kind: "transition", key: button.dataset.transition, page: Number(button.dataset.page) };
    render();
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/detail-logic.test.js tests/reader-halo-logic.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app.js src/data/detail-logic.js src/data/reader-halo-logic.js tests/detail-logic.test.js tests/reader-halo-logic.test.js
git commit -m "feat: fold transition state into ayah render path"
```

## Task 3: Replace transition box CSS with halo CSS

**Files:**
- Modify: `src/styles.css`
- Test: `tests/reader-halo-logic.test.js`

- [ ] **Step 1: Write the failing style-oriented test as a contract test for class output**

```js
import test from "node:test";
import assert from "node:assert/strict";

import { buildAyahRingState } from "../src/data/reader-halo-logic.js";

const ayahThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
const transitionThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };

test("buildAyahRingState exposes mastered transition rings without standalone transition markup", () => {
  assert.deepEqual(
    buildAyahRingState({
      ayahCount: 1,
      transitionCount: 40,
      ayahThresholds,
      transitionThresholds
    }),
    {
      ayahStrength: "weak",
      transitionStrength: "mastered",
      hasTransitionRing: true
    }
  );
});
```

- [ ] **Step 2: Run test to verify it passes before CSS work**

Run: `node --test tests/reader-halo-logic.test.js`
Expected: PASS

- [ ] **Step 3: Write the halo CSS and remove standalone transition-box layout**

```css
.ayah-mark {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  min-width: 1.78rem;
  width: 1.78rem;
  height: 1.78rem;
  border: 1px solid rgba(171, 218, 26, .75);
  border-radius: 999px;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: .68rem;
  font-weight: 950;
  line-height: 1;
  user-select: none;
}

.ayah-mark::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0;
}

.ayah-mark.transition-weak::after {
  opacity: 1;
  background: conic-gradient(from 270deg, transparent 0deg 300deg, rgba(171, 218, 26, .8) 300deg 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
}

.ayah-mark.transition-building::after {
  opacity: 1;
  background: conic-gradient(from 240deg, transparent 0deg 210deg, rgba(171, 218, 26, .85) 210deg 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
}

.ayah-mark.transition-strong::after {
  opacity: 1;
  background: conic-gradient(from 210deg, transparent 0deg 120deg, rgba(171, 218, 26, .9) 120deg 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
}

.ayah-mark.transition-mastered::after {
  opacity: 1;
  border: 2px solid rgba(171, 218, 26, .95);
}

.ayah-mark.transition-target::after,
.ayah-mark.target {
  outline: 3px solid #f7f7ef;
  outline-offset: 2px;
}
```

And remove the old standalone transition rules:

```css
.transition-mark {
  display: inline-block;
  flex: 0 0 auto;
  width: 24px;
  height: 10px;
  border: 0;
  border-radius: 999px;
  padding: 0;
  user-select: none;
  appearance: none;
  vertical-align: middle;
}
```

- [ ] **Step 4: Run tests and syntax checks**

Run: `npm.cmd run check`
Expected: PASS

Run: `npm.cmd test`
Expected: PASS, including the new `reader-halo-logic` coverage

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/app.js src/data/reader-halo-logic.js tests/reader-halo-logic.test.js
git commit -m "feat: render transition halo around ayah badge"
```

## Task 4: Verify the reading page in the browser and update cached assets

**Files:**
- Modify: `index.html`
- Modify: `sw.js`
- Modify: `src/app.js` if browser verification exposes a rendering bug

- [ ] **Step 1: Bump cached asset versions for the reader shell**

```html
<link rel="stylesheet" href="/src/styles.css?v=9" />
<script type="module" src="/src/app.js?v=9"></script>
```

```js
const CACHE = "tap-hifz-v8";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/src/app.js?v=9",
  "/src/styles.css?v=9",
  "/src/data/juz.js"
];
```

- [ ] **Step 2: Run syntax and unit verification after the cache update**

Run: `npm.cmd run check`
Expected: PASS

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 3: Verify the reader manually in the browser**

Run the app:

```bash
npm.cmd run dev
```

Then verify in the browser:

- open `http://localhost:4173/?v=11`
- navigate to reading page 1
- confirm the ayah badge renders as one unit with no standalone transition box
- confirm the mushaf lines no longer overflow left because of a transition element
- confirm page 1 and page 2 remain center-aligned
- confirm a later dense page still fits within the page shell
- confirm a highlighted transition review target is still visibly distinct

- [ ] **Step 4: Commit**

```bash
git add index.html sw.js src/app.js src/styles.css src/data/reader-halo-logic.js tests/reader-halo-logic.test.js tests/detail-logic.test.js
git commit -m "chore: refresh cached reader assets for halo rollout"
```

## Self-Review

Spec coverage:

- remove inline transition width consumption: Task 2 and Task 3
- keep ayah strength on the badge: Task 2 and Task 3
- render transition strength as an outer ring: Task 1 and Task 3
- preserve existing interaction semantics: Task 2
- preserve first-ayah/no-transition behavior: Task 1 and Task 2
- verify no overflow on pages 1 and 2 and later dense pages: Task 4

Placeholder scan:

- no `TODO` or `TBD` placeholders remain
- every task includes file paths, commands, and concrete code snippets

Type consistency:

- helper API uses `buildAyahRingState` and `buildAyahAriaLabel` consistently in tests and reader rendering
- transition ring classes follow `transition-weak`, `transition-building`, `transition-strong`, `transition-mastered` consistently across JS and CSS
