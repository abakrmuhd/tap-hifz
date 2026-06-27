# Muhaffidh-Style QCF4 Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, offline-capable QCF4 glyph renderer that gives Tap Hifz the same full reading-page look as Muhaffidh while preserving Tap Hifz tracking interactions.

**Architecture:** Add a QCF4 asset/data pipeline, then add a renderer boundary beside the current Unicode renderer. The reader loads QCF4 page data when present, renders Muhaffidh-style `mushaf-page` markup, and falls back to the existing renderer until all 604 QCF4 pages exist.

**Tech Stack:** Vanilla ES modules, static JSON assets, CSS custom elements/selectors, Node generation scripts, Node `node:test`.

---

## File Structure

- Create `scripts/sync-qcf4-assets.js`: downloads local QCF4 font assets from Nuqayah's QCF4 font endpoint.
- Create `scripts/inspect-qcf4-source.js`: validates that the implementation has the exact QCF4 Hafs font and mapping sources needed for Muhaffidh-style rendering.
- Create `scripts/generate-qcf4-pages.js`: converts exact QCF4 Hafs mapping data into local page JSON. The script must fail if it cannot identify page, line, ayah, word glyph, and font-family information.
- Create `src/reader/qcf4-data.js`: fetch/cache helper for `public/mushaf-qcf4/page-###.json`.
- Create `src/reader/qcf4-renderer.js`: pure HTML renderer for QCF-style page data.
- Create `src/reader/qcf4-logic.js`: pure helpers for ayah-group extraction and transition maps.
- Create `tests/qcf4-renderer.test.js`: renderer and helper tests.
- Create `public/fonts/qcf4/.gitkeep`: keeps the font directory in git before downloaded binary assets are added.
- Create generated `public/mushaf-qcf4/page-001.json` through `page-604.json` after the exact source format is validated.
- Modify `src/app.js`: load QCF4 page data beside existing page data and choose the QCF4 renderer when available.
- Modify `src/styles.css`: add Muhaffidh-style page, glyph, header, footer, and overlay styles.
- Modify `src/data/offline-assets.js`: include QCF4 JSON and font assets in the offline cache.
- Modify `package.json`: add asset sync and QCF4 generation scripts.
- Modify `index.html` and `src/startup-loader.js`: bump asset versions after browser-visible changes.

## Task 1: Add QCF4 Asset Sync Script

**Files:**
- Create: `scripts/sync-qcf4-assets.js`
- Create: `public/fonts/qcf4/.gitkeep`
- Modify: `package.json`

- [ ] **Step 1: Create the font directory sentinel**

Use `apply_patch`:

```diff
*** Begin Patch
*** Add File: public/fonts/qcf4/.gitkeep
+
*** End Patch
```

- [ ] **Step 2: Add the asset sync script**

Create `scripts/sync-qcf4-assets.js` with:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "public", "fonts", "qcf4");

const QCF4_FONT_FILES = [
  "QCF4_QBSML.woff2",
  ...Array.from({ length: 47 }, (_, index) => `QCF4_Hafs_${String(index + 1).padStart(2, "0")}_W.woff2`)
];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

await fs.mkdir(outputDir, { recursive: true });

for (const file of QCF4_FONT_FILES) {
  const target = path.join(outputDir, file);
  const url = `https://fonts.nuqayah.com/qcf4/${file}`;
  const bytes = await download(url);
  await fs.writeFile(target, bytes);
  console.log(`Wrote ${target}`);
}
```

- [ ] **Step 3: Add npm script**

Modify `package.json` scripts:

```json
"sync:qcf4-assets": "node scripts/sync-qcf4-assets.js"
```

- [ ] **Step 4: Run syntax check for the script**

Run:

```bash
node --check scripts/sync-qcf4-assets.js
```

Expected: no output and exit code `0`.

- [ ] **Step 5: Download the font assets**

Run:

```bash
npm run sync:qcf4-assets
```

Expected: `public/fonts/qcf4/` contains `QCF4_QBSML.woff2` and `QCF4_Hafs_01_W.woff2` through `QCF4_Hafs_47_W.woff2`.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/sync-qcf4-assets.js public/fonts/qcf4
git commit -m "Add QCF4 font asset sync"
```

## Task 2: Validate Exact QCF4 Source Inputs

**Files:**
- Create: `scripts/inspect-qcf4-source.js`
- Modify: `package.json`

- [ ] **Step 1: Add source inspection script**

Create `scripts/inspect-qcf4-source.js` with:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const fontDir = path.join(root, "public", "fonts", "qcf4");

const requiredFonts = [
  "QCF4_QBSML.woff2",
  ...Array.from({ length: 47 }, (_, index) => `QCF4_Hafs_${String(index + 1).padStart(2, "0")}_W.woff2`)
];

async function assertFile(file) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile() || stat.size === 0) throw new Error(`Missing required file: ${file}`);
}

for (const font of requiredFonts) {
  await assertFile(path.join(fontDir, font));
}

console.log(`Validated ${requiredFonts.length} QCF4 font files`);
console.log("Next gate: add exact QCF4 Hafs mapping source before running generate:qcf4-pages");
```

- [ ] **Step 2: Add npm script**

Modify `package.json` scripts:

```json
"inspect:qcf4-source": "node scripts/inspect-qcf4-source.js"
```

- [ ] **Step 3: Run inspection**

Run:

```bash
npm run inspect:qcf4-source
```

Expected after Task 1: `Validated 48 QCF4 font files`.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/inspect-qcf4-source.js
git commit -m "Validate QCF source assets"
```

## Task 3: Generate Exact QCF Page Data

**Files:**
- Create: `scripts/generate-qcf4-pages.js`
- Create: `public/mushaf-qcf4/page-001.json` through `public/mushaf-qcf4/page-604.json`
- Modify: `package.json`

- [ ] **Step 1: Add the generator script**

Create `scripts/generate-qcf4-pages.js` with this fail-fast scaffold first:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "public", "qcf4-source");
const outputDir = path.join(root, "public", "mushaf-qcf4");

const requiredFields = ["page", "lineNumber", "fontFamily", "glyph", "surah", "ayah", "wordIndex"];

async function readSourceRows() {
  const sourcePath = path.join(sourceDir, "qcf4-hafs-words.json");
  const text = await fs.readFile(sourcePath, "utf8").catch(() => {
    throw new Error(`Missing exact QCF4 mapping source: ${sourcePath}`);
  });
  const rows = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("QCF4 mapping source must be a non-empty array");
  for (const field of requiredFields) {
    if (!(field in rows[0])) throw new Error(`QCF4 mapping rows must include ${field}`);
  }
  return rows;
}

function groupByPage(rows) {
  const pages = new Map();
  for (const row of rows) {
    if (!pages.has(row.page)) pages.set(row.page, []);
    pages.get(row.page).push(row);
  }
  return pages;
}

function groupLineRows(rows) {
  const groups = [];
  for (const row of rows) {
    const key = `${row.surah}:${row.ayah}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, surah: row.surah, ayah: row.ayah, words: [] };
      groups.push(group);
    }
    group.words.push({
      glyph: row.glyph,
      surah: row.surah,
      ayah: row.ayah,
      wordIndex: row.wordIndex,
      fontFamily: row.fontFamily
    });
  }
  return groups;
}

function buildPage(page, rows) {
  const byLine = new Map();
  for (const row of rows) {
    if (!byLine.has(row.lineNumber)) byLine.set(row.lineNumber, []);
    byLine.get(row.lineNumber).push(row);
  }
  return {
    page,
    face: page % 2 ? "right" : "left",
    header: { pageNumber: page },
    lines: [...byLine.entries()]
      .sort(([a], [b]) => a - b)
      .map(([lineNumber, lineRows]) => ({
        type: "text",
        lineNumber,
        fontFamily: lineRows[0].fontFamily,
        justify: page > 2,
        ayahGroups: groupLineRows(lineRows)
      }))
  };
}

await fs.mkdir(outputDir, { recursive: true });

const pages = groupByPage(await readSourceRows());
if (pages.size !== 604) throw new Error(`Expected 604 pages, got ${pages.size}`);

for (const [page, rows] of pages) {
  const padded = String(page).padStart(3, "0");
  const outputPath = path.join(outputDir, `page-${padded}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(buildPage(page, rows), null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
}
```

This scaffold intentionally requires `public/qcf4-source/qcf4-hafs-words.json`. During execution, create that file from the exact `nuqayah/qpc-fonts` QCF4 Hafs mapping source. Its rows must have this normalized shape:

```json
{
  "page": 1,
  "lineNumber": 1,
  "fontFamily": "QCF2001",
  "glyph": "",
  "surah": 1,
  "ayah": 1,
  "wordIndex": 1
}
```

- [ ] **Step 2: Add npm script**

Modify `package.json` scripts:

```json
"generate:qcf4-pages": "node scripts/generate-qcf4-pages.js"
```

- [ ] **Step 3: Run the generator**

Run:

```bash
npm run generate:qcf4-pages
```

Expected: four JSON files appear under `public/mushaf-qcf4/`.

- [ ] **Step 4: Validate JSON shape**

Run:

```bash
node -e "const fs=require('fs'); const files=fs.readdirSync('public/mushaf-qcf4').filter(f=>f.endsWith('.json')); if(files.length!==604) throw new Error('expected 604 qcf4 pages'); for (const p of [1,2,585,596,604]) { const f='public/mushaf-qcf4/page-'+String(p).padStart(3,'0')+'.json'; const d=JSON.parse(fs.readFileSync(f,'utf8')); if (!d.page || !Array.isArray(d.lines)) throw new Error(f); } console.log('qcf4 pages ok')"
```

Expected: `qcf4 pages ok`.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/generate-qcf4-pages.js public/qcf4-source public/mushaf-qcf4
git commit -m "Generate QCF page data"
```

## Task 4: Add Pure QCF4 Data and Logic Helpers

**Files:**
- Create: `src/reader/qcf4-data.js`
- Create: `src/reader/qcf4-logic.js`
- Create: `tests/qcf4-renderer.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests**

Create `tests/qcf4-renderer.test.js` with:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQcf4PreviousAyahMap,
  collectQcf4AyahKeys,
  qcf4PagePath
} from "../src/reader/qcf4-logic.js";

const page = {
  page: 1,
  lines: [
    { type: "surah-header", text: "الفاتحة" },
    {
      type: "text",
      ayahGroups: [
        { key: "1:1", surah: 1, ayah: 1, words: [{ glyph: "a" }] },
        { key: "1:2", surah: 1, ayah: 2, words: [{ glyph: "b" }] }
      ]
    },
    {
      type: "text",
      ayahGroups: [
        { key: "1:3", surah: 1, ayah: 3, words: [{ glyph: "c" }] }
      ]
    }
  ]
};

test("qcf4PagePath pads page numbers", () => {
  assert.equal(qcf4PagePath(1), "/public/mushaf-qcf4/page-001.json");
  assert.equal(qcf4PagePath(596), "/public/mushaf-qcf4/page-596.json");
});

test("collectQcf4AyahKeys returns page-local ayahs in visual order", () => {
  assert.deepEqual(collectQcf4AyahKeys(page), ["1:1", "1:2", "1:3"]);
});

test("buildQcf4PreviousAyahMap maps each ayah to its incoming page-local ayah", () => {
  const map = buildQcf4PreviousAyahMap(page);
  assert.equal(map.get("1:1"), null);
  assert.equal(map.get("1:2"), "1:1");
  assert.equal(map.get("1:3"), "1:2");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/qcf4-renderer.test.js
```

Expected: FAIL because `src/reader/qcf4-logic.js` does not exist.

- [ ] **Step 3: Implement pure helpers**

Create `src/reader/qcf4-logic.js`:

```js
export function qcf4PagePath(page) {
  return `/public/mushaf-qcf4/page-${String(page).padStart(3, "0")}.json`;
}

export function collectQcf4AyahKeys(pageData) {
  const keys = [];
  for (const line of pageData?.lines || []) {
    for (const group of line.ayahGroups || []) {
      if (group?.key && keys[keys.length - 1] !== group.key) keys.push(group.key);
    }
  }
  return keys;
}

export function buildQcf4PreviousAyahMap(pageData) {
  const keys = collectQcf4AyahKeys(pageData);
  const map = new Map();
  keys.forEach((key, index) => {
    map.set(key, index > 0 ? keys[index - 1] : null);
  });
  return map;
}
```

Create `src/reader/qcf4-data.js`:

```js
import { qcf4PagePath } from "./qcf4-logic.js";

export async function fetchQcf4Page(page) {
  const response = await fetch(qcf4PagePath(page));
  if (!response.ok) return null;
  return response.json();
}
```

- [ ] **Step 4: Add syntax check entries**

Modify `package.json` `check` script to include:

```bash
node --check src/reader/qcf4-data.js && node --check src/reader/qcf4-logic.js
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
node --test tests/qcf4-renderer.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json src/reader/qcf4-data.js src/reader/qcf4-logic.js tests/qcf4-renderer.test.js
git commit -m "Add QCF page data helpers"
```

## Task 5: Add Pure QCF4 Renderer

**Files:**
- Create: `src/reader/qcf4-renderer.js`
- Modify: `tests/qcf4-renderer.test.js`
- Modify: `package.json`

- [ ] **Step 1: Add failing renderer tests**

Append to `tests/qcf4-renderer.test.js`:

```js
import { renderQcf4Page } from "../src/reader/qcf4-renderer.js";

test("renderQcf4Page mirrors Muhaffidh-style structure", () => {
  const html = renderQcf4Page(page, {
    inert: false,
    activeTarget: null,
    buildAyahAttrs: (key) => `data-ayah="${key}"`,
    buildGroupClass: () => "ayah-group"
  });

  assert.match(html, /<mushaf-page/);
  assert.match(html, /<mushaf-page-inner>/);
  assert.match(html, /class="ayah-chars/);
  assert.match(html, /class="line/);
  assert.match(html, /class="ayah-group"/);
  assert.match(html, /data-ayah="1:1"/);
  assert.match(html, /class="word"/);
});

test("renderQcf4Page omits interactive ayah attrs for inert pages", () => {
  const html = renderQcf4Page(page, {
    inert: true,
    activeTarget: null,
    buildAyahAttrs: (key) => `data-ayah="${key}"`,
    buildGroupClass: () => "ayah-group"
  });

  assert.doesNotMatch(html, /data-ayah="1:1"/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/qcf4-renderer.test.js
```

Expected: FAIL because `src/reader/qcf4-renderer.js` does not exist.

- [ ] **Step 3: Implement renderer**

Create `src/reader/qcf4-renderer.js`:

```js
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderWords(words = [], fontFamily) {
  return words.map((word, index) => {
    const family = escapeHtml(word.fontFamily || fontFamily || "QCF2001");
    const glyph = escapeHtml(word.glyph || "");
    const space = index < words.length - 1 ? '<span class="space"> </span>' : "";
    return `<span class="word" style="font-family: '${family}'">${glyph}</span>${space}`;
  }).join("");
}

function renderAyahGroup(group, line, options) {
  const attrs = options.inert ? "" : ` ${options.buildAyahAttrs(group.key, group)}`;
  const className = options.buildGroupClass(group.key, group);
  return `<span class="${escapeHtml(className)}"${attrs}>${renderWords(group.words, line.fontFamily)}</span>`;
}

function renderLine(line, options) {
  if (line.type === "surah-header") {
    return `<span class="line centered-line"><span class="surah" style="font-family: '${escapeHtml(line.fontFamily || "QCF2000")}'">${escapeHtml(line.text || "")}</span></span>`;
  }

  if (line.type === "basmala") {
    return `<span class="line centered-line"><span class="basmalah" style="font-family: '${escapeHtml(line.fontFamily || "QCF4_QBSML")}'">${escapeHtml(line.text || "")}</span></span>`;
  }

  const justify = line.justify ? " justify" : "";
  const groups = (line.ayahGroups || []).map((group) => renderAyahGroup(group, line, options)).join("");
  return `<span class="line${justify}">${groups}</span>`;
}

export function renderQcf4Page(pageData, options) {
  const lines = (pageData.lines || []).map((line) => renderLine(line, options)).join("");
  return `
    <mushaf-page data-page="${pageData.page}" data-page-face="${pageData.face || ""}">
      <mushaf-page-inner>
        <header class="page-header" aria-label="Page Header">
          <div class="page-header-side"></div>
          <div id="page-number">${pageData.header?.pageNumber || pageData.page}</div>
          <div class="page-header-side"></div>
        </header>
        <div class="page-content">
          <div class="ayah-chars">${lines}</div>
        </div>
        <footer><span>${pageData.page}</span></footer>
      </mushaf-page-inner>
    </mushaf-page>
  `;
}
```

- [ ] **Step 4: Add syntax check entry**

Modify `package.json` `check` script to include:

```bash
node --check src/reader/qcf4-renderer.js
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
node --test tests/qcf4-renderer.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json src/reader/qcf4-renderer.js tests/qcf4-renderer.test.js
git commit -m "Add QCF page renderer"
```

## Task 6: Wire QCF4 Data into Reader Slots

**Files:**
- Modify: `src/app.js`
- Modify: `tests/qcf4-renderer.test.js`

- [ ] **Step 1: Add app imports**

Modify `src/app.js` imports:

```js
import { fetchQcf4Page } from "./reader/qcf4-data.js?v=2026-06-26-qcf4-renderer";
import { buildQcf4PreviousAyahMap } from "./reader/qcf4-logic.js?v=2026-06-26-qcf4-renderer";
import { renderQcf4Page } from "./reader/qcf4-renderer.js?v=2026-06-26-qcf4-renderer";
```

- [ ] **Step 2: Add QCF4 cache**

Near `let pageCache = new Map();`, add:

```js
let qcf4PageCache = new Map();
```

- [ ] **Step 3: Add cached loader**

Add below `getPageData`:

```js
async function getQcf4PageData(page) {
  if (!page) return null;
  if (qcf4PageCache.has(page)) return qcf4PageCache.get(page);
  const data = await fetchQcf4Page(page);
  qcf4PageCache.set(page, data);
  return data;
}
```

- [ ] **Step 4: Load QCF4 data beside existing data**

Modify `loadTrackPages` to load both standard and QCF4 pages:

```js
async function loadTrackPages(currentPage) {
  const pages = buildTrackPages({ currentPage, pageCount: PAGE_COUNT });
  const [previous, current, next, previousQcf4, currentQcf4, nextQcf4] = await Promise.all([
    pages.previous ? getPageData(pages.previous).catch(() => null) : Promise.resolve(null),
    getPageData(pages.current),
    pages.next ? getPageData(pages.next).catch(() => null) : Promise.resolve(null),
    pages.previous ? getQcf4PageData(pages.previous).catch(() => null) : Promise.resolve(null),
    getQcf4PageData(pages.current).catch(() => null),
    pages.next ? getQcf4PageData(pages.next).catch(() => null) : Promise.resolve(null)
  ]);
  return {
    numbers: pages,
    data: {
      previous: { legacy: previous, qcf4: previousQcf4 },
      current: { legacy: current, qcf4: currentQcf4 },
      next: { legacy: next, qcf4: nextQcf4 }
    }
  };
}
```

- [ ] **Step 5: Update `renderPageSlot` for wrapper data**

At the top of `renderPageSlot`, normalize:

```js
const legacyPageData = pageData?.legacy || pageData;
const qcf4PageData = pageData?.qcf4 || null;
```

Then use `legacyPageData` for the old path. If `qcf4PageData` exists, return a QCF4 slot:

```js
if (qcf4PageData) {
  const previousAyahMap = buildQcf4PreviousAyahMap(qcf4PageData);
  const parity = pageNumber % 2 ? "odd" : "even";
  const qcf4Html = renderQcf4Page(qcf4PageData, {
    inert,
    activeTarget,
    buildGroupClass: (key) => {
      const classes = ["ayah-group"];
      if (activeTarget?.kind === "Ayah" && activeTarget.key === key) classes.push("target");
      return classes.join(" ");
    },
    buildAyahAttrs: (key) => {
      const previous = previousAyahMap.get(key);
      const transition = previous ? transitionKey(pageNumber, previous, key) : null;
      const ringState = buildRepetitionRingState({
        repetitionCount: getRepetitionCount(key),
        transitionCount: transition ? getTransitionCount(transition) : null,
        repetitionThresholds: state.settings.repetitionThresholds,
        transitionCountThresholds: state.settings.transitionCountThresholds
      });
      const transitionArcStyle = ringState.hasTransitionRing
        ? ` style="--transition-arc: ${ringState.transitionArcDegrees}deg"`
        : "";
      return `data-ayah="${key}" data-page="${pageNumber}" data-qcf4-ayah="true"${transitionArcStyle}`;
    }
  });
  return `<div class="page-slot ${slotName} ${parity} qcf4-slot" ${inert ? 'aria-hidden="true"' : ""}>${qcf4Html}</div>`;
}
```

- [ ] **Step 6: Preserve old fallback**

Keep the existing `.mushaf` fallback with `legacyPageData`:

```js
const previousAyahMap = buildPreviousAyahMap(legacyPageData);
const lines = legacyPageData.lines.map((line) => renderLine(line, activeTarget, { inert, pageNumber, previousAyahMap })).join("");
```

- [ ] **Step 7: Run syntax check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app.js
git commit -m "Wire QCF page data into reader"
```

## Task 7: Add Muhaffidh-Style CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add QCF4 font-face declarations**

Add near font/global styles:

```css
@font-face {
  font-family: "QCF4_QBSML";
  src: url("/public/fonts/qcf4/QCF4_QBSML.woff2") format("woff2");
  font-display: block;
}

@font-face {
  font-family: "QCF2001";
  src: url("/public/fonts/qcf4/QCF4_Hafs_01_W.woff2") format("woff2");
  font-display: block;
}
```

- [ ] **Step 2: Add QCF4 page styles**

Add after the existing `.mushaf` styles:

```css
.qcf4-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

mushaf-page {
  --quran-font-size: 29px;
  --quran-line-height: 44px;
  text-align: justify;
  text-align-last: justify;
  user-select: none;
  justify-content: center;
  align-items: center;
  width: min(100%, 512px);
  aspect-ratio: 512 / 910;
  display: flex;
}

mushaf-page-inner {
  -webkit-font-smoothing: antialiased;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100%;
  display: flex;
}

mushaf-page .page-header {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: "QCF2001", serif;
}

mushaf-page #page-number {
  min-width: 32px;
  text-align: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--panel) 80%, white 20%);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.2;
}

mushaf-page .page-content {
  width: 98%;
}

.ayah-chars {
  color: var(--ink);
  font-size: var(--quran-font-size);
  letter-spacing: -2.1px;
  white-space: nowrap;
  text-align-last: justify;
  line-height: var(--quran-line-height);
  unicode-bidi: bidi-override;
}

.ayah-chars .line {
  display: block;
  width: 100%;
  min-height: var(--quran-line-height);
  unicode-bidi: bidi-override;
}

.ayah-chars .centered-line {
  text-align: center;
  text-align-last: center;
  letter-spacing: 1.64px;
}

.ayah-chars .word {
  position: relative;
}

.ayah-chars .space {
  font-size: 2px;
}

.ayah-group {
  position: relative;
  cursor: pointer;
}

.ayah-group::before {
  content: "";
  position: absolute;
  inset: -0.35em -0.2em;
  border-radius: 999px;
  pointer-events: none;
}

.ayah-group.target::before {
  background: color-mix(in srgb, var(--accent) 24%, transparent);
}

mushaf-page footer {
  width: 100%;
  min-height: 28px;
  display: flex;
  align-items: end;
  border-top: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
  font-size: 14px;
}

mushaf-page[data-page-face="right"] footer {
  justify-content: flex-end;
}

mushaf-page[data-page-face="left"] footer {
  justify-content: flex-start;
}
```

- [ ] **Step 3: Run check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "Style QCF reading page"
```

## Task 8: Offline Assets and Version Bump

**Files:**
- Modify: `src/data/offline-assets.js`
- Modify: `index.html`
- Modify: `src/startup-loader.js`

- [ ] **Step 1: Add QCF4 constants**

Modify `src/data/offline-assets.js`:

```js
export const CACHE_VERSION = "tap-hifz-v41";

export const QCF4_FONT_ASSETS = [
  "/public/fonts/qcf4/QCF4_QBSML.woff2",
  ...Array.from({ length: 47 }, (_, index) => `/public/fonts/qcf4/QCF4_Hafs_${String(index + 1).padStart(2, "0")}_W.woff2`)
];

export const QCF4_PAGE_ASSETS = Array.from({ length: 604 }, (_, index) => index + 1).map(
  (page) => `/public/mushaf-qcf4/page-${String(page).padStart(3, "0")}.json`
);
```

Update `PRECACHE_URLS`:

```js
export const PRECACHE_URLS = [...new Set([...SHELL_ASSETS, ...DATA_ASSETS, ...READER_ASSETS, ...QCF4_FONT_ASSETS, ...QCF4_PAGE_ASSETS, ...MUSHAF_ASSETS])];
```

- [ ] **Step 2: Bump browser asset versions**

Use version string `2026-06-26-qcf4-renderer` in:

- `index.html`
- `src/startup-loader.js`
- versioned imports added to `src/app.js`

- [ ] **Step 3: Run check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add index.html src/startup-loader.js src/app.js src/data/offline-assets.js
git commit -m "Cache QCF reader assets"
```

## Task 9: Browser Verification

**Files:**
- No source edits unless verification finds defects.

- [ ] **Step 1: Start local server**

Run:

```bash
npm run dev
```

Expected: server serves `http://localhost:4173`.

- [ ] **Step 2: Open renderer URL**

Open:

```text
http://localhost:4173/?v=2026-06-26-qcf4-renderer
```

Expected: app loads the reader and generated QCF4 pages render as `mushaf-page`.

- [ ] **Step 3: Verify DOM on page 1**

In browser evaluate:

```js
({
  hasQcf4Page: Boolean(document.querySelector("mushaf-page")),
  hasAyahChars: Boolean(document.querySelector(".ayah-chars")),
  hasGroups: document.querySelectorAll(".ayah-group").length
})
```

Expected:

```js
{ hasQcf4Page: true, hasAyahChars: true, hasGroups: 7 }
```

- [ ] **Step 4: Verify dense pages**

Navigate to pages 585 and 596.

Expected: both pages render through `mushaf-page` with no horizontal overflow.

- [ ] **Step 5: Verify Tap Hifz interaction**

On page 1, tap an ayah group.

Expected: repetition count increments, undo button appears, and the line layout does not shift.

- [ ] **Step 6: Verify long press**

Long press an ayah group.

Expected: detail modal opens for the correct ayah.

- [ ] **Step 7: Commit any verification fixes**

If fixes are needed:

```bash
git add <changed-files>
git commit -m "Fix QCF reader behavior"
```

If no fixes are needed, do not create a commit.

## Task 10: Full Test Pass

**Files:**
- No source edits unless tests find defects.

- [ ] **Step 1: Run syntax checks**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build static app**

Run:

```bash
npm run build
```

Expected: `dist/` is rebuilt with `public/fonts/qcf4`, `public/mushaf-qcf4`, and updated source files.

- [ ] **Step 4: Final commit if build-related fixes were needed**

If fixes were needed:

```bash
git add <changed-files>
git commit -m "Verify QCF reader build"
```

If no fixes are needed, do not create a commit.
