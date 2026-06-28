import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("ayah pulse starts at its peak and settles back to normal", () => {
  assert.match(styles, /0%\s*\{\s*transform:\s*scale\(1\.22\);\s*\}/);
  assert.match(styles, /100%\s*\{\s*transform:\s*scale\(1\);\s*\}/);
});

test("mutation feedback spawns a floating repetition count", () => {
  assert.match(appSource, /spawnRepetitionCountPop\(marker,\s*count,\s*app\)/);
  assert.match(styles, /\.repetition-count-pop/);
});

test("ayah marker gives immediate tap feedback before count commit", () => {
  assert.match(appSource, /handleAyahTap\(button\.dataset\.ayah,\s*button\)/);
  assert.match(appSource, /function playAyahTapFeedback\(marker\)/);
  assert.match(appSource, /marker\.animate\(/);
});

test("count increase sound is prepared during the tap gesture before delayed commit", () => {
  assert.match(appSource, /function handleAyahTap\(key,\s*marker = null\)\s*\{[\s\S]*?prepareCountIncreaseSound\(\);[\s\S]*?setTimeout\(\(\) => \{/);
  assert.match(appSource, /let countIncreaseAudioContext = null/);
  assert.doesNotMatch(appSource, /context\.close\(\)/);
});

test("page shell pointerup routes non-drag ayah taps to feedback", () => {
  assert.match(appSource, /resolveAyahMarkerAtPoint\(event\.clientX,\s*event\.clientY\)/);
  assert.match(appSource, /lastPointerAyahTap/);
  assert.match(appSource, /handleAyahTap\(ayahMarker\.dataset\.ayah,\s*ayahMarker\)/);
});

test("ayah count tracking ignores non-primary pointer buttons", () => {
  assert.match(appSource, /button\.addEventListener\("click",\s*\(event\) => \{[\s\S]*?if \(event\.button !== 0\) return;[\s\S]*?handleAyahTap\(button\.dataset\.ayah,\s*button\)/);
  assert.match(appSource, /pageShell\.addEventListener\("pointerdown",\s*\(event\) => \{[\s\S]*?if \(event\.button !== 0\) return;[\s\S]*?swipeStart = \{/);
});

test("long press detail modal cancels active page swipe gesture", () => {
  assert.match(appSource, /function cancelPageGesture\(\)/);
  assert.match(appSource, /bindLongPress\(button,\s*\(\) => openAyahDetail\(button\)\)/);
  assert.match(appSource, /function openAyahDetail\(button\)\s*\{[\s\S]*?clearPendingTap\(\);[\s\S]*?cancelPageGesture\(\);[\s\S]*?detailTarget = \{ kind: "ayah"/);
});

test("right click ayah number opens the same detail modal as long press", () => {
  assert.match(appSource, /button\.addEventListener\("contextmenu",\s*\(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?openAyahDetail\(button\);[\s\S]*?\}\)/);
});

test("desktop text selection bypasses page swipe startup", () => {
  assert.match(appSource, /shouldStartTrackGesture/);
  assert.match(appSource, /pointerType:\s*event\.pointerType/);
  assert.match(appSource, /startedOnSelectableText:\s*Boolean\(event\.target\.closest\?\.\("\.mushaf-line"\)\)/);
});

test("margin swipes suppress text selection before drag threshold", () => {
  assert.match(appSource, /pageShell\.classList\.add\("swipe-armed"\)/);
  assert.match(appSource, /event\.preventDefault\(\);\s*swipeStart = \{/);
  assert.match(appSource, /pageShell\.classList\.remove\("swipe-armed"\)/);
  assert.match(styles, /\.page-shell\.swipe-armed\s+\.mushaf-line[\s\S]*user-select:\s*none/);
});

test("ayah feedback animations stay visible in the app preview", () => {
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.pulse[\s\S]*animation-duration:\s*\.42s\s*!important/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.repetition-count-pop[\s\S]*animation-duration:\s*\.68s\s*!important/);
});

test("ayah pulse can replay on repeated taps", () => {
  assert.match(appSource, /restartAyahPulse\(marker\)/);
  assert.match(appSource, /playAyahTapFeedback\(marker\)/);
});

test("ayah feedback pop is positioned in an app overlay outside the marker", () => {
  assert.match(appSource, /getBoundingClientRect\(\)/);
  assert.match(appSource, /container\.append\(pop\)/);
  assert.match(styles, /\.repetition-count-pop[\s\S]*position:\s*fixed/);
});

test("page navigation click binding excludes ayah marker buttons", () => {
  assert.match(appSource, /querySelectorAll\("\[data-page\]:not\(\[data-ayah\]\)"/);
});

test("reader exposes bottom previous and next buttons for desktop navigation", () => {
  assert.match(appSource, /class="reader-bottom-nav"/);
  assert.match(appSource, /class="reader-bottom-btn next" data-action="next-page"[^>]*aria-label="Next page"[\s\S]*?class="reader-bottom-btn previous" data-action="previous-page"[^>]*aria-label="Previous page"/);
  assert.match(appSource, /class="reader-bottom-btn previous" data-action="previous-page"[^>]*aria-label="Previous page"[\s\S]*?\$\{icons\.previousPage\}/);
  assert.match(appSource, /class="reader-bottom-btn next" data-action="next-page"[^>]*aria-label="Next page"[\s\S]*?\$\{icons\.nextPage\}/);
  assert.match(appSource, /previousPage:\s*`<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"\/><\/svg>`/);
  assert.match(appSource, /nextPage:\s*`<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"\/><\/svg>`/);
  assert.doesNotMatch(appSource, />Previous page<\/button>/);
  assert.doesNotMatch(appSource, />Next page<\/button>/);
  assert.match(styles, /\.reader-bottom-nav/);
  assert.match(styles, /\.reader-bottom-btn/);
});

test("reader no longer renders the swipe hint copy", () => {
  assert.doesNotMatch(appSource, /Swipe left for previous page/);
  assert.doesNotMatch(appSource, /class="swipe-hint"/);
  assert.doesNotMatch(styles, /\.swipe-hint/);
});

test("settings modal is full-height with a sticky close header", () => {
  assert.match(styles, /\.modal-backdrop:has\(\.settings-modal\)\s*\{[\s\S]*padding:\s*0/);
  assert.match(styles, /\.settings-modal\s*\{[\s\S]*height:\s*100dvh[\s\S]*max-height:\s*100dvh[\s\S]*overflow-y:\s*auto/);
  assert.match(styles, /\.settings-modal\s+\.modal-head\s*\{[\s\S]*position:\s*sticky[\s\S]*top:\s*0[\s\S]*z-index:\s*2/);
});

test("transition underline renders as a centered source-ayah cue", () => {
  assert.match(styles, /--transition-progress:\s*0%/);
  assert.match(styles, /\.ayah-mark::before\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*transparent,\s*color-mix\(in srgb,\s*var\(--text\) 34%,\s*transparent\)/);
  assert.match(styles, /\.ayah-mark::after\s*\{[\s\S]*inset-inline:\s*-\.16em/);
  assert.match(styles, /clip-path:\s*inset\(0 var\(--transition-clip\)\)/);
  assert.match(styles, /linear-gradient\(90deg,\s*transparent,\s*var\(--transition-color\)[\s\S]*transparent\)/);
  assert.doesNotMatch(styles, /\.ayah-mark::after\s*\{[\s\S]*z-index:\s*-1/);
  assert.match(appSource, /resolveOutgoingTransition\(key,\s*metadata\)/);
});

test("transition increment triggers a center-out shine on the source ayah", () => {
  assert.match(styles, /\.transition-shine::after[\s\S]*animation:\s*transition-shine/);
  assert.match(styles, /@keyframes transition-shine[\s\S]*clip-path:\s*inset\(0 50%\)/);
  assert.match(appSource, /if \(key\.includes\("\|"\)\) restartTransitionShine\(marker\)/);
  assert.match(appSource, /function restartTransitionShine\(marker\)/);
});

test("double tap logs the outgoing transition from the tapped ayah", () => {
  assert.match(appSource, /const transition = resolveOutgoingTransition\(key,\s*metadata\)/);
  assert.match(appSource, /logTransition\(transition\.key\)/);
  assert.doesNotMatch(appSource, /const previous = previousVisibleAyah\(key\);[\s\S]*?logTransition\(transitionKey\(route\.page,\s*previous,\s*key\)\)/);
});
