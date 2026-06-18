# Reading Page Swipe Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-layer reader swipe interaction where the active mushaf page slides with the finger and reveals the neighboring page underneath before the turn commits.

**Architecture:** Keep the existing single-page app structure, but extract swipe decision logic into a small pure helper module so we can test thresholds, direction, and boundary behavior with `node --test`. The reader keeps rendering through `src/app.js`, now with two page surfaces inside the existing page shell and a small prefetch cache for neighboring pages.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, `node --test`, local `python -m http.server`

---

### Task 1: Add pure swipe-reveal helpers with tests

**Files:**
- Create: `src/reader/swipe-reveal.js`
- Create: `tests/swipe-reveal.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  clampRevealOffset,
  getRevealDirection,
  getRevealPage,
  shouldCommitSwipe
} from "../src/reader/swipe-reveal.js";

test("getRevealDirection maps right drags to next and left drags to previous", () => {
  assert.equal(getRevealDirection({ dx: 72, dy: 12, startThreshold: 8 }), "next");
  assert.equal(getRevealDirection({ dx: -72, dy: 12, startThreshold: 8 }), "previous");
});

test("getRevealDirection rejects mostly vertical drags", () => {
  assert.equal(getRevealDirection({ dx: 24, dy: 60, startThreshold: 8 }), null);
});

test("shouldCommitSwipe uses horizontal threshold and vertical limit", () => {
  assert.equal(shouldCommitSwipe({ dx: 61, dy: 30, commitDistance: 60, verticalLimit: 70 }), true);
  assert.equal(shouldCommitSwipe({ dx: 59, dy: 30, commitDistance: 60, verticalLimit: 70 }), false);
  assert.equal(shouldCommitSwipe({ dx: 90, dy: 80, commitDistance: 60, verticalLimit: 70 }), false);
});

test("clampRevealOffset damps large drags", () => {
  assert.equal(clampRevealOffset(40, { maxOffset: 120, dragRatio: 0.45 }), 18);
  assert.equal(clampRevealOffset(400, { maxOffset: 120, dragRatio: 0.45 }), 120);
  assert.equal(clampRevealOffset(-400, { maxOffset: 120, dragRatio: 0.45 }), -120);
});

test("getRevealPage honors app navigation mapping and boundaries", () => {
  assert.equal(getRevealPage({ currentPage: 12, direction: "next", pageCount: 604 }), 13);
  assert.equal(getRevealPage({ currentPage: 12, direction: "previous", pageCount: 604 }), 11);
  assert.equal(getRevealPage({ currentPage: 604, direction: "next", pageCount: 604 }), null);
  assert.equal(getRevealPage({ currentPage: 1, direction: "previous", pageCount: 604 }), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/swipe-reveal.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/reader/swipe-reveal.js`

- [ ] **Step 3: Write minimal implementation**

Create `src/reader/swipe-reveal.js`:

```js
export function getRevealDirection({ dx, dy, startThreshold }) {
  if (Math.abs(dx) <= startThreshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx > 0 ? "next" : "previous";
}

export function shouldCommitSwipe({ dx, dy, commitDistance, verticalLimit }) {
  return Math.abs(dx) > commitDistance && Math.abs(dy) < verticalLimit;
}

export function clampRevealOffset(dx, { maxOffset, dragRatio }) {
  const scaled = dx * dragRatio;
  return Math.max(-maxOffset, Math.min(maxOffset, scaled));
}

export function getRevealPage({ currentPage, direction, pageCount }) {
  if (direction === "next") return currentPage < pageCount ? currentPage + 1 : null;
  if (direction === "previous") return currentPage > 1 ? currentPage - 1 : null;
  return null;
}
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "python -m http.server 4173",
    "check": "node --check src/app.js && node --check src/data/juz.js && node --check src/data/metadata-logic.js && node --check src/reader/swipe-reveal.js",
    "test": "node --test tests/*.test.js"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/swipe-reveal.test.js`
Expected: PASS for 5 tests

- [ ] **Step 5: Commit**

```bash
git add package.json tests/swipe-reveal.test.js src/reader/swipe-reveal.js
git commit -m "test: add swipe reveal helper coverage"
```

### Task 2: Refactor reader markup into layered page surfaces

**Files:**
- Modify: `src/app.js`
- Test: `node --check src/app.js`

- [ ] **Step 1: Update the import block and add the failing test for reveal surface state**

Update the import block and append this test in `tests/swipe-reveal.test.js`:

```js
import { buildRevealSurfaceState } from "../src/reader/swipe-reveal.js";

test("buildRevealSurfaceState returns active and revealed page numbers", () => {
  assert.deepEqual(
    buildRevealSurfaceState({ currentPage: 20, direction: "next", pageCount: 604 }),
    { activePage: 20, revealedPage: 21 }
  );
  assert.deepEqual(
    buildRevealSurfaceState({ currentPage: 1, direction: "previous", pageCount: 604 }),
    { activePage: 1, revealedPage: null }
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/swipe-reveal.test.js`
Expected: FAIL with `SyntaxError` or `does not provide an export named "buildRevealSurfaceState"`

- [ ] **Step 3: Update the helper and wire reader-local layer state**

Keep `src/reader/swipe-reveal.js` resilient:

```js
export function buildRevealSurfaceState({ currentPage, direction, pageCount }) {
  return {
    activePage: currentPage,
    revealedPage: getRevealPage({ currentPage, direction, pageCount })
  };
}

export function getRevealPage({ currentPage, direction, pageCount }) {
  if (direction === "next") return currentPage < pageCount ? currentPage + 1 : null;
  if (direction === "previous") return currentPage > 1 ? currentPage - 1 : null;
  return null;
}
```

In `src/app.js`, replace the single-layer reader body with layered surfaces and add page-cache state near the existing globals:

```js
import {
  buildRevealSurfaceState,
  clampRevealOffset,
  getRevealDirection,
  getRevealPage,
  shouldCommitSwipe
} from "./reader/swipe-reveal.js";

let revealState = {
  direction: null,
  offset: 0,
  dragging: false
};
let prefetchedPages = new Map();
```

Add page-surface helpers near `renderReading()`:

```js
function renderPageSurface(pageData, pageNumber, activeTarget, className, inert = false) {
  if (!pageData) return "";
  return `
    <div class="page-surface ${className} ${pageNumber % 2 ? "odd" : "even"}" data-surface-page="${pageNumber}" ${inert ? 'aria-hidden="true"' : ""}>
      <div class="mushaf" dir="rtl">
        ${pageData.lines.map((line) => renderLine(line, activeTarget, pageNumber, inert)).join("")}
      </div>
    </div>
  `;
}
```

Update `renderReading()` so the page shell contains both surfaces:

```js
function renderReading() {
  const page = currentPageData;
  const pageBookmarked = state.pageBookmarks.includes(route.page);
  const activeTarget = resolveReaderTarget();
  const surfaces = buildRevealSurfaceState({
    currentPage: route.page,
    direction: revealState.direction,
    pageCount: PAGE_COUNT
  });
  const revealPageData = surfaces.revealedPage ? prefetchedPages.get(surfaces.revealedPage) || null : null;

  return `
    <main class="app-shell reader-shell">
      <header class="reading-top">
        <button class="icon-btn" data-action="home" aria-label="Back">${icons.back}</button>
        <div class="reading-meta">${review ? `Review · ${review.index + 1} of ${review.queue.length}` : `Page ${route.page} · ${metadata.pages[String(route.page)]?.label || ""}`}</div>
        <div class="top-actions">
          <button class="icon-btn ${pageBookmarked ? "active" : ""}" data-action="toggle-page-bookmark" aria-label="Toggle page bookmark">${icons.bookmark}</button>
          <button class="icon-btn" data-action="settings" aria-label="Settings">${icons.settings}</button>
        </div>
      </header>
      <button class="sr-only" data-action="previous-page">Previous page</button>
      <button class="sr-only" data-action="next-page">Next page</button>
      <section class="page-shell ${route.page % 2 ? "odd" : "even"}" aria-label="Mushaf page ${route.page}">
        ${renderPageSurface(revealPageData, surfaces.revealedPage, null, "revealed-page", true)}
        ${renderPageSurface(page, surfaces.activePage, activeTarget, "active-page")}
      </section>
      <p class="swipe-hint">Swipe left for previous page. Swipe right for next page.</p>
      ${undoVisible ? `<button class="floating-undo" data-action="undo" aria-label="Undo last count">${icons.undo}</button>` : ""}
      ${review ? renderReviewBar() : ""}
    </main>
  `;
}
```

Update `renderLine` and `renderWord` signatures so the revealed layer can render without interactive controls:

```js
function renderLine(line, activeTarget, pageNumber, inert = false) {
  if (line.type === "surah-header") return `<div class="surah-header">${decodeText(line.text)}</div>`;
  if (line.type === "basmala") return `<div class="basmala">${decodeText(line.qpcV2 || line.text || "")}</div>`;
  const words = line.words || [];
  const fit = words.length > 10 ? "fit-84" : words.length > 8 ? "fit-89" : words.length > 6 ? "fit-93" : "";
  const parts = words.map((word) => renderWord(word, activeTarget, pageNumber, inert)).join("");
  const unjustify = pageNumber <= 2 ? "unjustified" : "";
  return `<div class="mushaf-line ${fit} ${unjustify} ${words.length <= 3 ? "short" : ""}">${parts}</div>`;
}
```

```js
function renderWord(word, activeTarget, pageNumber, inert = false) {
  const text = decodeText(word.word);
  const [surah, ayah] = word.location.split(":").map(Number);
  const match = text.match(/^(.*?)(?:\s+)?([٠-٩]+)$/);
  if (!match) return `<span class="qword">${escapeHtml(text)}</span>`;
  const key = `${surah}:${ayah}`;
  const previous = previousVisibleAyah(key);
  const transition = previous ? transitionKey(pageNumber, previous, key) : null;
  if (inert) {
    return `
      <span class="qword">${escapeHtml(match[1])}</span>
      ${transition ? `<span class="transition-mark ${strengthClass(getTransitionCount(transition), state.settings.transitionThresholds)}"></span>` : ""}
      <span class="ayah-mark inert ${strengthClass(getAyahCount(key), state.settings.ayahThresholds)}">${match[2]}</span>
    `;
  }
  const ayahActive = activeTarget?.kind === "Ayah" && activeTarget.key === key;
  const transitionActive = activeTarget?.kind === "Transition" && activeTarget.key === transition;
  return `
    <span class="qword">${escapeHtml(match[1])}</span>
    ${transition ? `<span class="transition-mark ${strengthClass(getTransitionCount(transition), state.settings.transitionThresholds)} ${transitionActive ? "target" : ""}" data-transition="${transition}" aria-hidden="true"></span>` : ""}
    <button class="ayah-mark ${strengthClass(getAyahCount(key), state.settings.ayahThresholds)} ${ayahActive ? "target" : ""}" data-ayah="${key}" data-page="${pageNumber}" aria-label="${labelAyah(key)}">${match[2]}</button>
  `;
}
```

- [ ] **Step 4: Run tests and syntax check**

Run: `node --test tests/swipe-reveal.test.js`
Expected: PASS

Run: `npm.cmd run check`
Expected: PASS with `src/app.js` and `src/reader/swipe-reveal.js` syntax clean

- [ ] **Step 5: Commit**

```bash
git add src/app.js src/reader/swipe-reveal.js tests/swipe-reveal.test.js package.json
git commit -m "feat: add layered reader page markup"
```

### Task 3: Add prefetching and reveal-aware gesture flow

**Files:**
- Modify: `src/app.js`
- Test: `tests/swipe-reveal.test.js`

- [ ] **Step 1: Add the regression test for boundary-safe commit setup**

Append to `tests/swipe-reveal.test.js`:

```js
test("boundary direction can drag without producing a reveal page", () => {
  const direction = getRevealDirection({ dx: 90, dy: 10, startThreshold: 8 });
  assert.equal(direction, "next");
  assert.equal(getRevealPage({ currentPage: 604, direction, pageCount: 604 }), null);
});
```

- [ ] **Step 2: Run test to verify current behavior still protects the boundary**

Run: `node --test tests/swipe-reveal.test.js`
Expected: PASS

Run: `npm.cmd run check`
Expected: PASS

- [ ] **Step 3: Implement prefetch helpers and replace the page-shell gesture handlers**

Add cache helpers near `fetchPage()`:

```js
async function prefetchPage(page) {
  const safePage = clampPage(page);
  if (safePage !== page || prefetchedPages.has(safePage)) return prefetchedPages.get(safePage) || null;
  const data = await fetchPage(safePage);
  prefetchedPages.set(safePage, data);
  return data;
}

async function warmNeighborPages(page) {
  const targets = [page - 1, page + 1].filter((item) => item >= 1 && item <= PAGE_COUNT);
  await Promise.all(targets.map((target) => prefetchPage(target).catch(() => null)));
}
```

At the end of `openPage()`:

```js
  render();
  warmNeighborPages(route.page).catch(() => {});
}
```

Replace the current `pageShell` pointer handlers in `bindScreenEvents()` with reveal-aware drag logic:

```js
  const pageShell = app.querySelector(".page-shell");
  const activeSurface = app.querySelector(".active-page");
  if (pageShell && activeSurface) {
    pageShell.addEventListener("pointerdown", async (event) => {
      if (pageNavigationInFlight) return;
      swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      revealState = { direction: null, offset: 0, dragging: false };
      pageShell.setPointerCapture?.(event.pointerId);
    });

    pageShell.addEventListener("pointermove", async (event) => {
      if (!swipeStart || pageNavigationInFlight) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      const direction = getRevealDirection({ dx, dy, startThreshold: SWIPE_DRAG_START });
      if (!direction) return;
      revealState.direction = direction;
      revealState.dragging = true;
      revealState.offset = clampRevealOffset(dx, { maxOffset: 120, dragRatio: 0.45 });
      const revealPageNumber = getRevealPage({ currentPage: route.page, direction, pageCount: PAGE_COUNT });
      if (revealPageNumber && !prefetchedPages.has(revealPageNumber)) await prefetchPage(revealPageNumber);
      pageShell.dataset.revealDirection = direction;
      pageShell.style.setProperty("--page-drag-offset", `${revealState.offset}px`);
      pageShell.classList.add("dragging");
    });

    pageShell.addEventListener("pointerup", async (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;
      pageShell.releasePointerCapture?.(event.pointerId);
      if (revealState.direction && shouldCommitSwipe({ dx, dy, commitDistance: SWIPE_COMMIT_DISTANCE, verticalLimit: SWIPE_CANCEL_VERTICAL_LIMIT })) {
        await navigatePage(revealState.direction === "next" ? 1 : -1, { dragOffset: revealState.offset, useReveal: true });
        return;
      }
      resetRevealState(pageShell);
    });

    pageShell.addEventListener("pointercancel", () => {
      swipeStart = null;
      resetRevealState(pageShell);
    });
  }
```

Add a reset helper:

```js
function resetRevealState(pageShell) {
  revealState = { direction: null, offset: 0, dragging: false };
  pageShell?.classList.remove("dragging");
  pageShell?.style.removeProperty("--page-drag-offset");
  if (pageShell) delete pageShell.dataset.revealDirection;
}
```

Update `navigatePage()` to reuse prefetched data before falling back to `fetchPage()`:

```js
async function navigatePage(delta, options = {}) {
  if (pageNavigationInFlight) return;
  const next = route.page + delta;
  const shell = app.querySelector(".page-shell");
  if (next < 1 || next > PAGE_COUNT) {
    shell?.animate([{ transform: "translateX(0)" }, { transform: `translateX(${delta > 0 ? 12 : -12}px)` }, { transform: "translateX(0)" }], { duration: 180 });
    if (shell) resetRevealState(shell);
    if (navigator.vibrate && state.settings.vibration !== false) navigator.vibrate(12);
    return;
  }
  pageNavigationInFlight = true;
  try {
    const nextPageData = prefetchedPages.get(next) || await fetchPage(next);
    if (shell && options.useReveal) {
      await shell.animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(${delta > 0 ? 100 : -100}%)` }
        ],
        { duration: PAGE_TURN_DURATION, easing: PAGE_TURN_EASING }
      ).finished;
    }
    route = { screen: "reading", tab: route.tab, page: clampPage(next), target: null };
    currentPageData = nextPageData;
    state.recentPages = [route.page, ...state.recentPages.filter((item) => item !== route.page)].slice(0, 20);
    await saveState();
    render();
    resetRevealState(shell);
    warmNeighborPages(route.page).catch(() => {});
  } finally {
    pageNavigationInFlight = false;
  }
}
```

- [ ] **Step 4: Run tests and local checks**

Run: `node --test tests/swipe-reveal.test.js`
Expected: PASS

Run: `npm.cmd run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/swipe-reveal.test.js src/reader/swipe-reveal.js
git commit -m "feat: add reveal-aware reader swipe state"
```

### Task 4: Style the reveal layers and run end-to-end verification

**Files:**
- Modify: `src/styles.css`
- Test: `npm.cmd run check`

- [ ] **Step 1: Write the CSS update for layered surfaces**

In `src/styles.css`, replace the single-surface `.page-shell` assumptions with layered surface styles:

```css
.page-shell {
  --page-drag-offset: 0px;
  position: relative;
  overflow: hidden;
  margin-top: 8px;
  padding: 18px 15px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--surface) 88%, black);
  touch-action: pan-y;
  will-change: transform;
}

.page-surface {
  position: relative;
  min-height: 304px;
  border-radius: inherit;
}

.revealed-page {
  position: absolute;
  inset: 18px 15px;
  opacity: 0;
  transform: translateX(0) scale(.992);
  pointer-events: none;
}

.active-page {
  position: relative;
  z-index: 1;
  transform: translateX(var(--page-drag-offset));
  will-change: transform;
}

.page-shell[data-reveal-direction="next"] .revealed-page {
  opacity: 1;
  transform: translateX(18px) scale(.992);
}

.page-shell[data-reveal-direction="previous"] .revealed-page {
  opacity: 1;
  transform: translateX(-18px) scale(.992);
}

.ayah-mark.inert {
  pointer-events: none;
}
```

Add drag and settle polish:

```css
.page-shell.dragging .active-page {
  transition: none;
}

.page-shell:not(.dragging) .active-page,
.page-shell:not(.dragging) .revealed-page {
  transition: transform 220ms cubic-bezier(.2, .8, .2, 1), opacity 220ms cubic-bezier(.2, .8, .2, 1);
}
```

- [ ] **Step 2: Run syntax and tests**

Run: `npm.cmd run check`
Expected: PASS

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 3: Start the local server**

Run: `Start-Process -FilePath npm.cmd -ArgumentList 'run','dev' -WorkingDirectory 'C:\\Users\\user\\Documents\\Business\\Quran Memorization\\tap_hifz' -WindowStyle Hidden`
Expected: local server reachable at `http://127.0.0.1:4173`

- [ ] **Step 4: Verify the rendered interaction in the in-app browser**

Manual flow:

1. Open page 1 in the reader.
2. Drag right slowly and confirm page 2 becomes visible underneath before release.
3. Release before threshold and confirm the page returns to rest.
4. Drag right past threshold and confirm page 2 becomes active.
5. Drag left slowly and confirm page 1 becomes visible underneath.
6. Repeat on a middle page to verify both sides.
7. At page 1, drag left and confirm resistance with no blank layer.
8. Check console errors in the browser tooling.

Expected:

- no stuck `dragging` class
- no leftover inline transform
- only the top page responds to taps during reveal
- no console `error` or relevant `warn` entries

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/app.js tests/swipe-reveal.test.js src/reader/swipe-reveal.js package.json
git commit -m "feat: add layered swipe reveal to reader"
```
