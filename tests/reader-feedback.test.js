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

test("detail modal exposes increment buttons beside repetition and transition decrements", () => {
  assert.match(appSource, /data-action="decrement-detail"[\s\S]*aria-label="Decrease transition count">-<\/button>[\s\S]*data-action="increment-detail"[\s\S]*aria-label="Increase transition count">\+<\/button>/);
  assert.match(appSource, /data-action="decrement-transition-detail"[\s\S]*aria-label="Decrease transition count">-<\/button>[\s\S]*data-action="increment-transition-detail"[\s\S]*aria-label="Increase transition count">\+<\/button>/);
  assert.match(appSource, /data-action="decrement-repetition-detail"[\s\S]*aria-label="Decrease repetition count">-<\/button>[\s\S]*data-action="increment-repetition-detail"[\s\S]*aria-label="Increase repetition count">\+<\/button>/);
});

test("quick ayah taps cancel long press even after page shell captures the pointer", () => {
  assert.match(appSource, /function bindLongPress\(el,\s*callback\)\s*\{[\s\S]*?document\.addEventListener\("pointerup",\s*clearMatchingPointer,\s*true\)/);
  assert.match(appSource, /function bindLongPress\(el,\s*callback\)\s*\{[\s\S]*?if \(nextEvent\.pointerId === pointerId\) clear\(\);/);
  assert.match(appSource, /function bindLongPress\(el,\s*callback\)\s*\{[\s\S]*?document\.removeEventListener\("pointerup",\s*clearMatchingPointer,\s*true\)/);
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
  assert.match(styles, /\.repetition-count-pop\s*\{[\s\S]*animation:\s*repetition-count-pop 2\.36s/);
  assert.match(styles, /@keyframes repetition-count-pop[\s\S]*7\.6%,\s*50%\s*\{[\s\S]*opacity:\s*1;[\s\S]*translate\(-50%,\s*-78%\) scale\(1\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.repetition-count-pop[\s\S]*animation-duration:\s*2\.36s\s*!important/);
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

test("ayah feedback pop centers on the visual ayah glyph", () => {
  assert.match(appSource, /const rect = getAyahMarkerVisualRect\(marker\)/);
  assert.match(appSource, /function getAyahMarkerVisualRect\(marker\)\s*\{[\s\S]*marker\.querySelector\?\.\("\.ayah-mark-glyph"\)\?\.getBoundingClientRect\?\.\(\)/);
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

test("reader moves page metadata into side-line-safe page chrome", () => {
  assert.match(appSource, /function renderPageChrome\(page\)/);
  assert.match(appSource, /renderPageChrome\(route\.page\)/);
  assert.match(appSource, /class="page-chrome page-top-meta"/);
  assert.match(appSource, /class="page-meta-surah"/);
  assert.match(appSource, /class="page-meta-range"/);
  assert.match(appSource, /class="page-meta-juz"/);
  assert.match(appSource, /class="page-bottom-meta">\$\{page\}<\/div>/);
  assert.match(appSource, /formatPageAyahRange\(pageData\.ayahKeys\)/);
  assert.match(appSource, /getPagePrimarySurahName\(pageData\)/);
  assert.doesNotMatch(appSource, /`Page \$\{route\.page\} Â· \$\{metadata\.pages\[String\(route\.page\)\]\?\.label \|\| ""\}`/);
  assert.match(styles, /\.page-chrome\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(styles, /\.page-shell\.odd\s*\{[\s\S]*--page-chrome-right:\s*40px/);
  assert.match(styles, /\.page-shell\.even\s*\{[\s\S]*--page-chrome-left:\s*40px/);
});

test("reader no longer renders the swipe hint copy", () => {
  assert.doesNotMatch(appSource, /Swipe left for previous page/);
  assert.doesNotMatch(appSource, /class="swipe-hint"/);
  assert.doesNotMatch(styles, /\.swipe-hint/);
});

test("home and reader headers share height while home progress avoids horizontal overflow", () => {
  assert.match(styles, /\.topbar,\s*\.reading-top\s*\{[\s\S]*min-height:\s*48px/);
  assert.match(styles, /\.home-panel\s*\{[\s\S]*overflow-y:\s*auto;[\s\S]*overflow-x:\s*hidden/);
  assert.match(styles, /\.progress-card\s*\{[\s\S]*min-width:\s*0;[\s\S]*overflow-x:\s*hidden/);
  assert.match(styles, /\.mushaf-strip\s*\{[\s\S]*overflow:\s*hidden/);
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
  assert.match(styles, /\.ayah-chars\s+\.ayah-marker\.ayah-mark\s*\{[\s\S]*--ayah-marker-visual-offset:\s*\.2em/);
  assert.match(styles, /\.ayah-chars\s+\.ayah-marker\.ayah-mark::before,[\s\S]*\.ayah-chars\s+\.ayah-marker\.ayah-mark::after\s*\{[\s\S]*transform:\s*translateX\(var\(--ayah-marker-visual-offset\)\)/);
  assert.match(styles, /\.ayah-chars\s+\.ayah-marker\.ayah-mark\s+\.ayah-mark-glyph\s*\{[\s\S]*transform:\s*translateX\(var\(--ayah-marker-visual-offset\)\)/);
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

test("fully mastered ayah markers get a looped shine class and reduced-motion fallback", () => {
  assert.match(appSource, /ringState\.isFullyMastered \? "fully-mastered" : ""/);
  assert.match(appSource, /class="ayah-mark-glyph-base">\$\{value\}<\/span><span class="ayah-mark-glyph-shine" aria-hidden="true">\$\{value\}<\/span>/);
  assert.match(styles, /\.ayah-mark-glyph\s*\{[\s\S]*margin-inline:\s*-\.12em;[\s\S]*padding-inline:\s*\.12em/);
  assert.match(styles, /\.ayah-mark\.fully-mastered\s+\.ayah-mark-glyph-base\s*\{[\s\S]*color:\s*var\(--mastered\)/);
  assert.match(styles, /\.ayah-mark\.fully-mastered\s+\.ayah-mark-glyph-shine\s*\{[\s\S]*background-clip:\s*text/);
  assert.match(styles, /\.ayah-mark\.fully-mastered\s+\.ayah-mark-glyph-shine\s*\{[\s\S]*linear-gradient\(110deg,\s*transparent/);
  assert.match(styles, /\.ayah-mark\.fully-mastered\s+\.ayah-mark-glyph-shine\s*\{[\s\S]*animation:\s*ayah-fully-mastered-glyph-shine 2\.6s ease-in-out infinite/);
  assert.doesNotMatch(styles, /\.ayah-mark\.fully-mastered\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 999px/);
  assert.match(styles, /@keyframes ayah-fully-mastered-glyph-shine[\s\S]*background-position:\s*-90% 0/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.ayah-mark\.fully-mastered\s+\.ayah-mark-glyph-shine\s*\{[\s\S]*animation:\s*none/);
});

test("double tap logs the outgoing transition from the tapped ayah", () => {
  assert.match(appSource, /const transition = resolveOutgoingTransition\(key,\s*metadata\)/);
  assert.match(appSource, /logTransition\(transition\.key\)/);
  assert.doesNotMatch(appSource, /const previous = previousVisibleAyah\(key\);[\s\S]*?logTransition\(transitionKey\(route\.page,\s*previous,\s*key\)\)/);
});

test("home and reader expose help buttons before settings and reader actions", () => {
  assert.match(appSource, /<div class="top-actions">\s*\$\{renderHelpButton\(\)\}\s*<button class="icon-btn" data-action="settings"/);
  assert.match(appSource, /<button class="icon-btn \$\{pageBookmarked[\s\S]*?\$\{renderHelpButton\(\)\}\s*<button class="icon-btn" data-action="settings"/);
});

test("help modal contains the four tutorial topics", () => {
  assert.match(appSource, /const helpSlides = \[/);
  assert.match(appSource, /const helpSlides = \[\s*\{[\s\S]*?title:\s*"Open a page"[\s\S]*?title:\s*"Track practice"[\s\S]*?title:\s*"Inspect details"[\s\S]*?title:\s*"Progress colors"/);
  assert.match(appSource, /title:\s*"Progress colors"/);
  assert.match(appSource, /Grey\/white means not started/);
  assert.match(appSource, /title:\s*"Open a page"/);
  assert.match(appSource, /title:\s*"Track practice"/);
  assert.match(appSource, /Use one tap when you repeat that ayah by itself/);
  assert.match(appSource, /two quick taps when you practice connecting that ayah into the next one/);
  assert.match(appSource, /both ayah strength and transition strength/);
  assert.match(appSource, /title:\s*"Inspect details"/);
  assert.match(appSource, /function renderHelpModal\(\)/);
});

test("progress color help visual uses real QCF4 ayah markers", () => {
  assert.match(appSource, /const colorLevels = \[/);
  for (const level of ["empty", "weak", "building", "strong", "mastered"]) {
    assert.match(appSource, new RegExp(`level: "${level}"`));
  }
  assert.match(appSource, /class="ayah-marker ayah-mark \$\{level\} transition-count-\$\{level\} help-color-marker"/);
  assert.match(appSource, /--count-color: var\(--\$\{level\}\)/);
  assert.match(appSource, /help-color-marker"[\s\S]*>&#xf1a3;<\/span>/);
  assert.match(styles, /\.help-color-marker\.ayah-marker\.ayah-mark/);
  assert.match(styles, /\.help-color-marker\.ayah-marker\.ayah-mark[\s\S]*background:\s*transparent/);
  assert.match(styles, /\.help-color-marker\.ayah-marker\.ayah-mark[\s\S]*font-size:\s*2\.12rem/);
  assert.doesNotMatch(styles, /\.help-color-row span\s*\{[\s\S]*width:\s*44px/);
});

test("open page help visual matches the home tab bar", () => {
  assert.match(appSource, /class="help-home-preview"/);
  assert.match(appSource, /class="help-search-box"/);
  assert.match(appSource, /Page 48, Al-Baqarah, Juz 3/);
  assert.match(appSource, /class="help-home-tabs"/);
  assert.match(appSource, /<span class="active">Progress<\/span>/);
  assert.match(appSource, /<span>Surahs<\/span>/);
  assert.match(appSource, /<span>Bookmarks<\/span>/);
  assert.match(styles, /\.help-search-box\s*\{[\s\S]*min-height:\s*46px/);
  assert.match(styles, /\.help-search-box\s*\{[\s\S]*border:\s*1px solid var\(--line\)/);
  assert.match(styles, /\.help-search-box\s*\{[\s\S]*background:\s*var\(--surface\)/);
  assert.match(styles, /\.help-home-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /\.help-home-tabs\s*\{[\s\S]*background:\s*rgba\(10,\s*22,\s*40,\s*\.45\)/);
  assert.match(styles, /\.help-home-tabs \.active\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*var\(--surface-2\),\s*var\(--surface\)\)/);
});

test("track practice help visual shows ayah marker, transition cue, and animated hand", () => {
  assert.match(appSource, /class="help-ayah-demo"/);
  assert.match(appSource, /class="ayah-marker ayah-mark building transition-count-building help-ayah-glyph"/);
  assert.match(appSource, /font-family:\s*'QCF2001'/);
  assert.match(appSource, /--count-color:\s*var\(--building\)/);
  assert.match(appSource, /--transition-progress:\s*62%/);
  assert.match(appSource, /class="ayah-marker ayah-mark building transition-count-building help-ayah-glyph"[\s\S]*>&#xf1a3;<\/span>/);
  assert.match(appSource, /class="help-plus-pop ayah"/);
  assert.match(appSource, /class="help-plus-pop transition"/);
  assert.match(appSource, /class="help-hand-tap"/);
  assert.match(appSource, /class="help-tap-label single">1 tap/);
  assert.match(appSource, /class="help-tap-label double">2 taps/);
  assert.match(styles, /\.help-ayah-demo\s*\{[\s\S]*height:\s*112px/);
  assert.match(styles, /\.help-ayah-glyph/);
  assert.match(styles, /\.help-ayah-glyph\s*\{[\s\S]*z-index:\s*2/);
  assert.match(styles, /\.help-ayah-glyph\s*\{[\s\S]*top:\s*-8px/);
  assert.match(styles, /\.help-ayah-glyph\.ayah-marker\.ayah-mark[\s\S]*background:\s*transparent/);
  assert.match(styles, /\.help-ayah-glyph\.ayah-marker\.ayah-mark[\s\S]*--transition-underline-gap:\s*-\[?\.22em/);
  assert.match(styles, /\.help-ayah-glyph\.ayah-marker\.ayah-mark[\s\S]*font-size:\s*2\.55rem/);
  assert.match(styles, /\.help-ayah-glyph\.ayah-marker\.ayah-mark[\s\S]*filter:\s*saturate\(1\.35\) brightness\(1\.18\)/);
  assert.match(styles, /\.help-ayah-glyph\.ayah-marker\.ayah-mark[\s\S]*text-shadow:\s*0 0 12px/);
  assert.match(styles, /\.help-hand-tap[\s\S]*z-index:\s*1/);
  assert.match(styles, /\.help-hand-tap[\s\S]*bottom:\s*-12px/);
  assert.match(styles, /\.help-plus-pop\.transition\s*\{[\s\S]*top:\s*24px/);
  assert.match(styles, /@keyframes help-single-label/);
  assert.match(styles, /@keyframes help-double-label/);
  assert.match(styles, /@keyframes help-hand-tap/);
  assert.match(styles, /@keyframes help-hand-ripple/);
  assert.match(styles, /@keyframes help-ayah-demo-tap/);
  assert.match(styles, /@keyframes help-transition-track-demo/);
  assert.match(styles, /@keyframes help-transition-demo/);
  assert.match(styles, /@keyframes help-ayah-plus-pop/);
  assert.match(styles, /@keyframes help-transition-plus-pop/);
  assert.match(styles, /15%,\s*62%,\s*66%\s*\{[\s\S]*translateX\(-50%\) translateY\(-22px\) scale\(\.88\)/);
});

test("inspect details help visual demonstrates long press", () => {
  assert.match(appSource, /class="help-long-press-demo"/);
  assert.match(appSource, /class="help-ayah-demo help-detail-marker-wrap"/);
  assert.match(appSource, /class="ayah-marker ayah-mark building transition-count-building help-ayah-glyph help-detail-glyph"/);
  assert.match(appSource, /class="help-long-press-ring"/);
  assert.match(appSource, /class="help-hand-tap help-long-press-hand"/);
  assert.match(appSource, /class="help-detail-card"/);
  assert.match(styles, /\.help-long-press-demo/);
  assert.match(styles, /\.help-detail-marker-wrap\s*\{[\s\S]*height:\s*112px/);
  assert.match(styles, /\.help-detail-glyph\s*\{[\s\S]*animation:\s*none/);
  assert.match(styles, /\.help-detail-glyph::before,\s*\.help-detail-glyph::after\s*\{[\s\S]*animation:\s*none/);
  assert.match(styles, /\.help-detail-glyph::before,\s*\.help-detail-glyph::after\s*\{[\s\S]*transform:\s*none/);
  assert.match(styles, /\.help-long-press-ring/);
  assert.match(styles, /\.help-long-press-ring\s*\{[\s\S]*top:\s*calc\(50% - 8px\)/);
  assert.match(styles, /\.help-long-press-hand/);
  assert.match(styles, /\.help-long-press-hand\s*\{[\s\S]*bottom:\s*-12px/);
  assert.match(styles, /\.help-detail-card/);
  assert.match(styles, /@keyframes help-long-press-hand/);
  assert.match(styles, /@keyframes help-long-press-ring/);
  assert.doesNotMatch(styles, /@keyframes help-long-press-marker/);
  assert.match(styles, /@keyframes help-detail-card-reveal/);
  assert.match(styles, /22%,\s*52%\s*\{[\s\S]*translateX\(-50%\) translateY\(-22px\) scale\(\.88\)/);
});

test("opening help marks the first-time guide as seen", () => {
  assert.match(appSource, /async function openHelp\(\)\s*\{[\s\S]*?helpOpen = true;[\s\S]*?state\.helpSeen = true;[\s\S]*?await saveState\(\);/);
});

test("help button pulse and modal styles are defined", () => {
  assert.match(styles, /\.help-btn\.first-run-pulse::after/);
  assert.match(styles, /\.help-btn\.first-run-pulse::after\s*\{[\s\S]*border-radius:\s*50%/);
  assert.match(styles, /\.help-btn\.first-run-pulse::after\s*\{[\s\S]*transform:\s*translate\(-50%,\s*-50%\) scale\(\.92\)/);
  assert.match(styles, /@keyframes help-pulse/);
  assert.match(styles, /\.help-modal/);
  assert.match(styles, /\.help-slide/);
  assert.match(styles, /\.help-progress/);
});

test("help modal is vertically centered", () => {
  assert.match(styles, /\.modal-backdrop:has\(\.help-modal\)\s*\{[\s\S]*place-items:\s*center/);
});

test("help pulse respects reduced motion", () => {
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.help-btn\.first-run-pulse::after[\s\S]*animation:\s*none/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.help-hand-tap,\s*\.help-hand-tap::after[\s\S]*animation:\s*none/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.help-tap-label\.single,[\s\S]*\.help-plus-pop\.transition[\s\S]*animation:\s*none/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.help-ayah-glyph::before,[\s\S]*\.help-ayah-glyph::after[\s\S]*animation:\s*none/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.help-long-press-ring,[\s\S]*\.help-detail-card[\s\S]*animation:\s*none/);
});
