# Reading Page Swipe Reveal Design

Date: 2026-06-17
Status: Proposed
Scope: Reader interaction polish for page navigation

## Goal

Make page changes in the reader feel like handling a physical mushaf page rather than replacing one screen with another.

The target interaction for this slice is:

- the current page follows the finger while swiping
- the adjacent page is already present and gradually revealed underneath
- the user feels like there is another page waiting at the side
- the current left/right page mapping remains unchanged from the existing app behavior

This slice improves motion and layering only. It does not redesign the page shell, change ayah-counting behavior, or introduce a full three-page carousel.

## Why This Slice

The current reader already supports swipe navigation, but the interaction still reads as a content swap. The page moves, then another page appears. That is functional, but it does not communicate the spatial relationship between consecutive mushaf pages.

Adding a real reveal layer first gives us most of the physical-page feeling with a smaller implementation surface than a full carousel. It also creates a clean stepping stone if we later decide to move to a three-page track.

## Design Summary

Use a two-layer reader:

- top layer = active page
- bottom layer = the adjacent page for the current swipe direction

During drag, the top page translates horizontally with the pointer and exposes the bottom page progressively. On release:

- a short swipe snaps the top page back into place
- a committed swipe completes the slide and promotes the revealed page to become the new active page

The adjacent page is preloaded before the reveal becomes visible so the edge never appears blank.

## Interaction Model

### Swipe behavior

The existing mapping stays intact:

- swipe right reveals and opens the next page
- swipe left reveals and opens the previous page

The top page should track the drag directly enough to feel responsive, while still allowing a little resistance so the gesture remains controlled on small screens.

The reveal should not appear as a fade or crossfade. It should read as one page moving aside and another page sitting underneath it.

### Drag lifecycle

1. Pointer down on the page shell stores gesture origin.
2. Once horizontal intent is clear, the reader enters drag mode.
3. The active page translates horizontally with the drag.
4. The adjacent page becomes visible from the appropriate side under the active page.
5. On release:
   - if the swipe does not pass threshold, animate back to rest
   - if the swipe passes threshold, animate the active page out and settle on the revealed page

### Boundary behavior

At page `1` and page `604`, there is no adjacent page on one side.

For those cases:

- keep resistance feedback
- do not reveal an empty layer
- allow a short tug that communicates there is no page beyond the boundary

## Layout And Layering

The reader page shell becomes a clipped stage containing two page surfaces:

- `revealed-page`
- `active-page`

Requirements:

- both layers use the same mushaf page styling and dimensions
- only the active page is interactive during drag
- the revealed page remains visually slightly recessed so the active page still feels foregrounded
- the reveal edge should come from the side being exposed, not from a centered zoom or fade

The underlying page can be slightly offset or dimmed at rest, but the effect should stay subtle and should not compromise readability once it becomes the active page.

## Data And State

Add reader-local swipe state for:

- drag start position
- current horizontal offset
- current reveal direction
- whether navigation animation is already in flight
- prefetched adjacent page data for the currently exposed side

State expectations:

- dragging should never trigger duplicate page-navigation requests
- the active page should remain the source of truth until the turn commits
- when a turn completes, the route and current page data update once, then the reader re-renders with the new page as active

## Prefetch Strategy

The reveal interaction depends on nearby page data being ready in time.

For this slice:

- when the reader is on page `n`, prefetch page `n - 1` and page `n + 1` opportunistically when valid
- if both are not prefetched yet, the first visible reveal should still wait for the needed side before exposing it
- keep the prefetch logic lightweight and local to the reader

This is intentionally narrow. It does not introduce a larger caching architecture.

## Interaction Safety

To avoid accidental behavior during drag:

- suppress click-through after a completed swipe gesture
- keep ayah buttons on the revealed page non-interactive until the turn is complete
- cancel drag cleanly on pointer cancel
- ensure no transform or drag class remains stuck after release or interruption

Keyboard navigation should continue to work. It may keep the simpler page-turn animation for now, but should still use the same layered page shell once the new page renders.

## Visual Expectations

The interaction should feel:

- spatial
- deliberate
- calm

It should not feel like:

- a card carousel
- a modal slide transition
- a generic mobile screen swap

The reader is dense and text-heavy, so motion needs restraint. The page should glide, not snap harshly, and the reveal should stay readable throughout the gesture.

## Files Expected To Change

- `src/app.js`
- `src/styles.css`

Optional:

- a small helper inside `src/app.js` for rendering page layers if the reader markup becomes too crowded

## Implementation Outline

1. Refactor the reader markup to support an active page layer and a revealed page layer inside the page shell.
2. Add local swipe state that tracks drag offset and reveal direction.
3. Prefetch adjacent page data for valid neighboring pages.
4. Render the correct neighbor beneath the active page while dragging.
5. Commit or cancel the turn based on swipe threshold.
6. Preserve existing page boundaries, bookmark state, and reader actions.
7. Verify that transforms, interaction locks, and page data all reset cleanly after navigation.

## Out Of Scope

- full three-page carousel or track-based layout
- curl or fold page-turn effects
- 3D transforms
- redesigned navigation mapping
- changes to review flow, ayah progress, or bookmark semantics

## Risks

- The reader currently re-renders page content directly from a single `currentPageData` source. Introducing a revealed layer adds more UI state and makes timing bugs more likely if data loading and animation are not sequenced carefully.
- On slower devices, prefetch timing may make the first reveal feel inconsistent if the adjacent page is not ready early enough.
- Dense Arabic page content can make overlapping layers look muddy if spacing, clipping, or opacity treatment is too aggressive.

## Verification Plan

Manual verification for this slice:

1. Open a reader page and drag right slowly. Confirm the next page becomes progressively visible underneath.
2. Drag left slowly. Confirm the previous page becomes progressively visible underneath.
3. Release before threshold in both directions. Confirm the page snaps back with no stuck offset.
4. Commit a swipe in both directions. Confirm the revealed page becomes the new active page cleanly.
5. Swipe at page `1` toward the invalid side. Confirm there is resistance but no blank reveal.
6. Swipe at page `604` toward the invalid side. Confirm there is resistance but no blank reveal.
7. Tap ayah controls after a swipe completes. Confirm only the active page is interactive.
8. Check the browser console for interaction errors or unhandled promise failures.

## Follow-on Option

If this slice feels good but still not spatial enough, the next step is a true three-page carousel:

- previous page
- current page
- next page

That follow-on would trade a stronger spread illusion for a larger reader rewrite and more state coordination.
