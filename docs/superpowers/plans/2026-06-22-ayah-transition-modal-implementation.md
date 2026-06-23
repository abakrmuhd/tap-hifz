# Ayah Transition Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-count ayah detail modal with the approved Option B layout that shows an ayah count block, a page-local transition companion row, header bookmark/close controls, separate decrement actions, and a stable no-transition fallback.

**Architecture:** Keep the change inside the existing modal pipeline: extend `describeDetailTarget(...)` so ayah long-presses return a richer view-model, update `renderDetails()` in `src/app.js` to render the new structure and action names, and restyle the existing modal surface in `src/styles.css` instead of introducing new screens or routes. To avoid adding a new saved "goal" model, derive the small `/target` microtext from the current strength thresholds: display the upper bound of the current bucket plus one for non-mastered states, and the current count for mastered states.

**Tech Stack:** Vanilla ES modules, template-string rendering in `src/app.js`, shared pure logic in `src/data/detail-logic.js`, global CSS in `src/styles.css`, Node built-in test runner, `assert/strict`

---

## File Structure

### Existing files to modify

- `src/data/detail-logic.js`
  Responsibility: build the modal view-model for ayah and transition detail targets.
- `src/app.js`
  Responsibility: resolve the active detail target, render the modal markup, bind modal actions, mutate counts, and toggle bookmarks.
- `src/styles.css`
  Responsibility: style the redesigned modal header, ayah block, transition row, decrement buttons, and reset action.
- `tests/detail-logic.test.js`
  Responsibility: verify the enriched detail view-model for ayah and transition targets.

### No new runtime files

- This slice should not create a new component module, new route, or new storage schema.
- The approved mockup already lives in `docs/mockups/ayah-transition-modal-options.html` and should remain the visual reference only.

### Shared implementation decisions

- Preserve `detailTarget.kind === "ayah" | "transition"` as the modal entry point.
- Keep transition-only detail support intact, but enrich only ayah detail targets with the companion transition row.
- Derive `/target` display values from thresholds with a pure helper:
  - `empty` or `weak`: `weakMax + 1`
  - `building`: `buildingMax + 1`
  - `strong`: `strongMax + 1`
  - `mastered`: current count
- Treat the first visible ayah on a page as "no incoming transition" and render a stable, non-decrementable fallback row.

### Suggested view-model shape

Use this exact shape from `describeDetailTarget(...)` so rendering and tests stay consistent:

```js
{
  title: "Surah 2:255",
  mode: "ayah",
  canBookmark: true,
  bookmarked: false,
  headerBookmarkLabel: "Bookmark ayah",
  ayah: {
    label: "Ayah count",
    count: 24,
    strength: "strong",
    target: 40
  },
  transition: {
    available: true,
    path: "2:254 -> 2:255",
    label: "Transition count",
    count: 8,
    strength: "weak",
    target: 10
  }
}
```

For a missing incoming transition:

```js
transition: {
  available: false,
  label: "Transition count",
  message: "No incoming transition"
}
```

For transition-only detail targets, keep the existing single-count semantics:

```js
{
  title: "2:1 -> 2:2",
  mode: "transition",
  canBookmark: false,
  bookmarked: false,
  headerBookmarkLabel: null,
  transitionOnly: {
    label: "Transition count",
    count: 3,
    strength: "weak",
    target: 10
  }
}
```

### Helper signatures to keep consistent

Add or keep these helper signatures in `src/data/detail-logic.js`:

```js
export function describeDetailTarget(detailTarget, options) {}

function buildTargetCount(count, thresholds) {}
```

Pass this data into `describeDetailTarget(...)` from `src/app.js`:

```js
{
  settings: state.settings,
  getAyahCount,
  getTransitionCount,
  labelAyah,
  labelTransition,
  isAyahBookmarked,
  resolveIncomingTransition
}
```

Where `resolveIncomingTransition(key)` returns either:

```js
{ key: "1|2:254|2:255", path: "2:254 -> 2:255" }
```

or `null`.

## Task 1: Expand the detail view-model in pure logic

**Files:**
- Modify: `src/data/detail-logic.js`
- Test: `tests/detail-logic.test.js`

- [ ] **Step 1: Write the failing tests for ayah companion transition data**

Replace `tests/detail-logic.test.js` with these three tests:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { describeDetailTarget } from "../src/data/detail-logic.js";

const settings = {
  ayahThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
  transitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 }
};

test("describeDetailTarget builds ayah modal data with companion transition details", () => {
  const detail = describeDetailTarget(
    { kind: "ayah", key: "2:255" },
    {
      settings,
      getAyahCount: () => 24,
      getTransitionCount: (key) => key === "1|2:254|2:255" ? 8 : 0,
      labelAyah: (key) => `Surah ${key}`,
      labelTransition: (key) => {
        const [, from, to] = key.split("|");
        return `${from} -> ${to}`;
      },
      isAyahBookmarked: () => true,
      resolveIncomingTransition: () => ({ key: "1|2:254|2:255", path: "2:254 -> 2:255" })
    }
  );

  assert.equal(detail.mode, "ayah");
  assert.equal(detail.title, "Surah 2:255");
  assert.equal(detail.canBookmark, true);
  assert.equal(detail.bookmarked, true);
  assert.equal(detail.headerBookmarkLabel, "Remove ayah bookmark");
  assert.deepEqual(detail.ayah, {
    label: "Ayah count",
    count: 24,
    strength: "strong",
    target: 40
  });
  assert.deepEqual(detail.transition, {
    available: true,
    path: "2:254 -> 2:255",
    label: "Transition count",
    count: 8,
    strength: "weak",
    target: 10
  });
});

test("describeDetailTarget builds a stable no-incoming-transition fallback for first ayahs", () => {
  const detail = describeDetailTarget(
    { kind: "ayah", key: "1:1" },
    {
      settings,
      getAyahCount: () => 3,
      getTransitionCount: () => 0,
      labelAyah: (key) => `Surah ${key}`,
      labelTransition: () => "",
      isAyahBookmarked: () => false,
      resolveIncomingTransition: () => null
    }
  );

  assert.equal(detail.mode, "ayah");
  assert.deepEqual(detail.transition, {
    available: false,
    label: "Transition count",
    message: "No incoming transition"
  });
});

test("describeDetailTarget preserves transition-only detail targets", () => {
  const detail = describeDetailTarget(
    { kind: "transition", key: "10|2:1|2:2" },
    {
      settings,
      getAyahCount: () => 0,
      getTransitionCount: () => 3,
      labelAyah: (key) => `Ayah ${key}`,
      labelTransition: () => "2:1 -> 2:2",
      isAyahBookmarked: () => false,
      resolveIncomingTransition: () => null
    }
  );

  assert.equal(detail.mode, "transition");
  assert.equal(detail.title, "2:1 -> 2:2");
  assert.equal(detail.canBookmark, false);
  assert.deepEqual(detail.transitionOnly, {
    label: "Transition count",
    count: 3,
    strength: "weak",
    target: 10
  });
});
```

- [ ] **Step 2: Run the detail logic test file to verify it fails**

Run:

```bash
npm test -- --test-name-pattern="describeDetailTarget"
```

Expected: FAIL with missing properties such as `mode`, `ayah`, `transition`, or `transitionOnly`.

- [ ] **Step 3: Implement the enriched detail view-model in `src/data/detail-logic.js`**

Replace `src/data/detail-logic.js` with:

```js
import { getStrengthClass } from "./metadata-logic.js";

export function describeDetailTarget(detailTarget, options) {
  if (detailTarget.kind === "transition") {
    const count = options.getTransitionCount(detailTarget.key);
    const strength = getStrengthClass(count, options.settings.transitionThresholds);
    return {
      title: options.labelTransition(detailTarget.key),
      mode: "transition",
      canBookmark: false,
      bookmarked: false,
      headerBookmarkLabel: null,
      transitionOnly: {
        label: "Transition count",
        count,
        strength,
        target: buildTargetCount(count, options.settings.transitionThresholds)
      }
    };
  }

  const ayahCount = options.getAyahCount(detailTarget.key);
  const ayahStrength = getStrengthClass(ayahCount, options.settings.ayahThresholds);
  const incoming = options.resolveIncomingTransition(detailTarget.key);
  const bookmarked = options.isAyahBookmarked(detailTarget.key);

  return {
    title: options.labelAyah(detailTarget.key),
    mode: "ayah",
    canBookmark: true,
    bookmarked,
    headerBookmarkLabel: bookmarked ? "Remove ayah bookmark" : "Bookmark ayah",
    ayah: {
      label: "Ayah count",
      count: ayahCount,
      strength: ayahStrength,
      target: buildTargetCount(ayahCount, options.settings.ayahThresholds)
    },
    transition: incoming
      ? buildIncomingTransitionDetail(incoming, options)
      : {
          available: false,
          label: "Transition count",
          message: "No incoming transition"
        }
  };
}

function buildIncomingTransitionDetail(incoming, options) {
  const count = options.getTransitionCount(incoming.key);
  const strength = getStrengthClass(count, options.settings.transitionThresholds);
  return {
    available: true,
    path: incoming.path,
    label: "Transition count",
    count,
    strength,
    target: buildTargetCount(count, options.settings.transitionThresholds)
  };
}

function buildTargetCount(count, thresholds) {
  if (count <= thresholds.weakMax) return thresholds.weakMax + 1;
  if (count <= thresholds.buildingMax) return thresholds.buildingMax + 1;
  if (count <= thresholds.strongMax) return thresholds.strongMax + 1;
  return count;
}
```

- [ ] **Step 4: Run the detail logic tests again**

Run:

```bash
npm test -- --test-name-pattern="describeDetailTarget"
```

Expected: PASS for all three `describeDetailTarget` tests.

- [ ] **Step 5: Commit the pure-logic slice**

```bash
git add tests/detail-logic.test.js src/data/detail-logic.js
git commit -m "Expand ayah detail modal view model"
```

### Task 2: Wire ayah companion transitions and header/bookmark actions in `src/app.js`

**Files:**
- Modify: `src/app.js`
- Test: `tests/detail-logic.test.js` (no additional edits in this task)

- [ ] **Step 1: Add ayah incoming-transition resolution helpers near `labelAyah` and `labelTransition`**

Insert these helpers after `labelTransition(key)`:

```js
function resolveIncomingTransition(ayahKey) {
  const page = pageForAyah(ayahKey);
  const ayahKeys = metadata.pages[String(page)]?.ayahKeys || [];
  const index = ayahKeys.indexOf(ayahKey);
  if (index <= 0) return null;
  const previous = ayahKeys[index - 1];
  const key = transitionKey(page, previous, ayahKey);
  return {
    key,
    path: labelTransition(key)
  };
}

function renderCountValue(count, target) {
  return `
    <div class="detail-metric-value-line">
      <strong class="detail-metric-value">${count}</strong>
      <span class="detail-metric-target">/${target}</span>
    </div>
  `;
}
```

- [ ] **Step 2: Pass the new resolver into `describeDetailTarget(...)`**

Update the `renderDetails()` call site from:

```js
  const detail = describeDetailTarget(detailTarget, {
    settings: state.settings,
    getAyahCount,
    getTransitionCount,
    labelAyah,
    labelTransition,
    isAyahBookmarked: (key) => state.ayahBookmarks.some((item) => item.key === key)
  });
```

to:

```js
  const detail = describeDetailTarget(detailTarget, {
    settings: state.settings,
    getAyahCount,
    getTransitionCount,
    labelAyah,
    labelTransition,
    isAyahBookmarked: (key) => state.ayahBookmarks.some((item) => item.key === key),
    resolveIncomingTransition
  });
```

- [ ] **Step 3: Replace `renderDetails()` with the approved Option B ayah layout and a backward-compatible transition-only layout**

Replace the current `renderDetails()` function with:

```js
function renderDetails() {
  const detail = describeDetailTarget(detailTarget, {
    settings: state.settings,
    getAyahCount,
    getTransitionCount,
    labelAyah,
    labelTransition,
    isAyahBookmarked: (key) => state.ayahBookmarks.some((item) => item.key === key),
    resolveIncomingTransition
  });

  if (detail.mode === "transition") {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${detail.title}">
          <header class="modal-head">
            <strong>${detail.title}</strong>
            <button class="icon-btn small" data-action="close-modal" aria-label="Close">${icons.close}</button>
          </header>
          <div class="detail-panel">
            <div class="detail-block">
              <div class="detail-block-head">
                <span class="detail-metric-label">${detail.transitionOnly.label}</span>
                <span class="small-pill ${detail.transitionOnly.strength}">${titleCase(detail.transitionOnly.strength)}</span>
              </div>
              ${renderCountValue(detail.transitionOnly.count, detail.transitionOnly.target)}
              <button class="detail-mini-action secondary-btn" data-action="decrement-detail">-</button>
            </div>
            <button class="danger-btn full" data-action="reset-detail">Reset</button>
          </div>
        </section>
      </div>
    `;
  }

  const transitionMarkup = detail.transition.available
    ? `
      <div class="detail-transition-row">
        <div class="detail-transition-copy">
          <div class="detail-transition-head">
            <strong>${detail.transition.path}</strong>
            <span class="small-pill ${detail.transition.strength}">${titleCase(detail.transition.strength)}</span>
          </div>
          <div class="detail-metric-label">${detail.transition.label}</div>
          ${renderCountValue(detail.transition.count, detail.transition.target)}
        </div>
        <button class="detail-mini-action secondary-btn" data-action="decrement-transition-detail" aria-label="Decrease transition count">-</button>
      </div>
    `
    : `
      <div class="detail-transition-row empty">
        <div class="detail-transition-copy">
          <div class="detail-metric-label">${detail.transition.label}</div>
          <p class="detail-empty-copy">${detail.transition.message}</p>
        </div>
      </div>
    `;

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${detail.title}">
        <header class="modal-head">
          <strong>${detail.title}</strong>
          <div class="detail-head-actions">
            <button class="icon-btn small ${detail.bookmarked ? "active" : ""}" data-action="toggle-ayah-bookmark" aria-label="${detail.headerBookmarkLabel}">${icons.bookmark}</button>
            <button class="icon-btn small" data-action="close-modal" aria-label="Close">${icons.close}</button>
          </div>
        </header>
        <div class="detail-panel">
          <div class="detail-block">
            <div class="detail-block-head">
              <span class="detail-metric-label">${detail.ayah.label}</span>
              <span class="small-pill ${detail.ayah.strength}">${titleCase(detail.ayah.strength)}</span>
            </div>
            ${renderCountValue(detail.ayah.count, detail.ayah.target)}
            <button class="detail-mini-action secondary-btn" data-action="decrement-ayah-detail" aria-label="Decrease ayah count">-</button>
          </div>
          ${transitionMarkup}
          <button class="danger-btn full" data-action="reset-detail">Reset</button>
        </div>
      </section>
    </div>
  `;
}
```

- [ ] **Step 4: Split the modal decrement handling into ayah and transition actions**

Update the click dispatcher in `bindScreenEvents()` from:

```js
  if (action === "decrement-detail") mutateDetail(-1);
```

to:

```js
  if (action === "decrement-detail") mutateDetail(-1);
  if (action === "decrement-ayah-detail") mutateSpecificDetail("ayah", -1);
  if (action === "decrement-transition-detail") mutateSpecificDetail("transition", -1);
```

Then add this helper below `mutateDetail(delta)`:

```js
async function mutateSpecificDetail(kind, delta) {
  if (!detailTarget) return;

  if (kind === "ayah" && detailTarget.kind === "ayah") {
    state.ayahProgress[detailTarget.key] = { repetitionCount: Math.max(0, getAyahCount(detailTarget.key) + delta) };
    addEvent("decrement", { ayahKey: detailTarget.key, delta, page: route.page });
    await saveState();
    render();
    return;
  }

  if (kind === "transition") {
    const target = detailTarget.kind === "transition"
      ? detailTarget.key
      : resolveIncomingTransition(detailTarget.key)?.key;
    if (!target) return;
    state.transitionProgress[target] = { repetitionCount: Math.max(0, getTransitionCount(target) + delta) };
    addEvent("decrement", { transitionKey: target, delta, page: route.page });
    await saveState();
    render();
  }
}
```

- [ ] **Step 5: Run syntax checks before styling work**

Run:

```bash
npm run check
```

Expected: PASS with no syntax errors in `src/app.js` or `src/data/detail-logic.js`.

- [ ] **Step 6: Commit the modal wiring slice**

```bash
git add src/app.js src/data/detail-logic.js tests/detail-logic.test.js
git commit -m "Redesign ayah detail modal behavior"
```

### Task 3: Restyle the modal in `src/styles.css`

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Replace the old detail-card styles with the new Option B modal styles**

In `src/styles.css`, replace the existing block from `.detail-card { ... }` through `.detail-count { ... }` with:

```css
.detail-modal {
  padding: 14px;
}

.detail-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-panel {
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

.detail-block,
.detail-transition-row {
  position: relative;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.detail-block-head,
.detail-transition-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.detail-metric-label {
  color: var(--muted);
  font-size: .76rem;
  font-weight: 900;
}

.detail-transition-head strong {
  font-size: .88rem;
  line-height: 1.25;
}

.detail-metric-value-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 10px;
}

.detail-metric-value {
  font-size: 3rem;
  font-weight: 950;
  line-height: 1;
}

.detail-metric-target {
  color: var(--quiet);
  font-size: .82rem;
  font-weight: 900;
}

.detail-mini-action {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 42px;
  min-height: 42px;
  padding: 0;
}

.detail-transition-row .detail-metric-value {
  color: var(--text);
}

.detail-transition-copy {
  min-width: 0;
}

.detail-empty-copy {
  margin-top: 8px;
  color: var(--quiet);
  font-size: .82rem;
  line-height: 1.35;
}

.detail-transition-row.empty {
  padding-right: 12px;
}
```

- [ ] **Step 2: Run the app syntax checks again**

Run:

```bash
npm run check
```

Expected: PASS again. CSS changes will not produce console output, but `check` confirms the JS files still parse after the related markup edits.

- [ ] **Step 3: Build the static output once to catch template-string mistakes**

Run:

```bash
npm run build
```

Expected: build completes and writes `dist/` without template-string or asset errors.

- [ ] **Step 4: Commit the styling slice**

```bash
git add src/styles.css src/app.js
git commit -m "Style ayah transition detail modal"
```

### Task 4: Full verification and cleanup

**Files:**
- Modify: none expected
- Test: `tests/detail-logic.test.js`

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected: PASS for `tests/*.test.js`.

- [ ] **Step 2: Run the required repository checks**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 3: Verify spec coverage against the implementation**

Check these items manually against the diff before opening a PR:

```text
- Header shows bookmark icon and close button
- Ayah detail targets show ayah block plus transition companion row
- Transition row path is page-local and derived from the previous visible ayah on the page
- Missing incoming transition shows "No incoming transition" with no decrement button
- Ayah decrement and transition decrement are separate actions
- Reset remains full-width at the bottom
- Transition-only detail targets still render and remain usable
```

Expected: every line maps directly to code in `src/app.js`, `src/data/detail-logic.js`, or `src/styles.css`.

- [ ] **Step 4: Commit any final verification-only adjustments**

If no code changes were needed after verification, record that explicitly in the commit message by skipping this step. If minor adjustments were required, use:

```bash
git add src/app.js src/data/detail-logic.js src/styles.css tests/detail-logic.test.js
git commit -m "Polish ayah transition detail modal"
```

## Self-Review

### Spec coverage

- Header bookmark, close, and outside-close behavior are covered in Task 2.
- Main ayah block, transition row, decrement controls, and reset are covered across Tasks 2 and 3.
- No-incoming-transition fallback is covered in Task 1 and rendered in Task 2.
- Visual alignment and typography requirements are covered in Task 3 and verified in Task 4.

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" placeholders remain.
- Every code-changing step includes the exact replacement or insertion content.
- Every verification step includes an exact command and expected result.

### Type consistency

- `detail.mode`, `detail.ayah`, `detail.transition`, and `detail.transitionOnly` are defined in Task 1 and consumed with the same names in Task 2.
- `resolveIncomingTransition(...)` is defined before it is used in `renderDetails()` and `mutateSpecificDetail(...)`.
- `buildTargetCount(...)` stays private to `src/data/detail-logic.js`.

