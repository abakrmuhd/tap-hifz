import test from "node:test";
import assert from "node:assert/strict";
import metadata from "../src/data/mushaf-metadata.json" with { type: "json" };

test("generated mushaf metadata contains page-local ayah and transition indexes", () => {
  assert.equal(metadata.ayahToPage["1:1"], 1);
  assert.ok(metadata.pages["1"].ayahKeys.includes("1:7"));
  assert.ok(metadata.pages["1"].transitionKeys.includes("1|1:6|1:7"));
});
