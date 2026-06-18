# Tap Hifz Quran Memorization PWA PRD

Status: Draft  
Product type: Progressive Web App  
Core navigation model: Standard 604-page mushaf  
Core rendering model: Selectable text using `zonetecde/mushaf-layout`  
Core tracking mechanic: Tap ayah numbers to track memorization strength  

## Summary

Tap Hifz is a focused Quran memorization tracker built around the standard 604-page mushaf layout. Users choose a mushaf page from the Home screen, enter the Reading screen, and track memorization directly on ayah numbers. The Reading screen renders selectable mushaf text using the `zonetecde/mushaf-layout` dataset. A single tap records repetition strength for an individual ayah. A double tap records transition strength from the previous ayah into the current ayah.

The app tracks two related but separate forms of memorization strength:

- Individual ayah repetition strength
- Transition strength between consecutive ayahs

## Problem

Quran memorization is not only about repeating isolated ayahs. A learner also needs to strengthen the movement from one ayah into the next. Simple repetition trackers often count practice globally, which hides whether the weakness is inside an ayah or at the transition point.

## Core Interaction

### Single tap

Tap an ayah number to increment that ayah's individual repetition count by 1.

### Double tap

Double tap ayah N to increment only the transition count from ayah N-1 to ayah N when both ayahs are on the same mushaf page.

Double tap does not create transitions across page boundaries. If an ayah is the first ayah on the current page, double tap is disabled or ignored for transition tracking, even when the previous ayah appears on the previous page. A double tap does not increment ayah N's individual repetition count.

## Target Users

- Students memorizing new Quran passages
- Students reviewing weak ayahs and weak transitions
- Teachers or parents who want a quick visual signal of practice progress

## Goals

- Make repetition logging fast enough to use during recitation practice
- Preserve the familiar 604-page mushaf navigation model
- Show which ayahs are individually strong or weak
- Show which transitions between ayahs need more practice
- Work well as a mobile-first installable PWA
- Preserve progress offline
- Avoid login/account requirements in the MVP
- Make Quran page layout/text available offline

## Initial MVP

- Mobile-first PWA shell
- Home screen with Progress, Surahs, and Bookmarks tabs
- Standard 604-page mushaf page selection
- Reading screen for one mushaf page at a time
- Selectable text rendering using `zonetecde/mushaf-layout`
- RTL page navigation where page 1 is the rightmost page and page 604 is the leftmost page
- Swipe left to go to the previous page
- Swipe right to go to the next page
- Ayah text with tappable ayah numbers
- Single tap individual repetition tracking
- Double tap transition repetition tracking
- Recent pages, ayah bookmarks, and page bookmarks
- Local persistence
- Simple visual strength indicators for ayahs and transitions
- Undo last action
- Review mode for weak ayahs and weak page-local transitions

## Out of Scope for MVP

- Audio recitation
- Audio playback controls
- Reciter selection
- Tafsir
- Translation
- Teacher dashboard
- Cloud sync
- User accounts/login
- Social sharing
- Multi-user classroom management

## Information Architecture

### Home screen

The Home screen has three tabs:

- Progress
- Surahs
- Bookmarks

Settings are available from a top-right action on the Home screen and the Reading screen.

The Home screen includes a compact jump/search field for direct navigation. It accepts page number, surah name/number, and juz number. Selecting a result opens the Reading screen at the target page.

### Progress tab

The Progress tab gives users a high-level view of memorization strength across the 604-page mushaf. The selected MVP layout combines a whole-mushaf 30-juz heatmap with a selected juz page grid.

The heatmap shows 30 colored juz pills in RTL order. Tapping a juz pill updates the selected juz grid below it. The selected juz grid shows the pages in that juz, with each page colored by the weakest individual ayah on that page. Tapping a page opens that page in the Reading screen.

Progress heatmap behavior:

- The 30-juz heatmap is sorted visually in RTL mushaf order.
- Each juz pill color is based on the weakest individual ayah in that juz.
- Selecting a juz updates the page grid below the heatmap; only the selected juz page grid is shown.
- The selected juz header shows weak and strong count pills.
- Weak count means the number of pages in the selected juz whose weakest ayah is Weak.
- Strong count means the number of pages in the selected juz whose weakest ayah is Strong or Mastered.
- Page cells are colored by the weakest individual ayah on that page.
- Transition strength is shown in weak-item lists and Review mode, but does not affect juz or page heatmap color.

The Progress tab also includes a Review mode entry point. A "Start weak review" CTA begins a queue of weak ayahs and weak page-local transitions. The queue is shown in Progress before the user starts, so the user can see what will be reviewed.

Progress empty states:

- With no progress yet, the 30-juz heatmap and selected juz page grid use neutral colors.
- The Progress tab shows a short prompt: "Open a page and tap ayah numbers to start tracking."
- If there are no weak review items, the Review CTA is disabled or visually quiet and says "No weak items to review."

When Review mode starts, each queue item opens in the normal Reading screen with the target ayah or transition highlighted. Review mode should provide lightweight next and skip controls without changing the core Reading screen tap behavior.

Review queue composition and ordering:

- Weak ayahs and weak page-local transitions are combined in one queue
- Each queue item is labeled as either Ayah or Transition
- Default Review queue size is 12 items
- Users can adjust Review queue size in Settings

1. Weakest strength level first
2. Lower repetition count first within the same strength level
3. Mushaf page order as the final tie-breaker

Review item completion behavior:

- An Ayah review item is complete when the user logs at least one valid individual repetition for that ayah.
- A Transition review item is complete when the user logs at least one valid transition repetition for that page-local transition.
- Completion does not auto-advance immediately.
- After completion, the app shows a temporary Next control so the user decides when to move on.
- Skipped items move to the end of the current queue.
- At the end of the queue, the app shows a completion summary with reviewed, skipped, and remaining weak counts.

### Surahs tab

The Surahs tab lists surah starts and juz markers in one interwoven list ordered by mushaf page position. This lets users navigate in the same way they think about the mushaf: by page, surah, and juz.

The app uses bundled static navigation metadata for surah, juz, and page indexing. `mushaf-layout` is used for page rendering, while normalized metadata powers navigation and labels.

Metadata requirements:

- `surahs[]`: surah number, Arabic name, transliterated/English name, and starting page
- `juz[]`: juz number, starting page, and ending page
- `pageIndex[pageNumber]`: surahs and juz present on that page

During implementation, metadata should be sourced from a trusted Quran metadata dataset/package, normalized into app-owned JSON, committed with the app, and available offline.

### Bookmarks tab

The Bookmarks tab contains:

- Recent pages
- Ayah bookmarks
- Page bookmarks

Recent pages are automatic. Page bookmarks and ayah bookmarks are manual user actions.

Bookmark behavior:

- Page bookmarks are added or removed from the page bookmark action in the Reading screen top right.
- Ayah bookmarks are added or removed from the long-press ayah detail view.
- Recent pages update automatically when a page is opened.
- Recent pages are limited to the 20 most recently opened unique pages.
- Recent pages are sorted by most recently opened first.
- Page bookmarks are sorted by mushaf page order by default.
- Ayah bookmarks are sorted by mushaf page order by default.
- Bookmark lists should support removing an item directly from the Bookmarks tab.

Bookmarks empty states:

- If there are no recent pages, show: "Pages you open will appear here."
- If there are no page bookmarks, show an empty Page Bookmarks section.
- If there are no ayah bookmarks, show an empty Ayah Bookmarks section.

### Reading screen

The Reading screen displays one mushaf page at a time. It is the main practice surface for reading, repetition tracking, transition tracking, and bookmarking.

The Reading screen top bar contains:

- Back button on the top left
- Page bookmark action on the top right
- Settings action on the top right

The Reading screen does not use a bottom toolbar in the MVP.

Undo appears as a temporary floating button after a logging action. It should be large enough for touch, clearly labeled for assistive technology, and positioned so it does not cover active ayah number controls.

Pages are rendered as selectable digital text, not static page images. The app uses `zonetecde/mushaf-layout` page JSON files as the layout source. Each page file represents one standard Madani mushaf page and includes precomputed line data.

The renderer handles these line types:

- `surah-header` for surah title lines
- `basmala` for basmala lines
- `text` for Quran text lines

For text lines, the app uses:

- `verseRange` to understand which verses appear on the line
- `words[]` to render selectable/tappable words and identify verse boundaries
- `location` values in `surah:verse:wordIndex` format to map interactions back to a precise ayah

The app should render by iterating each page's `lines[]`, branching by `type`, and rendering the appropriate line component.

The renderer should preserve mushaf line breaks, justify words across each line, and fit each line to the available page width. Text lines should not wrap into extra visual lines because that breaks the familiar mushaf page shape. The implementation should calculate a per-line scale or font-size adjustment within a controlled range so long lines fit the screen width. If a line still cannot fit at the minimum allowed scale, the page should reduce the base page font size for that viewport rather than allowing horizontal overflow or awkward wrapping.

### Ayah number rendering

The app renders Quran text from `words[]`, not from the pre-joined line `text`, so it can preserve selectable words while turning verse numbers into controls.

In `mushaf-layout`, the Arabic verse number is appended to the final word token of each ayah. The renderer should detect final word tokens with an appended Arabic verse number, split the token visually, and render:

- The Quran word as selectable text
- The appended verse number as a separate tappable ayah number control

Each ayah has exactly one ayah number control, placed at the actual verse ending. Long ayahs that span multiple lines do not receive repeated ayah controls on every line.

If a page contains only part of an ayah and the verse-ending number is not visible on that page, the renderer must not invent an extra ayah number control for that fragment.

Ayah number controls map to `surah:ayah` keys:

- Single tap increments individual ayah repetition count
- Long press opens exact count details and correction controls
- Double tap increments the page-local transition only when the previous ayah number is also visible on the same page

Long-press interaction rules:

- Long press on an ayah number opens the shared details modal for that ayah.
- Long press on a transition marker opens the same shared details modal for that transition.
- The shared details modal adapts its title, count, and correction controls based on whether the target is an Ayah or Transition.
- Long press on Quran word/text preserves native text selection.
- Ayah number controls and transition markers should use `user-select: none`.
- Quran words should use `user-select: text`.
- If a long-press begins on Quran text and moves onto an ayah number or transition marker, text selection wins.

Double-tap interaction rules:

- Default double-tap detection window is 250ms.
- Users can adjust the double-tap window in Settings.
- On first tap, the app waits for the double-tap window before committing the individual ayah increment.
- If a second tap lands on the same ayah number within the double-tap window, the app cancels the pending ayah increment and increments the page-local transition instead.
- If no second tap arrives within the window, the app commits the individual ayah increment.
- Ayah increment feedback briefly pulses the ayah number.
- Transition increment feedback briefly pulses the transition marker between the previous ayah and current ayah.
- Invalid double tap, such as double tapping the first ayah on a page, does not change counts and should show subtle unavailable feedback.

Navigation follows RTL mushaf order:

- Page 1 is the rightmost page
- Page 604 is the leftmost page
- Swipe left moves to the previous page
- Swipe right moves to the next page

The Reading screen does not show visible previous/next page buttons in the MVP. Page-to-page navigation is swipe-only for the primary touch interface.

Swipe boundary behavior:

- On page 1, swiping past the page boundary does not navigate.
- On page 604, swiping past the page boundary does not navigate.
- Boundary feedback should be subtle edge resistance or bounce.
- If vibration feedback is enabled, boundary feedback may include a light vibration.
- Boundary feedback should not show a toast because that interrupts reading.

Book-like page edge treatment:

- Odd pages show three subtle vertical page-edge lines from top to bottom on the right side.
- Even pages show three subtle vertical page-edge lines from top to bottom on the left side.
- The page-edge treatment should be decorative and must not interfere with text selection, ayah controls, or swipe gestures.

Accessibility alternatives for swipe-only navigation:

- Desktop/PWA keyboard users can use Left Arrow for previous page and Right Arrow for next page.
- Screen-reader users should have hidden accessible previous/next page actions.
- First-time Reading screen use should show a brief, dismissible swipe hint.
- Page 1 and page 604 boundaries should provide non-disruptive feedback when the user swipes beyond the available range.

## Functional Requirements

| Area | Requirement | Notes |
| --- | --- | --- |
| Mushaf navigation | Support navigation across pages 1-604. | Page order follows RTL mushaf behavior. |
| Reading swipe navigation | Use swipe-only previous/next page navigation in the Reading screen. | Swipe left goes to previous page. Swipe right goes to next page. |
| Swipe boundary behavior | Show subtle edge resistance/bounce at page 1 and page 604 boundaries. | No toast. Optional light vibration if vibration feedback is enabled. |
| Book-like page edge | Show subtle vertical page-edge lines on right for odd pages and left for even pages. | Decorative only; must not interfere with gestures or controls. |
| Reading accessibility navigation | Provide keyboard and screen-reader alternatives to swipe navigation. | Keyboard arrows and hidden accessible previous/next actions are required. |
| Home tabs | Provide Progress, Surahs, and Bookmarks tabs. | Tabs are the primary Home screen structure. |
| Home jump/search | Provide compact direct navigation search on Home. | Accepts page number 1-604, surah name/number, and juz number. Results open Reading screen at the target page. |
| Settings access | Provide Settings from the top-right action on Home and Reading screens. | Users can adjust thresholds or feedback without leaving practice context permanently. |
| Theme settings | Default the app to dark mode and provide a dark/light mode toggle in Settings. | Theme choice is stored locally. |
| Reading navigation chrome | Show back button top left, page bookmark top right, and Settings top right. | No bottom toolbar in MVP. |
| Progress overview | Show a 30-juz heatmap with a selected juz page grid below it. | Heatmap is RTL. Tapping a juz updates the selected grid. Only the selected juz page grid is shown. Tapping a page opens Reading. Page and juz color are based on weakest individual ayah. |
| Weak items | Show weak ayahs and weak page-local transitions below the page grid. | Items navigate directly to the relevant page and target, or can be started as a Review mode queue. |
| Review mode entry | Show a "Start weak review" CTA and weak-item queue in the Progress tab. | Review mode is launched from Progress, not as a separate Home tab. |
| Review mode practice | Open queue items in the normal Reading screen with the target highlighted. | Provide next and skip controls for the review queue. |
| Review queue size | Default Review queue size is 12 items. | Users can adjust this in Settings. |
| Review queue ordering | Sort queue items by weakest first, then lowest count, then page order. | Keeps review focused while preserving mushaf order when items have the same weakness. |
| Review queue composition | Combine weak ayahs and weak page-local transitions in one queue. | Items are labeled as Ayah or Transition. |
| Review completion | Complete an item after one valid repetition for that item. | Show Next after completion. Skipped items move to the end. Queue end shows a summary. |
| Surahs list | Show one interwoven list of surah starts and juz markers ordered by mushaf page position. | Entries navigate to their starting page. |
| Navigation metadata | Bundle normalized surah, juz, and page index metadata. | Use `mushaf-layout` for page rendering, not as the only navigation metadata source. |
| Bookmarks | Support recent pages, ayah bookmarks, and page bookmarks. | Recent pages update automatically and keep 20 unique pages. Page and ayah bookmarks are user-controlled and removable. |
| Empty states | Show useful empty states for no progress, no weak review items, no recent pages, and no bookmarks. | Empty states should guide the next action without adding onboarding clutter. |
| Mushaf rendering | Render selectable text from `zonetecde/mushaf-layout`. | Use `surah-header`, `basmala`, `text`, `verseRange`, and `words[]`. |
| Ayah display | Display mushaf pages with clearly tappable ayah numbers. | Ayah numbers should be derived from rendered text/word data and act as the main controls. |
| Individual count | Single tap on an ayah number increments that ayah's repetition count by 1. | Count is stored per surah and ayah. |
| Transition count | Double tap on ayah N increments only the transition count from ayah N-1 to ayah N when both ayahs are on the same page. | Disabled or ignored for the first ayah on a page. It does not also increment ayah N's individual count. |
| Strength feedback | Convert counts into visual strength levels shown as color by default. | Exact counts can be available in details, but the Reading screen defaults to color strength only. |
| Exact count visibility | Hide exact counts inline on the Reading screen. | Exact counts are available in long-press details and may appear in Progress/Review summaries. |
| Count details and correction | Long press an ayah number or transition marker to open the shared details modal. | The modal adapts for Ayah or Transition targets. Single tap and double tap remain dedicated to logging practice. |
| Double-tap settings | Let users adjust the double-tap detection window. | Default is 250ms. |
| Strength settings | Let users configure count thresholds for each strength level. | Individual ayah strength and transition strength have separate threshold settings. Defaults are Weak 1-9, Building 10-19, Strong 20-39, and Mastered 40+. |
| Feedback settings | Let users configure tap feedback. | Visual feedback is always enabled. Sound defaults off. Vibration defaults on when supported. Both can be changed in Settings. |
| Persistence | Save progress locally so it works offline. | Sync can be a later feature. |
| Quran data availability | Make mushaf layout/text data available offline. | Implementation can bundle data or fetch once and cache, but offline use is required. |
| Practice history | Store both lifetime counts and dated practice events. | Lifetime counts drive strength colors. Dated events support Progress tab history and future charts. |
| Correction | Allow undo, decrement, and reset when the user taps accidentally. | Undo appears as a temporary floating button after logging. Long-press details are the main correction surface. |

## Strength Levels

The Reading screen shows memorization strength using color by default. It does not show exact repetition counts inline unless the user opens a detail view.

Users access exact counts by long-pressing an ayah number or transition marker. This opens a lightweight detail view for that item.

The detail view should allow:

- Decrement by 1
- Reset to 0
- Close without changes

The app should also support undo for the most recent logging action.

MVP reset behavior:

- Single ayah or transition reset is available from long-press details
- Reset all data is available from Settings
- Reset all data requires confirmation

Reset all data confirmation copy:

- Title: "Reset all progress?"
- Body: "This will remove all repetition counts, practice history, recent pages, and bookmarks stored on this device. This cannot be undone."
- Confirm button: "Reset all data"
- Cancel button: "Cancel"

## Feedback Settings

The app should always provide visual confirmation after logging an ayah or transition repetition. Users can configure additional feedback in Settings:

- Sound on tap/double tap, default off
- Vibration on tap/double tap, default on when supported by the device

Sound and vibration should be optional because many users will practice in quiet environments.

Exact repetition counts are hidden on the Reading screen by default. They are visible in:

- Long-press ayah details
- Long-press transition details
- Progress and Review queue summaries when useful for sorting or explanation

Settings defaults:

- Theme: dark mode on
- Sound feedback: off
- Vibration feedback: on when supported
- Review queue size: 12 items
- Double-tap detection window: 250ms
- Exact counts inline on Reading screen: off, not configurable in MVP

Users can customize repetition thresholds in Settings. Individual ayah strength and transition strength use separate threshold profiles, so a user can make transition mastery easier or harder than ayah mastery.

The default thresholds for both profiles are:

| Level | Default count range |
| --- | --- |
| Not started | 0 |
| Weak | 1-9 |
| Building | 10-19 |
| Strong | 20-39 |
| Mastered | 40+ |

The default visual palette uses one monochrome lime strength family on the dark theme, plus grey for not started:

Dark mode main color: `#16161d`.

| Level | Default color |
| --- | --- |
| Not started | `#3d433a` |
| Weak | `#465829` |
| Building | `#769622` |
| Strong | `#abda1a` |
| Mastered | `#7fa80d` |

The Settings UI should let users change these thresholds independently for ayahs and transitions while preventing overlapping or impossible ranges.

## Data Model Draft

- `ayahProgress[ayahKey].repetitionCount`, where `ayahKey` is `surah:ayah`
- `transitionProgress[pageNumber][fromAyahKey][toAyahKey].repetitionCount`
- `pageProgress[pageNumber]` for page-level summaries derived from ayah and transition progress
- `recentPages[]`
- `ayahBookmarks[]`
- `pageBookmarks[]`
- `practiceEvents[]` for dated practice history and undo support
- `dailySummaries[]` derived from practice events for Progress tab reporting

Transition keys include `pageNumber` because transitions are page-local. The same `fromAyahKey` and `toAyahKey` pair on another page is a different transition target, and cross-page transitions are not tracked in the MVP.

## Persistence and Offline Storage

The MVP is local-first and offline-first.

Storage requirements:

- Use IndexedDB for app data, including progress, bookmarks, settings, practice events, and derived summaries.
- Use the PWA service worker cache for the app shell and Quran layout/text assets.
- Do not require cloud sync or user accounts in MVP.
- Provide manual JSON export and import backup from Settings.
- If persistent storage is unavailable or a write fails, show a blocking warning that progress cannot be saved reliably.
- Every count mutation is stored as a `practiceEvent`.
- Lifetime totals are updated from practice events.
- Undo creates a reversing event rather than deleting history.
- Reset actions create reset events rather than silently deleting prior events.

## Progress Tracking

The app stores both lifetime totals and dated practice history.

Lifetime totals are the source of truth for strength colors on the Reading screen:

- Individual ayah repetition total
- Page-local transition repetition total

Dated practice events record what happened during practice:

- Timestamp
- Page number
- Event type: ayah increment, transition increment, decrement, reset, or undo
- Target ayah or transition
- Count delta

Practice history records meaningful mutations only. Failed or no-op gestures, such as invalid double taps, page boundary swipes, or disabled-target taps, do not create `practiceEvents`. These may be logged only in temporary development/debug telemetry, not user progress data.

The Progress tab can use this history to show recent activity, daily totals, and future charts without changing the Reading screen interaction model.

## Success Metrics

- User can open any mushaf page from Home and navigate page-to-page with RTL swipe behavior
- User can log repetitions without breaking recitation flow
- User can identify weakest ayahs and weakest transitions within seconds
- Progress survives offline use and app reloads

## Open Product Decisions

None currently.

## Future Enhancements

- Sync and accounts
- Cross-device backup
