import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRevealSurfaceState,
  clampRevealOffset,
  getRevealDirection,
  getRevealPage,
  getTask2RevealDirection,
  shouldCommitSwipe
} from "../src/reader/swipe-reveal.js";

test("getRevealDirection maps right drags to next and left drags to previous", () => {
  assert.equal(getRevealDirection({ dx: 72, dy: 12, startThreshold: 8 }), "next");
  assert.equal(getRevealDirection({ dx: -72, dy: 12, startThreshold: 8 }), "previous");
});

test("getRevealDirection rejects mostly vertical drags", () => {
  assert.equal(getRevealDirection({ dx: 24, dy: 60, startThreshold: 8 }), null);
});

test("getRevealDirection and shouldCommitSwipe treat equality as non-commit", () => {
  assert.equal(getRevealDirection({ dx: 8, dy: 0, startThreshold: 8 }), null);
  assert.equal(getRevealDirection({ dx: 24, dy: 24, startThreshold: 8 }), null);
  assert.equal(shouldCommitSwipe({ dx: 60, dy: 30, commitDistance: 60, verticalLimit: 70 }), false);
  assert.equal(shouldCommitSwipe({ dx: 90, dy: 70, commitDistance: 60, verticalLimit: 70 }), false);
});

test("shouldCommitSwipe uses horizontal threshold and vertical limit", () => {
  assert.equal(shouldCommitSwipe({ dx: 61, dy: 30, commitDistance: 60, verticalLimit: 70 }), true);
  assert.equal(shouldCommitSwipe({ dx: 59, dy: 30, commitDistance: 60, verticalLimit: 70 }), false);
  assert.equal(shouldCommitSwipe({ dx: 90, dy: 80, commitDistance: 60, verticalLimit: 70 }), false);
});

test("clampRevealOffset damps large drags", () => {
  assert.equal(clampRevealOffset(40, { maxOffset: 120, dragRatio: 0.45 }), 18);
  assert.equal(clampRevealOffset(400, { maxOffset: 120, dragRatio: 0.45 }), 120);
  assert.equal(clampRevealOffset(-400, { maxOffset: 120, dragRatio: 0.45 }), -120);
});

test("getRevealPage honors app navigation mapping and boundaries", () => {
  assert.equal(getRevealPage({ currentPage: 12, direction: "next", pageCount: 604 }), 13);
  assert.equal(getRevealPage({ currentPage: 12, direction: "previous", pageCount: 604 }), 11);
  assert.equal(getRevealPage({ currentPage: 604, direction: "next", pageCount: 604 }), null);
  assert.equal(getRevealPage({ currentPage: 1, direction: "previous", pageCount: 604 }), null);
});

test("buildRevealSurfaceState returns active and revealed page numbers", () => {
  assert.deepEqual(
    buildRevealSurfaceState({ currentPage: 20, direction: "next", pageCount: 604 }),
    { activePage: 20, revealedPage: 21 }
  );
  assert.deepEqual(
    buildRevealSurfaceState({ currentPage: 1, direction: "previous", pageCount: 604 }),
    { activePage: 1, revealedPage: null }
  );
});

test("getTask2RevealDirection follows navigation direction before boundary defaults", () => {
  assert.equal(getTask2RevealDirection({ currentPage: 20, pageCount: 604, navigationDelta: 1 }), "next");
  assert.equal(getTask2RevealDirection({ currentPage: 20, pageCount: 604, navigationDelta: -1 }), "previous");
  assert.equal(getTask2RevealDirection({ currentPage: 20, pageCount: 604, navigationDelta: 0 }), "next");
  assert.equal(getTask2RevealDirection({ currentPage: 604, pageCount: 604, navigationDelta: 0 }), "previous");
});

test("Task 2 reveal surface scaffolding can target the previous page after backward navigation", () => {
  const direction = getTask2RevealDirection({ currentPage: 200, pageCount: 604, navigationDelta: -1 });
  assert.deepEqual(
    buildRevealSurfaceState({ currentPage: 200, direction, pageCount: 604 }),
    { activePage: 200, revealedPage: 199 }
  );
});
