# Transition Halo Design

Date: 2026-06-17
Status: Proposed
Scope: Reading-page ayah ending indicator redesign

## Goal

Remove the layout pressure caused by the current inline `.transition-mark` while preserving transition feedback on the reading page.

The replacement should:

- stop transition visuals from consuming line width between Quran words
- keep ayah strength and transition strength visible at the ayah ending
- remain readable on tight lines, especially on pages 1 and 2
- preserve the current page-local transition rules and counting behavior

This slice changes only the reading-page presentation of transition strength. It does not change the counting model, threshold settings, or review queue semantics.

## Why Change It

The current design renders the transition indicator as its own inline element before the ayah number. Even after removing long-press behavior from that element, it still participates in line layout. On tight Quran lines, that extra width can push text leftward and create overflow pressure.

The reading page needs the transition cue to feel attached to the ayah ending, not wedged into the text flow as a separate box.

## Design Summary

Replace the separate `.transition-mark` with a single ayah-ending unit:

- inner badge = ayah number with ayah-strength fill/background
- outer ring arc = transition strength only

The ayah number remains the only inline control at the verse ending. The transition cue is drawn as a circular ring layer around that badge, not as a separate sibling in the text row.

This keeps the line layout compact and removes the current "word + transition box + ayah badge" width stack.

## Visual Model

At each ayah ending:

- the center badge keeps the existing ayah number
- the badge fill/background continues to show ayah strength
- a surrounding circular arc shows transition strength

Transition ring mapping:

- `weak` = short arc
- `building` = medium arc
- `strong` = long arc
- `mastered` = full ring

Exact transition counts are not shown in the ring. The ring reflects the transition strength bucket only, matching the app's current reading-page emphasis on compact strength cues over precise numeric detail.

## Layout Model

### Current structure

Current ayah endings are rendered roughly like:

- word text
- transition element
- ayah number button

That makes the transition element claim width inside `.mushaf-line`.

### Proposed structure

Each ayah ending becomes one inline cluster:

- word text
- ayah button with internal visual layers

The transition ring is rendered by the ayah button itself, or by a pseudo-element tied to that button, so the row layout sees only one inline element for the ayah ending.

Requirements:

- no standalone `.transition-mark` element remains in the mushaf line
- the ayah button keeps its tappable area at least as large as the current badge
- the ring must not expand line width beyond the intended ayah-ending cluster size
- ring visuals should stay centered around the badge and not drift into neighboring words

## Rendering Approach

Preferred implementation approach:

1. Compute the transition strength for the current ayah ending exactly as today, using the previous visible ayah on the page when present.
2. Pass that transition strength onto the ayah-mark element as a class or data attribute.
3. Style the ring using CSS on the ayah button itself:
   - inner badge styles remain responsible for ayah strength
   - outer ring styles use pseudo-elements or layered backgrounds for transition strength

Suggested data shape on the ayah control:

```html
<button
  class="ayah-mark strong transition-building"
  data-ayah="2:5"
  data-page="1"
  aria-label="Surah 2:5"
>
  5
</button>
```

The exact class naming can vary, but the separation of concerns should stay:

- ayah state drives the badge appearance
- transition state drives the outer ring appearance

## Interaction Model

The ayah number remains the interaction owner:

- single tap = ayah repetition
- double tap = transition repetition when valid
- long press = shared modal

The transition ring is informational only. It does not reintroduce a separate interaction target.

This keeps the interaction model simpler than the current design and removes the original source of overflow.

## State Rules

### When a transition exists

If the ayah has a valid previous visible ayah on the same page:

- compute the page-local transition key as today
- read transition count as today
- map that count to transition strength
- render the matching ring arc around the ayah badge

### When no transition exists

If the ayah is the first visible ayah on the page, or there is otherwise no valid page-local previous ayah:

- do not render a transition ring
- do not reserve extra width for a missing ring state
- keep the ayah badge visually stable

This preserves the existing rule that the first ayah on a page does not have a valid incoming page-local transition.

## Accessibility

The compact visual design should not make the control less understandable:

- the ayah button keeps its accessible label
- if transition state is included in accessibility text, append it to the same button label rather than creating a second hidden control
- ring-only cues should not be the sole source of meaning for non-visual users

Suggested label pattern when transition exists:

- `Surah 2:5, ayah strong, transition building`

Suggested label pattern when transition does not exist:

- `Surah 2:1, ayah weak`

## Error Handling And Fallbacks

If ring rendering fails or a browser does not support the chosen CSS technique cleanly:

- keep the ayah badge fully usable
- prefer dropping the ring visual over reintroducing the standalone transition element

If the ring proves too visually noisy at very small sizes:

- reduce ring thickness before changing badge size
- keep the badge tap target stable
- avoid introducing responsive layout branches that change the meaning of the indicator

## Testing And Verification

Verification should focus on layout correctness and semantic clarity.

### Functional checks

- ayah tap still increments ayah count
- double tap still increments transition count only when valid
- long press still opens the shared modal from the ayah number
- first ayah on a page still has no valid transition interaction

### Layout checks

- no reading line includes a separate transition inline element
- pages 1 and 2 no longer experience left overflow caused by transition visuals
- longer Quran lines on other pages remain within the page shell
- the ring stays visually centered around the ayah badge

### Visual checks

- all four transition strength buckets are distinguishable at reading size
- ayah strength fill and transition ring do not blur together
- highlighted review targets still read clearly when the target is an ayah with a ring

## Scope Boundaries

This design does not include:

- exact transition counts inside the reading-page badge
- separate transition tap targets
- dual-ring encoding for both ayah and transition progress
- changes to thresholds or review ordering
- redesigning the modal content

## Recommendation

Implement the transition halo by folding transition strength into the ayah-mark component and removing the separate `.transition-mark` from reading-line layout entirely.

That gives the clearest fix for overflow while preserving the meaning of both signals:

- ayah badge fill = ayah strength
- outer circular arc = transition strength
