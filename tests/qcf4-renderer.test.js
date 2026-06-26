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

test("renderQcf4Page can attach interactive attrs to ayah markers", () => {
  const html = renderQcf4Page(page, {
    inert: false,
    buildAyahAttrs: () => "",
    buildAyahMarkerClass: () => "ayah-marker ayah-mark weak",
    buildAyahMarkerAttrs: (key) => `data-ayah="${key}" role="button"`,
    buildGroupClass: () => "ayah-group"
  });

  assert.match(html, /class="ayah-marker ayah-mark weak"/);
  assert.match(html, /data-ayah="1:1"/);
  assert.match(html, /role="button"/);
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

test("styles define Muhaffidh-like QCF4 page metrics", () => {
  const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /@font-face[\s\S]*font-family:\s*["']?QCF2000/);
  assert.match(styles, /mushaf-page\s*\{[\s\S]*width:\s*100%/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*font-size:\s*min\(29px,\s*5\.55cqw\)/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*line-height:\s*min\(44px,\s*8\.42cqw\)/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*letter-spacing:\s*-2\.1px/);
  assert.match(styles, /\.ayah-chars\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(styles, /\.ayah-chars\s+\.space\s*\{[\s\S]*font-size:\s*2px/);
});
