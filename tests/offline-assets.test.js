import test from "node:test";
import assert from "node:assert/strict";

import {
  DATA_ASSETS,
  MUSHAF_ASSETS,
  PRECACHE_URLS,
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
