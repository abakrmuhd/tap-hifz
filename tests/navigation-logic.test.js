import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSearchText,
  resolveNavigationTarget
} from "../src/data/navigation-logic.js";

const metadata = {
  surahs: [
    {
      number: 1,
      arabicName: "الفاتحة",
      transliteratedName: "Al-Fatihah",
      englishName: "The Opening",
      startPage: 1,
      aliases: ["fatiha"]
    },
    {
      number: 2,
      arabicName: "البقرة",
      transliteratedName: "Al-Baqarah",
      englishName: "The Cow",
      startPage: 2,
      aliases: ["baqarah"]
    },
    {
      number: 36,
      arabicName: "يس",
      transliteratedName: "Ya-Sin",
      englishName: "Ya Sin",
      startPage: 440,
      aliases: ["yasin", "ya seen"]
    }
  ],
  juz: [
    { number: 1, startPage: 1, endPage: 21 },
    { number: 2, startPage: 22, endPage: 41 },
    { number: 3, startPage: 42, endPage: 61 }
  ]
};

test("normalizeSearchText removes punctuation noise and lowercases Latin input", () => {
  assert.equal(normalizeSearchText(" Al-Baqarah "), "al baqarah");
  assert.equal(normalizeSearchText("Ya-Sin"), "ya sin");
});

test("resolveNavigationTarget handles page and juz queries deterministically", () => {
  assert.deepEqual(resolveNavigationTarget("Page 48", metadata, 604), { page: 48, kind: "page" });
  assert.deepEqual(resolveNavigationTarget("juz 3", metadata, 604), { page: 42, kind: "juz" });
});

test("resolveNavigationTarget matches transliterated, English, and Arabic surah names", () => {
  assert.deepEqual(resolveNavigationTarget("Baqarah", metadata, 604), { page: 2, kind: "surah" });
  assert.deepEqual(resolveNavigationTarget("The Cow", metadata, 604), { page: 2, kind: "surah" });
  assert.deepEqual(resolveNavigationTarget("يس", metadata, 604), { page: 440, kind: "surah" });
});

test("resolveNavigationTarget handles explicit surah number queries without stealing plain page queries", () => {
  assert.deepEqual(resolveNavigationTarget("surah 36", metadata, 604), { page: 440, kind: "surah" });
  assert.deepEqual(resolveNavigationTarget("36", metadata, 604), { page: 36, kind: "page" });
});
