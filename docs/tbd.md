# Tap Hifz PRD Gaps To Resolve

## Highest Priority

None currently.

## Medium Priority

None currently.

## Resolved

17. Exact color palette.
   - Use a monochrome lime strength family on the dark theme, with grey for Not started.
   - Not started: `#3d433a`
   - Weak: `#465829`
   - Building: `#769622`
   - Strong: `#abda1a`
   - Mastered: `#7fa80d`

18. Theme default.
   - App defaults to dark mode.
   - Dark mode main color is `#16161d`.
   - Settings includes a dark/light mode toggle.
   - Theme choice is stored locally.

1. Ayah number rendering.
   - Render Quran text from `words[]`.
   - Split appended Arabic verse numbers from final word tokens.
   - The Quran word remains selectable text.
   - The verse number becomes the tappable ayah control.
   - Long ayahs get one ayah number control at the actual verse ending.
   - Partial ayah fragments do not get invented controls.

2. Transition identity includes `pageNumber`.
   - Use `transitionProgress[pageNumber][fromAyahKey][toAyahKey].repetitionCount`.
   - `fromAyahKey` and `toAyahKey` use `surah:ayah`.
   - Transitions are page-local only.

3. Progress heatmap details.
   - Use Option G: 30-juz heatmap with selected juz page grid below it.
   - Heatmap is sorted visually in RTL mushaf order.
   - Juz pill color is based on the weakest individual ayah in that juz.
   - Tapping a juz selects it and shows only that juz page grid.
   - Selected juz header shows weak and strong count pills.
   - Weak count means pages whose weakest ayah is Weak.
   - Strong count means pages whose weakest ayah is Strong or Mastered.
   - Page cells are colored by weakest individual ayah.
   - Transition strength does not affect juz or page heatmap color.

4. Settings defaults.
   - Sound feedback defaults off.
   - Vibration feedback defaults on when supported.
   - Review queue size defaults to 12 items.
   - Exact counts are hidden inline on the Reading screen and are not configurable in MVP.
   - Exact counts are visible in long-press details and may appear in Progress/Review summaries.

5. Bookmark flows.
   - Page bookmarks are toggled from the Reading screen top-right page bookmark action.
   - Ayah bookmarks are toggled from the long-press ayah detail view.
   - Recent pages update automatically when pages open.
   - Recent pages keep the 20 most recent unique pages.
   - Recent pages sort by most recent first.
   - Page and ayah bookmarks sort by mushaf page order by default.
   - Bookmarks can be removed directly from the Bookmarks tab.

6. Swipe-only navigation accessibility.
   - Primary touch navigation remains swipe-only.
   - Desktop/PWA keyboard users can use Left Arrow and Right Arrow.
   - Screen-reader users get hidden accessible previous/next page actions.
   - First Reading screen use shows a brief dismissible swipe hint.
   - Page boundary swipes provide non-disruptive feedback.

7. Review mode completion behavior.
   - Ayah review item completes after one valid individual repetition.
   - Transition review item completes after one valid page-local transition repetition.
   - Completion does not auto-advance immediately.
   - A temporary Next control appears after completion.
   - Skipped items move to the end of the current queue.
   - Queue end shows reviewed, skipped, and remaining weak counts.

8. Long press conflicts with selectable text.
   - Ayah number long press opens the shared details modal for that ayah.
   - Transition marker long press opens the same shared details modal for that transition.
   - Shared details modal adapts title, count, and correction controls by target type.
   - Quran word/text long press preserves native text selection.
   - Ayah controls and transition markers use `user-select: none`.
   - Quran words use `user-select: text`.
   - If long-press begins on Quran text and moves onto a control, text selection wins.

9. Double tap timing and gesture rules.
   - Default double-tap detection window is 250ms.
   - Users can adjust the double-tap window in Settings.
   - First tap waits for the double-tap window before committing ayah increment.
   - Second tap on the same ayah number within the window cancels the pending ayah increment and increments the page-local transition.
   - No second tap commits the individual ayah increment.
   - Ayah increment pulses the ayah number.
   - Transition increment pulses the transition marker.
   - Invalid double tap changes no counts and shows subtle unavailable feedback.

10. Persistence/storage acceptance criteria.
   - Use IndexedDB for progress, bookmarks, settings, practice events, and derived summaries.
   - Use PWA service worker cache for app shell and Quran layout/text assets.
   - No cloud sync or user accounts in MVP.
   - Provide manual JSON export/import backup from Settings.
   - Storage failure shows a blocking warning that progress cannot be saved reliably.
   - Every count mutation is stored as a `practiceEvent`.
   - Lifetime totals update from practice events.
   - Undo creates a reversing event rather than deleting history.
   - Reset creates reset events rather than silently deleting prior events.

11. Surah/juz metadata source.
   - Use `mushaf-layout` for page rendering only.
   - Bundle normalized static metadata for navigation.
   - `surahs[]` includes surah number, Arabic name, transliterated/English name, and starting page.
   - `juz[]` includes juz number, starting page, and ending page.
   - `pageIndex[pageNumber]` includes surahs and juz present on the page.
   - Source metadata from a trusted Quran metadata dataset/package during implementation, then commit normalized app-owned JSON.

12. Empty states.
   - No progress: heatmap and selected juz grid use neutral colors.
   - No progress prompt: "Open a page and tap ayah numbers to start tracking."
   - No weak review items: Review CTA is disabled or quiet and says "No weak items to review."
   - No recent pages: "Pages you open will appear here."
   - No page bookmarks: show empty Page Bookmarks section.
   - No ayah bookmarks: show empty Ayah Bookmarks section.

13. Page boundary behavior and book-like edge treatment.
   - Page 1 and page 604 boundary swipes do not navigate.
   - Boundary feedback is subtle edge resistance or bounce.
   - Optional light vibration if vibration feedback is enabled.
   - No toast for boundary swipes.
   - Odd pages show subtle vertical page-edge lines on the right side.
   - Even pages show subtle vertical page-edge lines on the left side.
   - Page-edge treatment is decorative and must not interfere with text selection, ayah controls, or swipe gestures.

14. Reset all data confirmation copy.
   - Title: "Reset all progress?"
   - Body: "This will remove all repetition counts, practice history, recent pages, and bookmarks stored on this device. This cannot be undone."
   - Confirm button: "Reset all data"
   - Cancel button: "Cancel"

15. Practice history and no-op gestures.
   - Practice history records meaningful mutations only.
   - Invalid double taps, page boundary swipes, and disabled-target taps do not create `practiceEvents`.
   - No-op gestures may be logged only in temporary development/debug telemetry, not user progress data.

16. Home direct page number search/jump.
   - Home includes compact jump/search field.
   - Accepts page number 1-604.
   - Accepts surah name or number.
   - Accepts juz number.
   - Selecting a result opens Reading screen at the target page.
   - This is a Home action, not a fourth tab.
