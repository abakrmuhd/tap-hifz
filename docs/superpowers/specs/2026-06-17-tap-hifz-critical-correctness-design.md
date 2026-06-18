# Tap Hifz Critical Correctness Design

Date: 2026-06-17
Status: Proposed
Scope: First implementation slice for PRD alignment

## Goal

Fix the correctness problems that make the current app untrustworthy:

- weak ayahs can resolve to the wrong page
- page heatmap colors can be computed from unrelated ayahs in the same surah
- bookmark deep links open the page but do not reliably highlight the intended target
- bookmark removal controls in the Bookmarks tab do not work

This slice does not change the storage layer, add richer search, or redesign the app shell. It focuses on making page-local navigation and progress summaries correct.

## Why This Slice First

The biggest current risk is not missing polish but wrong meaning. If the app highlights the wrong page, colors the wrong page, or sends a user to the wrong weak item, the main memorization workflow becomes misleading. Fixing page-local truth first makes later work on review, search, and offline persistence safer.

## Design Summary

We will generate one app-owned metadata file from the bundled `public/mushaf/page-*.json` files and make all page-sensitive behavior read from that metadata instead of inferring page membership from surah membership.

The reader already uses `mushaf-layout` as the rendering source. This design keeps that as the only Quran page source for this slice and extracts a normalized page index from it.

## Metadata Model

Add a generated JSON file under `src/data/` committed into the repo.

Suggested file:

- `src/data/mushaf-metadata.json`

Suggested shape:

```json
{
  "pages": {
    "1": {
      "label": "1:1",
      "surahsPresent": [1],
      "juz": 1,
      "ayahKeys": ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7"],
      "transitionKeys": [
        "1|1:1|1:2",
        "1|1:2|1:3"
      ]
    }
  },
  "ayahToPage": {
    "1:1": 1,
    "1:2": 1
  },
  "surahs": [
    {
      "number": 1,
      "arabicName": "سورة الفاتحة",
      "startPage": 1
    }
  ],
  "juz": [
    {
      "number": 1,
      "startPage": 1,
      "endPage": 21
    }
  ]
}
```

Required semantics:

- `pages[page].ayahKeys` contains only ayahs whose visible verse-ending number control appears on that page.
- `pages[page].transitionKeys` contains only valid page-local transitions where both the previous and current ayah controls appear on that page.
- `ayahToPage[ayahKey]` maps an ayah to the exact page where its ayah-number control is visible.
- `surahsPresent` lists surahs that appear anywhere on that page.
- `label` remains a compact page label suitable for UI display.

## Metadata Generation Rules

Generation reads every `public/mushaf/page-*.json` file and derives:

1. All visible ayah controls on the page by scanning `words[]` for final tokens with appended Arabic verse numbers.
2. All valid transitions by taking consecutive visible ayah keys on the same page.
3. Surahs present by reading `line.surah` and `verseRange`.

The generated file becomes the runtime source of truth for:

- exact ayah-to-page lookup
- page-local transition validity
- per-page weakest-ayah summaries
- weak-item routing
- bookmark deep links

## Runtime Behavior Changes

### Progress tab

Replace surah-based page inference with exact page-local metadata:

- juz pill strength remains based on weakest individual ayah in that juz
- page cell strength is computed only from `pages[page].ayahKeys`
- weak item rows use exact `ayahToPage` and `transitionKeys`

Transitions remain excluded from page and juz heatmap color, matching the PRD.

### Weak review queue

Weak-item creation uses exact page mapping:

- weak ayah item page = `ayahToPage[ayahKey]`
- weak transition item page = page parsed from transition key

Ordering remains:

1. weakest level first
2. lower repetition count first
3. mushaf page order

For this slice, the queue continues to use the current strength thresholds and review controls. The fix is that the queue points to the correct page and correct target.

### Reader target highlighting

Make `route.target` a shared reader concept instead of review-only behavior.

Reader highlight rules:

- when opening from Progress, highlight the requested ayah or transition
- when opening from Bookmarks, highlight the bookmarked ayah
- when opening from Review, use the same shared target highlighting path

Implementation note:

- derive the active reader target from `review?.queue[review.index]` first when review is active
- otherwise use `route.target`

This keeps Review mode behavior intact while fixing non-review deep links.

### Bookmarks

Add missing removal behavior:

- `data-remove-page-bookmark` removes that page bookmark
- `data-remove-ayah-bookmark` removes that ayah bookmark

Deep-link behavior:

- page bookmarks open the page
- ayah bookmarks open the page and highlight the exact ayah target

### Page strength and weak-item logic

Stop using surah membership as a proxy for page membership.

Specifically:

- `pageStrength(page)` reads only `pages[page].ayahKeys`
- weak-item page resolution uses `ayahToPage`
- bookmark target routing uses metadata-backed exact pages

## Files Expected To Change

- `src/app.js`
- `src/data/` for generated metadata and a small loader helper if needed
- optional generator script under `scripts/` if we want regeneration to be repeatable

## Implementation Outline

1. Add the generated metadata artifact to the repo.
2. Load that metadata at startup instead of building only the current lightweight fallback map.
3. Refactor page summary functions to use metadata-backed page-local ayah lists.
4. Refactor weak-item generation to use exact page mapping.
5. Refactor reader highlighting to honor `route.target`.
6. Add bookmark removal handlers.
7. Verify that opening weak items and ayah bookmarks highlights the intended target on the correct page.

## Out Of Scope For This Slice

- IndexedDB migration
- richer surah search with transliterated or English names
- editable strength-threshold UI
- transition long-press details
- stronger offline precaching strategy
- larger review-mode UX changes

## Risks

- The current rendering logic detects appended Arabic verse numbers with regex matching. Metadata generation must use the same interpretation or the runtime and generated metadata can drift.
- Existing saved state may contain ayah progress that previously resolved to the wrong page. The state itself remains valid, but page summaries will change once metadata becomes correct.
- If an ayah bookmark exists for an ayah whose visible control is not found because of parsing drift, the app should still open the stored page rather than fail silently.

## Verification Plan

Manual verification for this slice:

1. Open the Progress tab with no data and confirm all pages are neutral.
2. Log repetitions on ayahs from a long surah spanning multiple pages.
3. Confirm only the correct page cell changes strength.
4. Start weak review and confirm the opened page matches the weak item.
5. Add an ayah bookmark, reopen it from Bookmarks, and confirm the ayah is highlighted.
6. Remove page and ayah bookmarks from the Bookmarks tab and confirm state updates immediately.
7. Confirm review mode still highlights the correct target and Next remains gated on completion.

## Recommendation

Proceed with this correctness slice before the storage and richer search work. It gives the app a trustworthy page-local mental model and reduces the risk of building more features on top of incorrect progress calculations.
