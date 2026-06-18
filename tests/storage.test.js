import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_STATE_KEY,
  LEGACY_LOCAL_STORAGE_KEY,
  mergeStoredState,
  selectInitialStateSource
} from "../src/data/storage.js";

const defaultState = {
  ayahProgress: {},
  transitionProgress: {},
  recentPages: [],
  ayahBookmarks: [],
  pageBookmarks: [],
  practiceEvents: [],
  settings: {
    theme: "dark",
    sound: false,
    vibration: "auto",
    reviewQueueSize: 12,
    doubleTapWindow: 250,
    ayahThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    transitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 }
  }
};

test("mergeStoredState preserves nested settings defaults while applying saved values", () => {
  const merged = mergeStoredState(defaultState, {
    recentPages: [12],
    settings: {
      theme: "light",
      ayahThresholds: { weakMax: 4 }
    }
  });

  assert.deepEqual(merged.recentPages, [12]);
  assert.equal(merged.settings.theme, "light");
  assert.equal(merged.settings.ayahThresholds.weakMax, 4);
  assert.equal(merged.settings.ayahThresholds.buildingMax, 19);
  assert.equal(merged.settings.transitionThresholds.strongMax, 39);
});

test("selectInitialStateSource prefers IndexedDB state when it exists", () => {
  const indexedState = { recentPages: [99] };
  const legacyState = { recentPages: [12] };

  const result = selectInitialStateSource({
    indexedState,
    legacyRawState: JSON.stringify(legacyState),
    defaultState
  });

  assert.equal(result.source, APP_STATE_KEY);
  assert.deepEqual(result.state.recentPages, [99]);
});

test("selectInitialStateSource imports legacy localStorage state when IndexedDB is empty", () => {
  const result = selectInitialStateSource({
    indexedState: null,
    legacyRawState: JSON.stringify({ recentPages: [5], settings: { sound: true } }),
    defaultState
  });

  assert.equal(result.source, LEGACY_LOCAL_STORAGE_KEY);
  assert.deepEqual(result.state.recentPages, [5]);
  assert.equal(result.state.settings.sound, true);
});
