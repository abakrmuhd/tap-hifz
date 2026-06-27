# Muhaffidh-Style QCF4 Reader Renderer Design

## Goal

Replace the current Unicode/word-spacing mushaf text renderer with a local renderer that matches Muhaffidh's full reading-page look: a fixed mushaf page scaled to the viewport, QCF4 Hafs glyph fonts, page header/footer treatment, surah headers, basmala, line grouping, and ayah-number rendering. Tap Hifz tracking, review, navigation, and detail modal behavior should continue to work on top of the new reading surface.

The reader must remain local-first and usable offline. Quran Foundation or other remote APIs may be used as an offline generation source, but the app must not depend on a runtime API call to display pages.

## Evidence

Muhaffidh renders a custom page structure with `mushaf-page`, `mushaf-page-inner`, `.ayah-chars`, `.line`, `.ayah-group`, and `.word` elements. The text visible in the DOM is private-use glyph text, not ordinary Arabic Unicode. Word spans use page/font-specific families such as `QCF2001`, while loaded assets include QCF4 fonts such as `QCF4_Hafs_01_W.woff2` and `QCF4_QBSML.woff2`.

The `nuqayah/qpc-fonts` repository contains King Fahad Qur'an Printing Complex mushaf fonts and documents that mushaf fonts use one character to represent each word. Its `mushaf-v4-hafs` assets are the closest match to Muhaffidh's observed QCF4 rendering.

## Recommended Approach

Use a local QCF4 glyph renderer.

1. Vendor the needed QCF4 Hafs fonts into `public/fonts/qcf4/`.
2. Generate or add local page glyph data under `public/mushaf-qcf4/`.
3. Render reading pages from the QCF4 glyph data instead of shaped Unicode words.
4. Preserve the current reader interaction model and tracking state.
5. Keep the old renderer available as a fallback until the QCF4 path has complete page coverage.

## Data Model

Each QCF4 page file should contain enough information to render without runtime layout guessing:

- `page`: mushaf page number, 1-604.
- `face`: `right` for odd pages and `left` for even pages.
- `header`: page number, current juz glyph, current surah glyph/name data.
- `lines`: ordered visual rows.

Line entries should use explicit types:

- `surah-header`: full-width surah frame glyph/text metadata.
- `basmala`: basmala glyph sequence and font family.
- `text`: one rendered mushaf line.

Text lines should contain:

- `lineNumber`.
- `fontFamily`, usually page-specific QCF4.
- `glyphs` or grouped `ayahGroups`.
- `ayahGroups`: each group maps to `surah`, `ayah`, and child word glyph spans.
- `words`: glyph character, word index, surah, ayah, and font number.

Tap Hifz should continue to derive repetition keys as `${surah}:${ayah}`. Transitions remain page-local and should be calculated from the current page's ayah sequence, as they are today.

## Rendering Architecture

Add a renderer boundary instead of mixing the new glyph markup into the current Unicode helpers.

- `src/reader/qcf4-renderer.js`: pure rendering helpers for QCF4 pages.
- `src/reader/qcf4-data.js`: fetch/cache helpers for `public/mushaf-qcf4/page-###.json`.
- `src/reader/qcf4-fonts.css`: font-face declarations or generated CSS for local QCF4 fonts.
- Existing `renderPageSlot` chooses QCF4 rendering when page data exists, otherwise falls back to the current renderer.

The QCF4 reader DOM should mirror Muhaffidh's shape:

```html
<mushaf-page>
  <mushaf-page-inner>
    <header class="page-header">...</header>
    <div class="page-content">
      <div class="ayah-chars">
        <span class="line">
          <span class="ayah-group" data-ayah="1:1">
            <span class="word" style="font-family: QCF2001">...</span>
          </span>
        </span>
      </div>
    </div>
    <footer>...</footer>
  </mushaf-page-inner>
</mushaf-page>
```

Tap Hifz ayah markers should be applied to `ayah-group` or to the ayah-number glyph span, depending on which best preserves Muhaffidh's exact glyph layout. The transition arc should be an overlay that does not occupy inline layout space.

## Styling

Adopt Muhaffidh's page proportions as the base:

- Virtual page: `512px x 910px`.
- Scale to fit the current `.page-slot`.
- `.ayah-chars`: `font-size: var(--quran-font-size)`, `line-height: var(--quran-line-height)`, `white-space: nowrap`, `text-align-last: justify`, and the QCF4 letter-spacing behavior.
- `.line`: inline row containers with bidi override.
- `.centered-line`: centered rows for surah header and basmala-style content.

Tap Hifz theme colors may remain around the reader shell, but the page itself should visually follow Muhaffidh's reading page treatment. Progress halos, selected ayah state, and long-press hit targets must be overlays or pseudo-elements so they do not change glyph spacing.

## Offline and Caching

All fonts and QCF4 page data must be included in the app's offline asset list. Cache-version bumps are required whenever renderer assets or generated QCF4 data change.

The app should not request `fonts.nuqayah.com`, Quran Foundation, or Muhaffidh at runtime for normal reading.

## Migration Plan

Implement in stages:

1. Add QCF4 font assets and CSS for the minimum pages needed to prove rendering.
2. Generate or add QCF4 data for pages 1, 2, 596, and one dense late page.
3. Build the QCF4 renderer behind a feature path while preserving the old renderer fallback.
4. Verify visual parity against Muhaffidh at mobile width.
5. Extend data generation to all 604 pages.
6. Switch the reader default to QCF4 after all pages render and existing interactions pass.
7. Remove old line-fitting classes only after the fallback is no longer needed.

## Testing and Verification

Add pure tests for:

- QCF4 page fetch path and fallback behavior.
- Ayah key extraction from QCF4 groups.
- Transition key generation from QCF4 page-local ayah order.
- Rendering of inert side pages without interactive buttons.

Run:

- `npm run check`
- `npm test`

Browser verification must include:

- Page 1 and 2 opening layout.
- Page 596 or another previously overflowing page.
- A dense late page with many short ayahs.
- Ayah tap increment.
- Long press detail modal.
- Transition arc overlay.
- Keyboard and swipe navigation.

## Risks

- Exact visual parity depends on using the same QCF4 generation and glyph mapping as Muhaffidh.
- The QCF4 font set is larger than the current renderer and will increase offline cache size.
- If data generation is incomplete, page fallback must be obvious during development but invisible to end users once shipped.
- Overlay tracking UI can easily disturb inline glyph layout if implemented as real inline content.

## Out of Scope

- Runtime Quran Foundation API integration.
- Rebuilding the home/progress tabs in Muhaffidh's style.
- Changing memorization storage semantics.
- Changing RTL page navigation behavior.
