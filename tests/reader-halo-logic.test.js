import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAyahRingState,
  buildAyahAriaLabel
} from "../src/data/reader-halo-logic.js";

const ayahThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
const transitionThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };

test("buildAyahRingState maps ayah and transition counts into badge and ring classes", () => {
  assert.deepEqual(
    buildAyahRingState({
      ayahCount: 22,
      transitionCount: 12,
      ayahThresholds,
      transitionThresholds
    }),
    {
      ayahStrength: "strong",
      transitionStrength: "building",
      hasTransitionRing: true,
      transitionArcDegrees: 216
    }
  );
});

test("buildAyahRingState computes transition arc from count over target", () => {
  assert.equal(
    buildAyahRingState({
      ayahCount: 1,
      transitionCount: 5,
      ayahThresholds,
      transitionThresholds
    }).transitionArcDegrees,
    180
  );

  assert.equal(
    buildAyahRingState({
      ayahCount: 1,
      transitionCount: 80,
      ayahThresholds,
      transitionThresholds
    }).transitionArcDegrees,
    360
  );
});

test("buildAyahRingState omits the ring when no transition is available", () => {
  assert.deepEqual(
    buildAyahRingState({
      ayahCount: 3,
      transitionCount: null,
      ayahThresholds,
      transitionThresholds
    }),
    {
      ayahStrength: "weak",
      transitionStrength: null,
      hasTransitionRing: false,
      transitionArcDegrees: 0
    }
  );
});

test("buildAyahAriaLabel appends transition strength only when a transition exists", () => {
  assert.equal(
    buildAyahAriaLabel({
      ayahLabel: "Surah 2:5",
      ayahStrength: "strong",
      transitionStrength: "building"
    }),
    "Surah 2:5, ayah strong, transition building"
  );

  assert.equal(
    buildAyahAriaLabel({
      ayahLabel: "Surah 1:1",
      ayahStrength: "weak",
      transitionStrength: null
    }),
    "Surah 1:1, ayah weak"
  );
});
