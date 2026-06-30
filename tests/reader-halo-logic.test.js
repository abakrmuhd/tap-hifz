import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCountProgressColor,
  buildCountProgressInkColor,
  buildRepetitionAriaLabel,
  buildRepetitionRingState
} from "../src/data/reader-halo-logic.js";

const repetitionThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
const transitionCountThresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };

test("buildRepetitionRingState maps repetition and transition counts into badge and ring classes", () => {
  assert.deepEqual(
    buildRepetitionRingState({
      repetitionCount: 22,
      transitionCount: 12,
      repetitionThresholds,
      transitionCountThresholds
    }),
    {
      repetitionCountLevel: "strong",
      repetitionCountColor: "#c6df72",
      repetitionCountInkColor: "#263500",
      transitionCountLevel: "building",
      transitionCountColor: "#d4e2a3",
      transitionCountInkColor: "#263500",
      transitionProgressPercent: 30,
      hasTransitionRing: true,
      isFullyMastered: false
    }
  );
});

test("buildRepetitionRingState omits the ring when no transition is available", () => {
  assert.deepEqual(
    buildRepetitionRingState({
      repetitionCount: 3,
      transitionCount: null,
      repetitionThresholds,
      transitionCountThresholds
    }),
    {
      repetitionCountLevel: "weak",
      repetitionCountColor: "#e2e5cf",
      repetitionCountInkColor: "#263500",
      transitionCountLevel: null,
      transitionCountColor: null,
      transitionCountInkColor: null,
      transitionProgressPercent: 0,
      hasTransitionRing: false,
      isFullyMastered: false
    }
  );
});

test("buildRepetitionRingState flags ayahs with mastered repetition and transition counts", () => {
  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 40,
      transitionCount: 40,
      repetitionThresholds,
      transitionCountThresholds
    }).isFullyMastered,
    true
  );

  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 40,
      transitionCount: 39,
      repetitionThresholds,
      transitionCountThresholds
    }).isFullyMastered,
    false
  );
});

test("buildRepetitionRingState flags final ayahs as fully mastered when repetition is mastered", () => {
  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 40,
      transitionCount: null,
      repetitionThresholds,
      transitionCountThresholds
    }).isFullyMastered,
    true
  );

  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 39,
      transitionCount: null,
      repetitionThresholds,
      transitionCountThresholds
    }).isFullyMastered,
    false
  );
});

test("buildRepetitionRingState maps transition count into underline progress", () => {
  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 1,
      transitionCount: 0,
      repetitionThresholds,
      transitionCountThresholds
    }).transitionProgressPercent,
    0
  );

  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 1,
      transitionCount: 20,
      repetitionThresholds,
      transitionCountThresholds
    }).transitionProgressPercent,
    50
  );

  assert.equal(
    buildRepetitionRingState({
      repetitionCount: 1,
      transitionCount: 80,
      repetitionThresholds,
      transitionCountThresholds
    }).transitionProgressPercent,
    100
  );
});

test("buildCountProgressColor interpolates from empty to mastered and clamps after mastery", () => {
  assert.equal(buildCountProgressColor(0, repetitionThresholds), "#e6e6de");
  assert.equal(buildCountProgressColor(20, repetitionThresholds), "#c9e07c");
  assert.equal(buildCountProgressColor(40, repetitionThresholds), "#abda1a");
  assert.equal(buildCountProgressColor(80, repetitionThresholds), "#abda1a");
});

test("buildCountProgressInkColor keeps count badges readable across the gradient", () => {
  assert.equal(buildCountProgressInkColor(0, repetitionThresholds), "#263500");
  assert.equal(buildCountProgressInkColor(40, repetitionThresholds), "#263500");
});

test("buildRepetitionAriaLabel appends transition count level only when a transition exists", () => {
  assert.equal(
    buildRepetitionAriaLabel({
      ayahLabel: "Surah 2:5",
      repetitionCountLevel: "strong",
      transitionCountLevel: "building"
    }),
    "Surah 2:5, repetition count strong, transition count building"
  );

  assert.equal(
    buildRepetitionAriaLabel({
      ayahLabel: "Surah 1:1",
      repetitionCountLevel: "weak",
      transitionCountLevel: null
    }),
    "Surah 1:1, repetition count weak"
  );
});
