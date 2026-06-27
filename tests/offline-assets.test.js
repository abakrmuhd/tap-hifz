import test from "node:test";
import assert from "node:assert/strict";

import {
  DATA_ASSETS,
  FONT_ASSETS,
  MUSHAF_ASSETS,
  QCF4_MUSHAF_ASSETS,
  PRECACHE_URLS,
  READER_ASSETS,
  SHELL_ASSETS
} from "../src/data/offline-assets.js";

test("offline precache includes all committed mushaf page json files", () => {
  assert.equal(MUSHAF_ASSETS.length, 604);
  assert.equal(MUSHAF_ASSETS[0], "/public/mushaf/page-001.json");
  assert.equal(MUSHAF_ASSETS.at(-1), "/public/mushaf/page-604.json");
});

test("offline precache includes shell and metadata assets", () => {
  assert.ok(SHELL_ASSETS.includes("/index.html"));
  assert.ok(DATA_ASSETS.includes("/src/data/mushaf-metadata.json"));
  assert.ok(DATA_ASSETS.includes("/src/data/navigation-metadata.json"));
  assert.ok(PRECACHE_URLS.includes("/public/mushaf/page-440.json"));
});

test("offline precache includes QCF4 pages, fonts, and reader modules", () => {
  assert.equal(QCF4_MUSHAF_ASSETS.length, 604);
  assert.equal(QCF4_MUSHAF_ASSETS[0], "/public/mushaf-qcf4/page-001.json");
  assert.equal(QCF4_MUSHAF_ASSETS.at(-1), "/public/mushaf-qcf4/page-604.json");
  assert.equal(FONT_ASSETS.length, 48);
  assert.ok(FONT_ASSETS.includes("/public/fonts/qcf4/QCF4_QBSML.woff2"));
  assert.ok(FONT_ASSETS.includes("/public/fonts/qcf4/QCF4_Hafs_47_W.woff2"));
  assert.ok(READER_ASSETS.includes("/src/reader/qcf4-data.js"));
  assert.ok(READER_ASSETS.includes("/src/reader/qcf4-logic.js"));
  assert.ok(READER_ASSETS.includes("/src/reader/qcf4-renderer.js"));
  assert.ok(PRECACHE_URLS.includes("/public/mushaf-qcf4/page-596.json"));
});
