import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildQcf4PreviousAyahMap,
  collectQcf4AyahKeys,
  qcf4PagePath
} from "../src/reader/qcf4-logic.js";
import { renderQcf4Page } from "../src/reader/qcf4-renderer.js";

const page = {
  page: 1,
  lines: [
    { type: "surah-header", glyphs: [{ glyph: "a" }] },
    {
      type: "text",
      ayahGroups: [
        {
          key: "1:1",
          surah: 1,
          ayah: 1,
          items: [
            { type: "word", glyph: "b" },
            { type: "ayah-marker", glyph: "c" }
          ]
        },
        { key: "1:2", surah: 1, ayah: 2, items: [{ type: "word", glyph: "c" }] }
      ]
    },
    {
      type: "text",
      ayahGroups: [
        { key: "1:3", surah: 1, ayah: 3, items: [{ type: "word", glyph: "d" }] }
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

test("renderQcf4Page mirrors Muhaffidh-style structure", () => {
  const html = renderQcf4Page(page, {
    inert: false,
    buildAyahAttrs: (key) => `data-ayah="${key}"`,
    buildGroupClass: () => "ayah-group"
  });

  assert.match(html, /<mushaf-page/);
  assert.match(html, /<mushaf-page-inner>/);
  assert.match(html, /class="ayah-chars/);
  assert.match(html, /class="line/);
  assert.match(html, /class="line centered-line surah-title-line"/);
  assert.match(html, /class="ayah-group"/);
  assert.match(html, /data-ayah="1:1"/);
  assert.match(html, /class="word"/);
});

test("renderQcf4Page omits interactive ayah attrs for inert pages", () => {
  const html = renderQcf4Page(page, {
    inert: true,
    buildAyahAttrs: (key) => `data-ayah="${key}"`,
    buildGroupClass: () => "ayah-group"
  });

  assert.doesNotMatch(html, /data-ayah="1:1"/);
});

test("renderQcf4Page can mark a full ayah group as bookmarked", () => {
  const html = renderQcf4Page(page, {
    inert: false,
    buildAyahAttrs: () => "",
    buildGroupClass: (key) => key === "1:1" ? "ayah-group bookmarked-ayah" : "ayah-group"
  });

  assert.match(html, /class="ayah-group bookmarked-ayah"[\s\S]*<span class="word"/);
});

test("renderQcf4Page can attach interactive attrs to ayah markers", () => {
  const html = renderQcf4Page(page, {
    inert: false,
    buildAyahAttrs: () => "",
    buildAyahMarkerClass: () => "ayah-marker ayah-mark weak",
    buildAyahMarkerAttrs: (key) => `data-ayah="${key}" role="button"`,
    buildAyahMarkerStyle: () => "--count-color: #abda1a",
    buildGroupClass: () => "ayah-group"
  });

  assert.match(html, /class="ayah-marker ayah-mark weak"/);
  assert.match(html, /data-ayah="1:1"/);
  assert.match(html, /role="button"/);
  assert.match(html, /<span class="ayah-marker ayah-mark weak"[\s\S]*><span class="ayah-mark-glyph"><span class="ayah-mark-glyph-base">c<\/span><span class="ayah-mark-glyph-shine" aria-hidden="true">c<\/span><\/span><\/span>/);
  assert.match(html, /style="font-family: &#039;QCF2001&#039;; --count-color: #abda1a"/);
  assert.doesNotMatch(html, /style="[^"]*"\s+style="/);
});

test("app wires QCF4 pages into the reader with legacy fallback", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(appSource, /fetchQcf4Page/);
  assert.match(appSource, /renderQcf4Page/);
  assert.match(appSource, /qcf4PageCache/);
  assert.match(appSource, /qcf4PageData \|\| legacyPageData/);
});

test("app keeps ayah marker interactions on QCF4 marker elements", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(appSource, /\.page-slot\.current \.ayah-marker\[data-ayah\]/);
  assert.match(appSource, /buildQcf4AyahMarkerAttrs/);
});

test("app marks bookmarked QCF4 ayah groups for full-text highlighting", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(appSource, /buildQcf4AyahGroupClass/);
  assert.match(appSource, /state\.ayahBookmarks\.some\(\(item\)\s*=>\s*item\.key\s*===\s*key\)/);
});

test("styles define Muhaffidh-like QCF4 page metrics", () => {
  const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /@font-face[\s\S]*font-family:\s*["']?QCF2000/);
  assert.match(styles, /mushaf-page\s*\{[\s\S]*width:\s*100%/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*font-size:\s*min\(29px,\s*5\.55cqw\)/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*--qcf-line-height:\s*min\(48\.4px,\s*9\.262cqw\)/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*line-height:\s*var\(--qcf-line-height\)/);
  assert.match(styles, /--mushaf-page-content-height:\s*min\(726px,\s*138\.93vw\)/);
  assert.match(styles, /\.ayah-chars\s+\.line\s*\{[\s\S]*height:\s*var\(--qcf-line-height\)/);
  assert.match(styles, /\.qcf4-slot\s*\{[\s\S]*overflow:\s*visible/);
  assert.match(styles, /\.page-shell\s*\{[\s\S]*cursor:\s*grab/);
  assert.match(styles, /\.page-slot\.current\s+\.ayah-marker\[data-ayah\][\s\S]*cursor:\s*pointer/);
  assert.match(styles, /\.page-shell\.dragging\s+\.ayah-marker\[data-ayah\][\s\S]*cursor:\s*grabbing/);
  const qcfAyahMarkerRule = styles.match(/\.ayah-chars\s+\.ayah-marker\.ayah-mark\s*\{[^}]*\}/)?.[0] || "";
  assert.match(qcfAyahMarkerRule, /--ayah-marker-visual-offset:\s*\.2em/);
  const qcfAyahGlyphRule = styles.match(/\.ayah-chars\s+\.ayah-marker\.ayah-mark\s+\.ayah-mark-glyph\s*\{[^}]*\}/)?.[0] || "";
  assert.match(qcfAyahGlyphRule, /transform:\s*translateX\(var\(--ayah-marker-visual-offset\)\)/);
  const qcfTransitionCueRule = styles.match(/\.ayah-chars\s+\.ayah-marker\.ayah-mark::before,\s*\.ayah-chars\s+\.ayah-marker\.ayah-mark::after\s*\{[^}]*\}/)?.[0] || "";
  assert.match(qcfTransitionCueRule, /transform:\s*translateX\(var\(--ayah-marker-visual-offset\)\)/);
  const surahTitleLineRule = styles.match(/\.ayah-chars\s+\.surah-title-line\s*\{[^}]*\}/)?.[0] || "";
  assert.match(surahTitleLineRule, /border:\s*1px\s+solid\s+var\(--mastered\)/);
  assert.match(surahTitleLineRule, /border-radius:\s*12px/);
  assert.match(surahTitleLineRule, /color:\s*var\(--mastered\)/);
  const bookmarkedAyahRule = styles.match(/\.ayah-chars\s+\.ayah-group\.bookmarked-ayah\s*\{[^}]*\}/)?.[0] || "";
  assert.match(bookmarkedAyahRule, /background:\s*linear-gradient\(\s*color-mix\(in srgb,\s*var\(--mastered\) 18%,\s*transparent\),\s*color-mix\(in srgb,\s*var\(--mastered\) 18%,\s*transparent\)\s*\)\s*center\s*\/\s*100%\s*var\(--qcf-line-height\)\s*no-repeat/);
  assert.match(bookmarkedAyahRule, /box-decoration-break:\s*clone/);
  assert.doesNotMatch(bookmarkedAyahRule, /box-shadow/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*letter-spacing:\s*-2\.1px/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(styles, /\.ayah-chars\s+\.space\s*\{[\s\S]*font-size:\s*2px/);
});
