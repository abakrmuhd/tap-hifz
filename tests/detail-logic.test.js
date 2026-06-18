import test from "node:test";
import assert from "node:assert/strict";

import { describeDetailTarget } from "../src/data/detail-logic.js";

const settings = {
  ayahThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
  transitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 }
};

test("describeDetailTarget exposes ayah bookmark affordance", () => {
  const detail = describeDetailTarget(
    { kind: "ayah", key: "2:255" },
    {
      settings,
      getAyahCount: () => 12,
      getTransitionCount: () => 0,
      labelAyah: (key) => `Ayah ${key}`,
      labelTransition: (key) => `Transition ${key}`,
      isAyahBookmarked: () => true
    }
  );

  assert.equal(detail.title, "Ayah 2:255");
  assert.equal(detail.kindLabel, "Ayah");
  assert.equal(detail.count, 12);
  assert.equal(detail.strength, "building");
  assert.equal(detail.canBookmark, true);
  assert.equal(detail.bookmarked, true);
});

test("describeDetailTarget adapts the shared modal for transitions", () => {
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

  assert.equal(detail.title, "2:1 -> 2:2");
  assert.equal(detail.kindLabel, "Transition");
  assert.equal(detail.count, 3);
  assert.equal(detail.strength, "weak");
  assert.equal(detail.canBookmark, false);
  assert.equal(detail.bookmarked, false);
});
