import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLowCountItems,
  buildMetadataFromPages,
  getPageCellProgressState,
  getPageRangeCellProgressState,
  getPageRepetitionLevel,
  resolveOutgoingTransition,
  resolveActiveTarget
} from "../src/data/metadata-logic.js";

const juzRanges = [{ number: 1, startPage: 1, endPage: 2 }];

const samplePages = {
  1: {
    lines: [
      {
        type: "text",
        verseRange: "1:1-1:2",
        words: [
          { location: "1:1:1", word: "Word ١" },
          { location: "1:2:1", word: "Word ٢" }
        ]
      }
    ]
  },
  2: {
    lines: [
      {
        type: "text",
        verseRange: "2:1-2:2",
        words: [
          { location: "2:1:1", word: "Word ١" },
          { location: "2:2:1", word: "Word ٢" }
        ]
      }
    ]
  }
};

const sameSurahAcrossPages = {
  3: {
    lines: [
      {
        type: "text",
        verseRange: "2:15-2:16",
        words: [
          { location: "2:15:1", word: `Word ${"\u0661\u0665"}` },
          { location: "2:16:1", word: `Word ${"\u0661\u0666"}` }
        ]
      }
    ]
  },
  4: {
    lines: [
      {
        type: "text",
        verseRange: "2:17-3:1",
        words: [
          { location: "2:17:1", word: `Word ${"\u0661\u0667"}` },
          { location: "3:1:1", word: `Word ${"\u0661"}` }
        ]
      }
    ]
  }
};

test("buildMetadataFromPages maps ayahs and transitions to exact pages", () => {
  const metadata = buildMetadataFromPages(samplePages, juzRanges);

  assert.deepEqual(metadata.pages["1"].ayahKeys, ["1:1", "1:2"]);
  assert.deepEqual(metadata.pages["1"].transitionKeys, ["1|1:1|1:2"]);
  assert.equal(metadata.ayahToPage["2:2"], 2);
});

test("buildMetadataFromPages keeps only outgoing same-surah transition requirements", () => {
  const metadata = buildMetadataFromPages(sameSurahAcrossPages, [{ number: 1, startPage: 3, endPage: 4 }]);

  assert.deepEqual(metadata.pages["3"].transitionKeys, [
    "3|2:15|2:16",
    "3|2:16|2:17"
  ]);
  assert.deepEqual(metadata.pages["4"].transitionKeys, []);
});

test("getPageRepetitionLevel only uses ayahs that belong to the requested page", () => {
  const metadata = buildMetadataFromPages(samplePages, juzRanges);
  const thresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
  const ayahProgress = {
    "1:1": { repetitionCount: 2 },
    "1:2": { repetitionCount: 3 },
    "2:1": { repetitionCount: 30 },
    "2:2": { repetitionCount: 30 }
  };

  assert.equal(getPageRepetitionLevel(1, metadata, ayahProgress, thresholds), "weak");
  assert.equal(getPageRepetitionLevel(2, metadata, ayahProgress, thresholds), "strong");
});

test("getPageCellProgressState includes page-local repetitions and transitions", () => {
  const metadata = buildMetadataFromPages(samplePages, juzRanges);
  const thresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };

  assert.deepEqual(
    getPageCellProgressState({
      page: 1,
      metadata,
      ayahProgress: {},
      transitionProgress: {},
      repetitionThresholds: thresholds,
      transitionCountThresholds: thresholds
    }),
    { empty: true, progress: 0 }
  );

  assert.deepEqual(
    getPageCellProgressState({
      page: 1,
      metadata,
      ayahProgress: {
        "1:1": { repetitionCount: 80 },
        "1:2": { repetitionCount: 40 }
      },
      transitionProgress: { "1|1:1|1:2": { repetitionCount: 20 } },
      repetitionThresholds: thresholds,
      transitionCountThresholds: thresholds
    }),
    { empty: false, progress: 0.5 }
  );

  assert.deepEqual(
    getPageCellProgressState({
      page: 1,
      metadata,
      ayahProgress: {
        "1:1": { repetitionCount: 80 },
        "1:2": { repetitionCount: 40 }
      },
      transitionProgress: { "1|1:1|1:2": { repetitionCount: 80 } },
      repetitionThresholds: thresholds,
      transitionCountThresholds: thresholds
    }),
    { empty: false, progress: 1 }
  );
});

test("getPageRangeCellProgressState only masters when all page requirements are mastered", () => {
  const metadata = buildMetadataFromPages(samplePages, juzRanges);
  const thresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
  const masteredAyahProgress = {
    "1:1": { repetitionCount: 80 },
    "1:2": { repetitionCount: 80 },
    "2:1": { repetitionCount: 80 },
    "2:2": { repetitionCount: 80 }
  };

  assert.deepEqual(
    getPageRangeCellProgressState({
      startPage: 1,
      endPage: 2,
      metadata,
      ayahProgress: masteredAyahProgress,
      transitionProgress: {
        "1|1:1|1:2": { repetitionCount: 80 },
        "2|2:1|2:2": { repetitionCount: 10 }
      },
      repetitionThresholds: thresholds,
      transitionCountThresholds: thresholds
    }),
    { empty: false, progress: 0.25 }
  );

  assert.deepEqual(
    getPageRangeCellProgressState({
      startPage: 1,
      endPage: 2,
      metadata,
      ayahProgress: masteredAyahProgress,
      transitionProgress: {
        "1|1:1|1:2": { repetitionCount: 80 },
        "2|2:1|2:2": { repetitionCount: 80 }
      },
      repetitionThresholds: thresholds,
      transitionCountThresholds: thresholds
    }),
    { empty: false, progress: 1 }
  );
});

test("page and range progress do not require a transition after a final ayah", () => {
  const metadata = buildMetadataFromPages({
    604: {
      lines: [
        {
          type: "text",
          verseRange: "114:6-114:6",
          words: [{ location: "114:6:1", word: `Word ${"\u0666"}` }]
        }
      ]
    }
  }, [{ number: 30, startPage: 604, endPage: 604 }]);
  const thresholds = { weakMax: 9, buildingMax: 19, strongMax: 39 };
  const progressOptions = {
    metadata,
    ayahProgress: { "114:6": { repetitionCount: 40 } },
    transitionProgress: {},
    repetitionThresholds: thresholds,
    transitionCountThresholds: thresholds
  };

  assert.deepEqual(metadata.pages["604"].transitionKeys, []);
  assert.deepEqual(
    getPageCellProgressState({
      page: 604,
      ...progressOptions
    }),
    { empty: false, progress: 1 }
  );
  assert.deepEqual(
    getPageRangeCellProgressState({
      startPage: 604,
      endPage: 604,
      ...progressOptions
    }),
    { empty: false, progress: 1 }
  );
});

test("buildLowCountItems resolves ayah page by exact ayahToPage mapping", () => {
  const metadata = buildMetadataFromPages(samplePages, juzRanges);
  const lowCountItems = buildLowCountItems({
    metadata,
    ayahProgress: { "2:2": { repetitionCount: 1 } },
    transitionProgress: {},
    repetitionThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    transitionCountThresholds: { weakMax: 9, buildingMax: 19, strongMax: 39 },
    labelAyah: (key) => key,
    labelTransition: (key) => key
  });

  assert.equal(lowCountItems[0].page, 2);
  assert.equal(lowCountItems[0].key, "2:2");
  assert.equal(lowCountItems[0].countLevel, "weak");
});

test("resolveOutgoingTransition finds same-page and cross-page next ayahs in the same surah", () => {
  const metadata = {
    ayahToPage: {
      "2:15": 3,
      "2:16": 3,
      "2:17": 4,
      "3:1": 4
    },
    pages: {
      "3": { ayahKeys: ["2:15", "2:16"] },
      "4": { ayahKeys: ["2:17", "3:1"] }
    }
  };

  assert.deepEqual(resolveOutgoingTransition("2:15", metadata), {
    key: "3|2:15|2:16",
    page: 3,
    from: "2:15",
    to: "2:16"
  });
  assert.deepEqual(resolveOutgoingTransition("2:16", metadata), {
    key: "3|2:16|2:17",
    page: 3,
    from: "2:16",
    to: "2:17"
  });
  assert.equal(resolveOutgoingTransition("2:17", metadata), null);
});

test("resolveActiveTarget prefers review target and falls back to route target", () => {
  const routeTarget = { kind: "Ayah", key: "2:282" };
  const reviewTarget = { kind: "Transition", key: "48|2:281|2:282" };

  assert.deepEqual(resolveActiveTarget({ review: null, routeTarget }), routeTarget);
  assert.deepEqual(
    resolveActiveTarget({ review: { queue: [reviewTarget], index: 0, done: false }, routeTarget }),
    reviewTarget
  );
});
