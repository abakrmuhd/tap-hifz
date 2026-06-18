# Tap Hifz Critical Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make weak-item routing, page summaries, bookmark actions, and reader target highlighting page-accurate using generated page-local metadata.

**Architecture:** Generate one app-owned metadata artifact from the bundled mushaf JSON, then route all page-sensitive UI behavior through that metadata instead of inferring page membership from surah membership. Keep the current static-app structure, add a small generator script plus a pure metadata helper module, and refactor `src/app.js` to consume the generated data.

**Tech Stack:** Static HTML app, browser ES modules, Node built-in test runner, Node filesystem script, bundled `public/mushaf/page-*.json`.

---

### Task 1: Add testable metadata helpers and failing tests

**Files:**
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\data\metadata-logic.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\metadata-logic.test.js`
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\package.json`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMetadataFromPages,
  buildWeakItems,
  getPageStrength
} from "../src/data/metadata-logic.js";

const samplePages = {
  1: {
    lines: [
      {
        type: "text",
        verseRange: "1:1-1:2",
        words: [
          { location: "1:1:1", word: "Word ١" },
          { location: "1:2:1", word: "Word ٢" }
        ]
      }
    ]
  },
  2: {
    lines: [
      {
        type: "text",
        verseRange: "2:1-2:2",
        words: [
          { location: "2:1:1", word: "Word ١" },
          { location: "2:2:1", word: "Word ٢" }
        ]
      }
    ]
  }
};

test("buildMetadataFromPages maps ayahs and transitions to exact pages", () => {
  const metadata = buildMetadataFromPages(samplePages, [{ number: 1, startPage: 1, endPage: 2 }]);

  assert.deepEqual(metadata.pages["1"].ayahKeys, ["1:1", "1:2"]);
  assert.deepEqual(metadata.pages["1"].transitionKeys, ["1|1:1|1:2"]);
  assert.equal(metadata.ayahToPage["2:2"], 2);
});

test("getPageStrength only uses ayahs that belong to the requested page", () => {
  const metadata = buildMetadataFromPages(samplePages, [{ number: 1, startPage: 1, endPage: 2 }]);
  const thresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
  const ayahProgress = {
    "1:1": { repetitionCount: 2 },
    "2:1": { repetitionCount: 30 }
  };

  assert.equal(getPageStrength(1, metadata, ayahProgress, thresholds), "weak");
  assert.equal(getPageStrength(2, metadata, ayahProgress, thresholds), "strong");
});

test("buildWeakItems resolves ayah page by exact ayahToPage mapping", () => {
  const metadata = buildMetadataFromPages(samplePages, [{ number: 1, startPage: 1, endPage: 2 }]);
  const weakItems = buildWeakItems({
    metadata,
    ayahProgress: { "2:2": { repetitionCount: 1 } },
    transitionProgress: {},
    ayahThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    transitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    labelAyah: (key) => key,
    labelTransition: (key) => key
  });

  assert.equal(weakItems[0].page, 2);
  assert.equal(weakItems[0].key, "2:2");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/metadata-logic.test.js`
Expected: FAIL with module-not-found or missing export errors for `metadata-logic.js`

- [ ] **Step 3: Write minimal implementation**

```js
const ARABIC_NUMBER_AT_END = /^(.*?)(?:\s+)?([٠-٩]+)$/;

export function buildMetadataFromPages(pageMap, juzRanges) {
  const pages = {};
  const ayahToPage = {};
  const surahStarts = new Map();

  for (const [pageNumber, pageData] of Object.entries(pageMap)) {
    const page = Number(pageNumber);
    const ayahKeys = [];
    const surahsPresent = new Set();

    for (const line of pageData.lines || []) {
      if (line.surah && !surahStarts.has(Number(line.surah))) {
        surahStarts.set(Number(line.surah), page);
      }
      if (line.surah) surahsPresent.add(Number(line.surah));
      if (line.verseRange) {
        const [start, end] = line.verseRange.split("-");
        surahsPresent.add(Number(start.split(":")[0]));
        surahsPresent.add(Number(end.split(":")[0]));
      }
      for (const word of line.words || []) {
        const text = word.word || "";
        if (!ARABIC_NUMBER_AT_END.test(text)) continue;
        const [surah, ayah] = word.location.split(":").map(Number);
        const key = `${surah}:${ayah}`;
        ayahKeys.push(key);
        ayahToPage[key] = page;
      }
    }

    const uniqueAyahKeys = [...new Set(ayahKeys)];
    const transitionKeys = uniqueAyahKeys.slice(1).map((key, index) => `${page}|${uniqueAyahKeys[index]}|${key}`);
    const labelLine = (pageData.lines || []).find((line) => line.verseRange);

    pages[String(page)] = {
      label: labelLine ? labelLine.verseRange.split("-")[0] : `Page ${page}`,
      surahsPresent: [...surahsPresent],
      juz: juzRanges.find((item) => page >= item.startPage && page <= item.endPage)?.number ?? 1,
      ayahKeys: uniqueAyahKeys,
      transitionKeys
    };
  }

  return {
    pages,
    ayahToPage,
    surahs: [...surahStarts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, startPage]) => ({ number, arabicName: `Surah ${number}`, startPage })),
    juz: juzRanges
  };
}

export function getStrengthClass(count, thresholds) {
  if (count <= 0) return "empty";
  if (count <= thresholds.weakMax) return "weak";
  if (count <= thresholds.buildingMax) return "building";
  if (count <= thresholds.strongMax) return "strong";
  return "mastered";
}

export function getPageStrength(page, metadata, ayahProgress, thresholds) {
  const ayahKeys = metadata.pages[String(page)]?.ayahKeys || [];
  if (!ayahKeys.length) return "empty";
  const rank = { empty: 0, weak: 1, building: 2, strong: 3, mastered: 4 };
  return ayahKeys
    .map((key) => getStrengthClass(ayahProgress[key]?.repetitionCount || 0, thresholds))
    .sort((a, b) => rank[a] - rank[b])[0];
}

export function buildWeakItems({
  metadata,
  ayahProgress,
  transitionProgress,
  ayahThresholds,
  transitionThresholds,
  labelAyah,
  labelTransition
}) {
  const ayahs = Object.entries(ayahProgress)
    .filter(([, value]) => value.repetitionCount > 0 && value.repetitionCount <= ayahThresholds.weakMax)
    .map(([key, value]) => ({
      kind: "Ayah",
      key,
      count: value.repetitionCount,
      page: metadata.ayahToPage[key],
      label: labelAyah(key),
      level: 1
    }));

  const transitions = Object.entries(transitionProgress)
    .filter(([, value]) => value.repetitionCount > 0 && value.repetitionCount <= transitionThresholds.weakMax)
    .map(([key, value]) => ({
      kind: "Transition",
      key,
      count: value.repetitionCount,
      page: Number(key.split("|")[0]),
      label: labelTransition(key),
      level: 1
    }));

  return [...ayahs, ...transitions].sort((a, b) => a.level - b.level || a.count - b.count || a.page - b.page);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/metadata-logic.test.js`
Expected: PASS with 3 passing tests

- [ ] **Step 5: Commit**

```bash
git add package.json tests/metadata-logic.test.js src/data/metadata-logic.js
git commit -m "test: add metadata correctness coverage"
```

### Task 2: Generate committed mushaf metadata

**Files:**
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\scripts\generate-mushaf-metadata.js`
- Create: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\data\mushaf-metadata.json`
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\package.json`

- [ ] **Step 1: Write the failing verification test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import metadata from "../src/data/mushaf-metadata.json" with { type: "json" };

test("generated mushaf metadata contains page-local ayah and transition indexes", () => {
  assert.equal(metadata.ayahToPage["1:1"], 1);
  assert.ok(metadata.pages["1"].ayahKeys.includes("1:7"));
  assert.ok(metadata.pages["1"].transitionKeys.includes("1|1:6|1:7"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mushaf-metadata.test.js`
Expected: FAIL because `src/data/mushaf-metadata.json` and test file do not exist yet

- [ ] **Step 3: Add generator and metadata artifact**

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JUZ_RANGES } from "../src/data/juz.js";
import { buildMetadataFromPages } from "../src/data/metadata-logic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const mushafDir = path.join(root, "public", "mushaf");
const outputPath = path.join(root, "src", "data", "mushaf-metadata.json");

const files = (await fs.readdir(mushafDir)).filter((name) => name.endsWith(".json")).sort();
const pageMap = {};

for (const file of files) {
  const fullPath = path.join(mushafDir, file);
  const pageData = JSON.parse(await fs.readFile(fullPath, "utf8"));
  pageMap[pageData.page] = pageData;
}

const juzRanges = JUZ_RANGES.map(([number, startPage, endPage]) => ({ number, startPage, endPage }));
const metadata = buildMetadataFromPages(pageMap, juzRanges);

await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2));
console.log(`Wrote ${outputPath}`);
```

- [ ] **Step 4: Run generator and metadata test**

Run:
- `node scripts/generate-mushaf-metadata.js`
- `node --test tests/mushaf-metadata.test.js`

Expected:
- generator prints `Wrote ...mushaf-metadata.json`
- metadata test PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-mushaf-metadata.js src/data/mushaf-metadata.json tests/mushaf-metadata.test.js package.json
git commit -m "feat: add generated mushaf page metadata"
```

### Task 3: Refactor runtime correctness to use generated metadata

**Files:**
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\app.js`
- Test: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\tests\metadata-logic.test.js`

- [ ] **Step 1: Write the failing behavior test**

```js
test("buildWeakItems and getPageStrength support bookmark and review page accuracy", () => {
  const metadata = buildMetadataFromPages({
    48: {
      lines: [
        {
          type: "text",
          verseRange: "2:281-2:282",
          words: [
            { location: "2:281:1", word: "Word ٢٨١" },
            { location: "2:282:1", word: "Word ٢٨٢" }
          ]
        }
      ]
    },
    49: {
      lines: [
        {
          type: "text",
          verseRange: "2:283-2:283",
          words: [
            { location: "2:283:1", word: "Word ٢٨٣" }
          ]
        }
      ]
    }
  }, [{ number: 3, startPage: 42, endPage: 61 }]);

  const weakItems = buildWeakItems({
    metadata,
    ayahProgress: { "2:283": { repetitionCount: 2 } },
    transitionProgress: { "48|2:281|2:282": { repetitionCount: 1 } },
    ayahThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    transitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    labelAyah: (key) => key,
    labelTransition: (key) => key
  });

  assert.equal(weakItems.find((item) => item.key === "2:283").page, 49);
  assert.equal(weakItems.find((item) => item.key === "48|2:281|2:282").page, 48);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/metadata-logic.test.js`
Expected: FAIL if helper or routing assumptions are still incomplete

- [ ] **Step 3: Update runtime to consume metadata**

```js
import mushafMetadata from "./data/mushaf-metadata.json" with { type: "json" };
import {
  buildWeakItems,
  getPageStrength,
  getStrengthClass
} from "./data/metadata-logic.js";

// in init
metadata = mushafMetadata;

// pageStrength(page)
return getPageStrength(page, metadata, state.ayahProgress, state.settings.ayahThresholds);

// getWeakItems()
return buildWeakItems({
  metadata,
  ayahProgress: state.ayahProgress,
  transitionProgress: state.transitionProgress,
  ayahThresholds: state.settings.ayahThresholds,
  transitionThresholds: state.settings.transitionThresholds,
  labelAyah,
  labelTransition
});

// pageForAyah(key)
return metadata.ayahToPage[key] || route.page;

// reader active target
const activeTarget = review ? review.queue[review.index] : route.target ? resolveRouteTarget(route.target) : null;
```

- [ ] **Step 4: Run verification**

Run:
- `node --test tests/metadata-logic.test.js`
- `node --check src/app.js`

Expected:
- tests PASS
- syntax check PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.js src/data/metadata-logic.js src/data/mushaf-metadata.json tests/metadata-logic.test.js
git commit -m "feat: use page-local metadata for progress and routing"
```

### Task 4: Fix bookmark removal and non-review target highlighting

**Files:**
- Modify: `C:\Users\user\Documents\Business\Quran Memorization\tap_hifz\src\app.js`

- [ ] **Step 1: Write the failing test**

```js
test("reader target resolution prefers review target and falls back to route target", () => {
  const routeTarget = { kind: "Ayah", key: "2:282" };
  const reviewTarget = { kind: "Transition", key: "48|2:281|2:282" };

  assert.deepEqual(resolveActiveTarget({ review: null, routeTarget }), routeTarget);
  assert.deepEqual(resolveActiveTarget({ review: { queue: [reviewTarget], index: 0 }, routeTarget }), reviewTarget);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/metadata-logic.test.js`
Expected: FAIL because target resolver is missing

- [ ] **Step 3: Add minimal implementation and wire handlers**

```js
export function resolveActiveTarget({ review, routeTarget }) {
  if (review && !review.done) return review.queue[review.index] || null;
  return routeTarget || null;
}

function removePageBookmark(page) {
  state.pageBookmarks = state.pageBookmarks.filter((item) => item !== page);
  saveState();
  render();
}

function removeAyahBookmark(key) {
  state.ayahBookmarks = state.ayahBookmarks.filter((item) => item.key !== key);
  saveState();
  render();
}
```

Also in `bindScreenEvents()`:

```js
app.querySelectorAll("[data-remove-page-bookmark]").forEach((button) =>
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    removePageBookmark(Number(button.dataset.removePageBookmark));
  })
);

app.querySelectorAll("[data-remove-ayah-bookmark]").forEach((button) =>
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    removeAyahBookmark(button.dataset.removeAyahBookmark);
  })
);
```

- [ ] **Step 4: Run verification**

Run:
- `node --test tests/metadata-logic.test.js`
- `node --check src/app.js`

Expected:
- tests PASS
- syntax check PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/metadata-logic.test.js
git commit -m "feat: fix bookmark actions and reader target highlighting"
```
