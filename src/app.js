import { JUZ_RANGES } from "./data/juz.js";
import { describeDetailTarget } from "./data/detail-logic.js";
import {
  buildWeakItems,
  getPageStrength,
  getStrengthClass,
  resolveActiveTarget
} from "./data/metadata-logic.js";
import {
  buildAyahAriaLabel,
  buildAyahRingState
} from "./data/reader-halo-logic.js";
import { resolveNavigationTarget } from "./data/navigation-logic.js";
import {
  loadPersistedState,
  mergeStoredState,
  savePersistedState
} from "./data/storage.js?v=2";
import { shouldRegisterServiceWorker } from "./data/runtime-environment.js";
import {
  buildTrackPages,
  clampTrackOffset,
  getTrackDirection,
  getTrackTargetPage,
  shouldCommitTrackMove
} from "./reader/swipe-reveal.js?v=2026-06-22-page-turn-fill";

const PAGE_COUNT = 604;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const app = document.querySelector("#app");
const setBootStatus = (label) => {
  if (!app) return;
  app.innerHTML = `
    <main class="app-shell home-shell">
      <div class="detail-card">
        <div class="detail-title"><span>Starting Tap Hifz</span></div>
        <p class="empty-state">${escapeHtml(label)}</p>
      </div>
    </main>
  `;
};
const cloneValue = globalThis.structuredClone
  ? (value) => globalThis.structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

const defaultThresholds = {
  weakMax: 9,
  buildingMax: 19,
  strongMax: 39
};

const defaultState = {
  ayahProgress: {},
  transitionProgress: {},
  recentPages: [],
  ayahBookmarks: [],
  pageBookmarks: [],
  practiceEvents: [],
  settings: {
    theme: "dark",
    sound: false,
    vibration: "auto",
    reviewQueueSize: 12,
    doubleTapWindow: 250,
    ayahThresholds: { ...defaultThresholds },
    transitionThresholds: { ...defaultThresholds }
  }
};

let state = cloneValue(defaultState);
let route = { screen: "home", tab: "progress", page: 1, target: null };
let trackPages = {
  previous: null,
  current: null,
  next: null
};
let metadata = null;
let selectedJuz = 1;
let pendingTap = null;
let undoVisible = false;
let detailTarget = null;
let settingsOpen = false;
let review = null;
let swipeStart = null;
let suppressClickUntil = 0;
let pageNavigationInFlight = false;
let trackState = {
  direction: null,
  dragging: false,
  offset: 0
};
let pageCache = new Map();
let surahVerseCounts = new Map();

const SWIPE_COMMIT_DISTANCE = 60;
const SWIPE_CANCEL_VERTICAL_LIMIT = 70;
const SWIPE_DRAG_START = 8;
const PAGE_TURN_DURATION = 220;
const PAGE_TURN_EASING = "cubic-bezier(.2, .8, .2, 1)";
const TRACK_NEXT_TRANSFORM = "0%";
const TRACK_CURRENT_TRANSFORM = "-33.333333%";
const TRACK_PREVIOUS_TRANSFORM = "-66.666667%";

const icons = {
  back: `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`,
  settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M19 14.5a1.8 1.8 0 0 0 .4 2l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21a2 2 0 1 1-4 0v-.4a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1H3a2 2 0 1 1 0-4h.4a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7V3a2 2 0 1 1 4 0v.4a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1H21a2 2 0 1 1 0 4h-.4a1.8 1.8 0 0 0-1.6 1Z"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  undo: `<svg viewBox="0 0 24 24"><path d="M9 7H4v5"/><path d="M20 17a7 7 0 0 0-11.9-5L4 16"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="m18 6-12 12M6 6l12 12"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>`,
  export: `<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`
};

init().catch(showFatalError);

async function init() {
  setBootStatus("Loading saved state...");
  state = await loadState();
  setBootStatus("Loading metadata...");
  document.documentElement.dataset.theme = state.settings.theme;
  const [mushafData, navigationData] = await Promise.all([
    fetchJson("/src/data/mushaf-metadata.json"),
    fetchJson("/src/data/navigation-metadata.json")
  ]);
  setBootStatus("Loading first page...");
  metadata = {
    ...mushafData,
    surahs: navigationData.surahs,
    juz: navigationData.juz
  };
  surahVerseCounts = buildSurahVerseCounts(metadata.pages);
  const initialTrack = await loadTrackPages(1);
  trackPages = initialTrack.data;
  setBootStatus("Binding events...");
  bindGlobalEvents();
  setBootStatus("Rendering...");
  render();
  if ("serviceWorker" in navigator && shouldRegisterServiceWorker(globalThis.location?.hostname || "")) {
    navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => {});
  }
}

async function loadState() {
  return loadPersistedState(defaultState);
}

async function saveState() {
  await savePersistedState(state);
}

async function fetchPage(page) {
  const padded = String(page).padStart(3, "0");
  const response = await fetch(`/public/mushaf/page-${padded}.json`);
  if (!response.ok) throw new Error(`Missing mushaf page ${page}`);
  return response.json();
}

async function getPageData(page) {
  if (!page) return null;
  if (pageCache.has(page)) return pageCache.get(page);
  const data = await fetchPage(page);
  pageCache.set(page, data);
  return data;
}

async function loadTrackPages(currentPage) {
  const pages = buildTrackPages({ currentPage, pageCount: PAGE_COUNT });
  const [previous, current, next] = await Promise.all([
    pages.previous ? getPageData(pages.previous).catch(() => null) : Promise.resolve(null),
    getPageData(pages.current),
    pages.next ? getPageData(pages.next).catch(() => null) : Promise.resolve(null)
  ]);
  return {
    numbers: pages,
    data: { previous, current, next }
  };
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Missing JSON resource ${path}`);
  return response.json();
}

async function openPage(page, options = {}) {
  route = { screen: "reading", tab: route.tab, page: clampPage(page), target: options.target || null };
  const nextTrack = await loadTrackPages(route.page);
  trackPages = nextTrack.data;
  trackState = { direction: null, dragging: false, offset: 0 };
  if (!options.silent) {
    state.recentPages = [route.page, ...state.recentPages.filter((item) => item !== route.page)].slice(0, 20);
    await saveState();
  }
  render();
}

function goHome(tab = route.tab || "progress") {
  route = { screen: "home", tab, page: route.page, target: null };
  render();
}

function render() {
  document.documentElement.dataset.theme = state.settings.theme;
  app.innerHTML = route.screen === "reading" ? renderReading() : renderHome();
  if (settingsOpen) app.insertAdjacentHTML("beforeend", renderSettings());
  if (detailTarget) app.insertAdjacentHTML("beforeend", renderDetails());
  bindScreenEvents();
}

function renderHome() {
  return `
    <main class="app-shell home-shell">
      <header class="topbar">
        <div>
          <h1>Tap Hifz</h1>
          <p>${summaryLine()}</p>
        </div>
        <button class="icon-btn" data-action="settings" aria-label="Settings">${icons.settings}</button>
      </header>
      <label class="search-box">
        ${icons.search}
        <input id="jumpInput" type="search" placeholder="Page 48, Al-Baqarah, Juz 3" autocomplete="off" />
      </label>
      <nav class="tabs" aria-label="Home sections">
        ${["progress", "surahs", "bookmarks"].map((tab) => `
          <button class="${route.tab === tab ? "active" : ""}" data-tab="${tab}">${titleCase(tab)}</button>
        `).join("")}
      </nav>
      <section class="home-panel">
        ${route.tab === "progress" ? renderProgress() : ""}
        ${route.tab === "surahs" ? renderSurahs() : ""}
        ${route.tab === "bookmarks" ? renderBookmarks() : ""}
      </section>
    </main>
  `;
}

function renderProgress() {
  const strip = JUZ_RANGES.map(([number, start, end]) => `<span class="mushaf-strip-segment ${rangeStrength(start, end)}" aria-hidden="true" title="Juz ${number}"></span>`).join("");
  const juzItems = JUZ_RANGES.map(([number, start, end]) => {
    const strength = rangeStrength(start, end);
    return `<button class="juz-cell ${strength} ${number === selectedJuz ? "selected" : ""}" data-juz="${number}" aria-label="Juz ${number}">${number}</button>`;
  }).join("");
  const current = JUZ_RANGES.find(([number]) => number === selectedJuz);
  const pages = [];
  for (let page = current[1]; page <= current[2]; page += 1) {
    pages.push(`<button class="page-cell ${pageStrength(page)}" data-page="${page}">${page}</button>`);
  }
  const weakItems = getWeakItems().slice(0, state.settings.reviewQueueSize);
  return `
    <div class="section-head">
      <div><h2>Whole Mushaf By Juz</h2><p>${progressPrompt()}</p></div>
      <button class="primary-btn ${weakItems.length ? "" : "quiet"}" data-action="start-review" ${weakItems.length ? "" : "disabled"}>
        ${weakItems.length ? "Start weak review" : "No weak items to review"}
      </button>
    </div>
    <div class="progress-card">
      <div class="mushaf-strip" aria-hidden="true">${strip}</div>
      <div class="section-caption mushaf-strip-label">Juz</div>
      <div class="juz-grid" dir="rtl">${juzItems}</div>
      <div class="selected-head">
        <strong class="section-caption">Page</strong>
        <span class="summary-pills"><span class="small-pill weak">${countPages(current, "weak")} weak</span><span class="small-pill strong">${countStrongPages(current)} strong</span></span>
      </div>
      <div class="page-grid" dir="rtl">${pages.join("")}</div>
    </div>
    <h3 class="label">Practice Next</h3>
    <div class="queue-list">
      ${weakItems.length ? weakItems.map(renderQueueItem).join("") : `<p class="empty-state">Open a page and tap ayah numbers to start tracking.</p>`}
    </div>
  `;
}

function renderQueueItem(item) {
  return `
    <button class="list-row" data-review-target="${encodeURIComponent(JSON.stringify(item))}">
      <span><strong>${item.label}</strong><small>Page ${item.page}, count ${item.count}</small></span>
      <span class="type-pill">${item.kind}</span>
    </button>
  `;
}

function renderSurahs() {
  const entries = [
    ...metadata.surahs.map((surah) => ({
      kind: "surah",
      number: surah.number,
      page: surah.startPage,
      title: surah.transliteratedName || surah.englishName || `Surah ${surah.number}`,
      sub: surah.englishName || buildSurahSubtitle(surah)
    })),
    ...metadata.juz.map((juz) => ({ kind: "juz", number: juz.number, page: juz.startPage, title: `Juz ${juz.number}` }))
  ].sort((a, b) => a.page - b.page || (a.kind === "juz" ? -1 : 1));
  return `
    <div class="queue-list">
      ${entries.map((entry) => entry.kind === "juz" ? `
        <button class="list-row list-row-juz" data-page="${entry.page}">
          <strong>${entry.title}</strong>
        </button>
      ` : `
        <button class="list-row list-row-surah" data-page="${entry.page}">
          <span class="surah-row-number">${entry.number}</span>
          <span class="surah-row-copy">
            <strong>${entry.title}</strong>
            <small>${entry.sub}</small>
          </span>
          <span class="surah-row-page" aria-label="Page ${entry.page}">${entry.page}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function buildSurahVerseCounts(pages) {
  const counts = new Map();

  for (const pageData of Object.values(pages || {})) {
    for (const line of pageData.lines || []) {
      if (!line.verseRange) continue;
      const [start, end] = line.verseRange.split("-");
      const [startSurah, startAyah] = start.split(":").map(Number);
      const [endSurah, endAyah] = end.split(":").map(Number);
      updateSurahVerseCount(counts, startSurah, startAyah);
      updateSurahVerseCount(counts, endSurah, endAyah);
    }
  }

  return counts;
}

function updateSurahVerseCount(counts, surahNumber, ayahNumber) {
  if (!Number.isFinite(surahNumber) || !Number.isFinite(ayahNumber)) return;
  counts.set(surahNumber, Math.max(counts.get(surahNumber) || 0, ayahNumber));
}

function buildSurahSubtitle(surah) {
  const parts = [];
  if (surah.transliteratedName) parts.push(surah.transliteratedName);
  const verseCount = surahVerseCounts.get(surah.number);
  if (verseCount) parts.push(formatVerseLabel(verseCount));
  return parts.join(" - ");
}

function formatVerseLabel(count) {
  return `${count} ${count === 1 ? "verse" : "verses"}`;
}

function renderBookmarks() {
  return `
    <h2>Bookmarks</h2>
    <h3 class="label">Recent Pages</h3>
    <div class="quick-pages">
      ${state.recentPages.length ? state.recentPages.map((page) => `<button class="page-chip" data-page="${page}">${page}<small>${metadata.pages[String(page)]?.label || ""}</small></button>`).join("") : `<p class="empty-state">Pages you open will appear here.</p>`}
    </div>
    <h3 class="label">Page Bookmarks</h3>
    <div class="queue-list">
      ${state.pageBookmarks.length ? [...state.pageBookmarks].sort((a, b) => a - b).map((page) => `
        <div class="list-row static"><button data-page="${page}"><strong>Page ${page}</strong><small>${metadata.pages[String(page)]?.label || ""}</small></button><button class="icon-btn small" data-remove-page-bookmark="${page}" aria-label="Remove page bookmark">${icons.trash}</button></div>
      `).join("") : `<p class="empty-state">No page bookmarks yet.</p>`}
    </div>
    <h3 class="label">Ayah Bookmarks</h3>
    <div class="queue-list">
      ${state.ayahBookmarks.length ? state.ayahBookmarks.map((item) => `
        <div class="list-row static"><button data-page="${item.page}" data-target="${item.key}"><strong>${labelAyah(item.key)}</strong><small>Page ${item.page}</small></button><button class="icon-btn small" data-remove-ayah-bookmark="${item.key}" aria-label="Remove ayah bookmark">${icons.trash}</button></div>
      `).join("") : `<p class="empty-state">No ayah bookmarks yet.</p>`}
    </div>
  `;
}

function renderReading() {
  const pageNumbers = buildTrackPages({ currentPage: route.page, pageCount: PAGE_COUNT });
  const pageBookmarked = state.pageBookmarks.includes(route.page);
  const activeTarget = resolveReaderTarget();
  return `
    <main class="app-shell reader-shell">
      <header class="reading-top">
        <button class="icon-btn" data-action="home" aria-label="Back">${icons.back}</button>
        <div class="reading-meta">${review ? `Review · ${review.index + 1} of ${review.queue.length}` : `Page ${route.page} · ${metadata.pages[String(route.page)]?.label || ""}`}</div>
        <div class="top-actions">
          <button class="icon-btn ${pageBookmarked ? "active" : ""}" data-action="toggle-page-bookmark" aria-label="Toggle page bookmark">${icons.bookmark}</button>
          <button class="icon-btn" data-action="settings" aria-label="Settings">${icons.settings}</button>
        </div>
      </header>
      <button class="sr-only" data-action="previous-page">Previous page</button>
      <button class="sr-only" data-action="next-page">Next page</button>
      <section class="page-shell ${route.page % 2 ? "odd" : "even"}" aria-label="Mushaf page ${route.page}">
        <div class="page-track" data-track-direction="${trackState.direction || ""}">
          ${renderPageSlot(trackPages.next, pageNumbers.next, "next", true)}
          ${renderPageSlot(trackPages.current, route.page, "current", false, activeTarget)}
          ${renderPageSlot(trackPages.previous, pageNumbers.previous, "previous", true)}
        </div>
      </section>
      <p class="swipe-hint">Swipe left for previous page. Swipe right for next page.</p>
      ${undoVisible ? `<button class="floating-undo" data-action="undo" aria-label="Undo last count">${icons.undo}</button>` : ""}
      ${review ? renderReviewBar() : ""}
    </main>
  `;
}

function renderPageSlot(pageData, pageNumber, slotName, inert = false, activeTarget = null) {
  if (!pageNumber || !pageData) {
    return `<div class="page-slot ${slotName} empty" aria-hidden="true"></div>`;
  }
  const previousAyahMap = buildPreviousAyahMap(pageData);
  const lines = pageData.lines.map((line) => renderLine(line, activeTarget, { inert, pageNumber, previousAyahMap })).join("");
  const parity = pageNumber % 2 ? "odd" : "even";
  return `
    <div class="page-slot ${slotName} ${parity}" ${inert ? 'aria-hidden="true"' : ""}>
      <div class="mushaf" dir="rtl">${lines}</div>
    </div>
  `;
}

function renderLine(line, activeTarget, options = {}) {
  if (line.type === "surah-header") return `<div class="surah-header">${decodeText(line.text)}</div>`;
  if (line.type === "basmala") return `<div class="basmala">${decodeText(line.text || line.qpcV2 || "")}</div>`;
  const words = line.words || [];
  const fit = words.length > 13 ? "fit-72" : words.length > 11 ? "fit-78" : words.length > 9 ? "fit-84" : words.length > 7 ? "fit-89" : words.length > 6 ? "fit-93" : "";
  const parts = words.map((word) => renderWord(word, activeTarget, options)).join("");
  const unjustify = (options.pageNumber || route.page) <= 2 ? "unjustified" : "";
  return `<div class="mushaf-line ${fit} ${unjustify} ${words.length <= 3 ? "short" : ""}">${parts}</div>`;
}

function renderWord(word, activeTarget, options = {}) {
  const text = decodeText(word.word);
  const [surah, ayah] = word.location.split(":").map(Number);
  const match = text.match(/^(.*?)(?:\s+)?([٠-٩]+)$/);
  if (!match) return `<span class="qword">${escapeHtml(text)}</span>`;
  const key = `${surah}:${ayah}`;
  const previous = options.previousAyahMap?.get(key) || null;
  const pageNumber = options.pageNumber || route.page;
  const transition = previous ? transitionKey(pageNumber, previous, key) : null;
  const ringState = buildAyahRingState({
    ayahCount: getAyahCount(key),
    transitionCount: transition ? getTransitionCount(transition) : null,
    ayahThresholds: state.settings.ayahThresholds,
    transitionThresholds: state.settings.transitionThresholds
  });
  const ayahActive = activeTarget?.kind === "Ayah" && activeTarget.key === key;
  const transitionActive = activeTarget?.kind === "Transition" && activeTarget.key === transition;
  const ayahClass = [
    "ayah-mark",
    ringState.ayahStrength,
    ringState.hasTransitionRing ? `transition-${ringState.transitionStrength}` : "",
    transitionActive ? "transition-target" : "",
    ayahActive ? "target" : ""
  ].filter(Boolean).join(" ");
  if (options.inert) {
    return `
      <span class="qword">${escapeHtml(match[1])}</span>
      <span class="${ayahClass}" aria-hidden="true">${match[2]}</span>
    `;
  }
  const ariaLabel = buildAyahAriaLabel({
    ayahLabel: labelAyah(key),
    ayahStrength: ringState.ayahStrength,
    transitionStrength: ringState.transitionStrength
  });
  return `
    <span class="qword">${escapeHtml(match[1])}</span>
    <button class="${ayahClass}" data-ayah="${key}" data-page="${pageNumber}" aria-label="${ariaLabel}">${match[2]}</button>
  `;
}

function renderReviewBar() {
  const item = review.queue[review.index];
  if (review.done) {
    return `<div class="review-bar"><strong>Review complete</strong><span>${review.completed} reviewed · ${review.skipped} skipped</span><button class="secondary-btn" data-action="finish-review">Done</button></div>`;
  }
  return `
    <div class="review-bar">
      <button class="secondary-btn" data-action="skip-review">Skip</button>
      <span>${item.kind}: ${item.label}${item.completed ? " completed" : ""}</span>
      <button class="primary-btn" data-action="next-review" ${item.completed ? "" : "disabled"}>Next</button>
    </div>
  `;
}

function renderDetails() {
  const detail = describeDetailTarget(detailTarget, {
    settings: state.settings,
    getAyahCount,
    getTransitionCount,
    labelAyah,
    labelTransition,
    isAyahBookmarked: (key) => state.ayahBookmarks.some((item) => item.key === key),
    resolveIncomingTransition
  });

  if (detail.mode === "transition") {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${detail.title}">
          <header class="modal-head">
            <strong>${detail.title}</strong>
            <button class="icon-btn small" data-action="close-modal" aria-label="Close">${icons.close}</button>
          </header>
          <div class="detail-panel">
            <div class="detail-block">
              <div class="detail-block-head">
                <span class="detail-metric-label">${detail.transitionOnly.label}</span>
                <span class="small-pill ${detail.transitionOnly.strength}">${titleCase(detail.transitionOnly.strength)}</span>
              </div>
              ${renderCountValue(detail.transitionOnly.count, detail.transitionOnly.target)}
              <button class="detail-mini-action secondary-btn" data-action="decrement-detail" aria-label="Decrease transition count">-</button>
            </div>
            <button class="danger-btn full" data-action="reset-detail">Reset</button>
          </div>
        </section>
      </div>
    `;
  }

  const transitionMarkup = detail.transition.available
    ? `
      <div class="detail-transition-row">
        <div class="detail-transition-copy">
          <div class="detail-transition-head">
            <strong>${detail.transition.path}</strong>
            <span class="small-pill ${detail.transition.strength}">${titleCase(detail.transition.strength)}</span>
          </div>
          <div class="detail-metric-label">${detail.transition.label}</div>
          ${renderCountValue(detail.transition.count, detail.transition.target)}
        </div>
        <button class="detail-mini-action secondary-btn" data-action="decrement-transition-detail" aria-label="Decrease transition count">-</button>
      </div>
    `
    : `
      <div class="detail-transition-row detail-transition-row-empty">
        <div class="detail-transition-copy">
          <div class="detail-metric-label">${detail.transition.label}</div>
          <p class="detail-empty-copy">${detail.transition.message}</p>
        </div>
      </div>
    `;

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal detail-modal" role="dialog" aria-modal="true" aria-label="${detail.title}">
        <header class="modal-head">
          <strong>${detail.title}</strong>
          <div class="detail-head-actions">
            <button class="icon-btn small ${detail.bookmarked ? "active" : ""}" data-action="toggle-ayah-bookmark" aria-label="${detail.headerBookmarkLabel}">${icons.bookmark}</button>
            <button class="icon-btn small" data-action="close-modal" aria-label="Close">${icons.close}</button>
          </div>
        </header>
        <div class="detail-panel">
          <div class="detail-block">
            <div class="detail-block-head">
              <span class="detail-metric-label">${detail.ayah.label}</span>
              <span class="small-pill ${detail.ayah.strength}">${titleCase(detail.ayah.strength)}</span>
            </div>
            ${renderCountValue(detail.ayah.count, detail.ayah.target)}
            <button class="detail-mini-action secondary-btn" data-action="decrement-ayah-detail" aria-label="Decrease ayah count">-</button>
          </div>
          ${transitionMarkup}
          <button class="danger-btn full" data-action="reset-detail">Reset</button>
        </div>
      </section>
    </div>
  `;
}

function renderSettings() {
  const s = state.settings;
  return `
    <div class="modal-backdrop" data-action="close-settings">
      <section class="modal settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <header class="modal-head"><strong>Settings</strong><button class="icon-btn small" data-action="close-settings" aria-label="Close">${icons.close}</button></header>
        <h3 class="label">Appearance</h3>
        <div class="setting-row"><span>Dark mode<small>Default on</small></span><button class="toggle ${s.theme === "dark" ? "on" : ""}" data-setting="theme" role="switch" aria-checked="${s.theme === "dark"}"></button></div>
        <h3 class="label">Feedback</h3>
        <div class="setting-row"><span>Sound<small>Default off</small></span><button class="toggle ${s.sound ? "on" : ""}" data-setting="sound" role="switch" aria-checked="${s.sound}"></button></div>
        <div class="setting-row"><span>Vibration<small>Default on when supported</small></span><button class="toggle ${s.vibration !== false ? "on" : ""}" data-setting="vibration" role="switch" aria-checked="${s.vibration !== false}"></button></div>
        <label class="setting-row"><span>Double tap window<small>Gesture timing</small></span><input data-setting-number="doubleTapWindow" type="number" min="150" max="600" step="25" value="${s.doubleTapWindow}" /></label>
        <label class="setting-row"><span>Review queue size<small>Weak items per session</small></span><input data-setting-number="reviewQueueSize" type="number" min="4" max="30" step="1" value="${s.reviewQueueSize}" /></label>
        <h3 class="label">Backup</h3>
        <div class="actions"><button class="secondary-btn" data-action="export-json">${icons.export} Export JSON</button><label class="secondary-btn file-btn">Import JSON<input type="file" accept="application/json" data-action="import-json" /></label></div>
        <button class="danger-btn full" data-action="reset-all">Reset all data</button>
      </section>
    </div>
  `;
}

function bindGlobalEvents() {
  window.addEventListener("keydown", (event) => {
    if (route.screen !== "reading") return;
    if (event.key === "ArrowLeft") moveTrack("next");
    if (event.key === "ArrowRight") moveTrack("previous");
  });
}

function bindScreenEvents() {
  app.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => goHome(button.dataset.tab)));
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => openPage(Number(button.dataset.page), { target: button.dataset.target || null })));
  app.querySelectorAll("[data-juz]").forEach((button) => button.addEventListener("click", () => { selectedJuz = Number(button.dataset.juz); render(); }));
  app.querySelectorAll("[data-review-target]").forEach((button) => button.addEventListener("click", () => {
    const item = JSON.parse(decodeURIComponent(button.dataset.reviewTarget));
    openPage(item.page, { target: item.key });
  }));
  app.querySelectorAll("[data-remove-page-bookmark]").forEach((button) => button.addEventListener("click", () => removePageBookmark(Number(button.dataset.removePageBookmark))));
  app.querySelectorAll("[data-remove-ayah-bookmark]").forEach((button) => button.addEventListener("click", () => removeAyahBookmark(button.dataset.removeAyahBookmark)));

  app.querySelectorAll(".page-slot.current button.ayah-mark[data-ayah]").forEach((button) => {
    button.addEventListener("click", () => handleAyahTap(button.dataset.ayah));
    bindLongPress(button, () => { detailTarget = { kind: "ayah", key: button.dataset.ayah, page: Number(button.dataset.page) }; render(); });
  });

  app.querySelectorAll(".page-slot.current button.transition-mark[data-transition]").forEach((button) => {
    bindLongPress(button, () => {
      detailTarget = { kind: "transition", key: button.dataset.transition, page: Number(button.dataset.page) };
      render();
    });
  });

  const pageShell = app.querySelector(".page-shell");
  const pageTrack = app.querySelector(".page-track");
  if (pageShell && pageTrack) {
    pageShell.addEventListener("click", (event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    pageShell.addEventListener("pointerdown", (event) => {
      if (pageNavigationInFlight) return;
      swipeStart = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        offset: 0,
        dragging: false
      };
      trackState = { direction: null, dragging: false, offset: 0 };
      pageShell.setPointerCapture?.(event.pointerId);
    });
    pageShell.addEventListener("pointermove", async (event) => {
      if (!swipeStart || pageNavigationInFlight) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      const direction = getTrackDirection({ dx, dy, startThreshold: SWIPE_DRAG_START });
      if (!direction) return;
      const targetPage = getTrackTargetPage({ currentPage: route.page, direction, pageCount: PAGE_COUNT });
      if (!targetPage) return;
      swipeStart.dragging = true;
      swipeStart.offset = clampTrackOffset(dx, { maxOffset: pageShell.clientWidth, dragRatio: 1 });
      trackState = { direction, dragging: true, offset: swipeStart.offset };
      applyTrackState();
      event.preventDefault();
    });
    pageShell.addEventListener("pointerup", (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = Math.abs(event.clientY - swipeStart.y);
      const dragOffset = swipeStart.offset || 0;
      const didDrag = swipeStart.dragging;
      swipeStart = null;
      pageShell.releasePointerCapture?.(event.pointerId);
      if (didDrag) suppressClickUntil = Date.now() + 350;
      if (trackState.direction && shouldCommitTrackMove({ dx, dy, commitDistance: SWIPE_COMMIT_DISTANCE, verticalLimit: SWIPE_CANCEL_VERTICAL_LIMIT })) {
        moveTrack(trackState.direction, { dragOffset });
        return;
      }
      resetTrackState(true);
    });
    pageShell.addEventListener("pointercancel", () => {
      swipeStart = null;
      resetTrackState(true);
    });
  }

  app.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (event) => handleAction(event, el));
    if (el.matches("input[type=file]")) el.addEventListener("change", (event) => importJson(event.target.files[0]));
  });

  app.querySelectorAll("[data-setting]").forEach((button) => button.addEventListener("click", async () => {
    const key = button.dataset.setting;
    if (key === "theme") state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    if (key === "sound") state.settings.sound = !state.settings.sound;
    if (key === "vibration") state.settings.vibration = state.settings.vibration === false ? "auto" : false;
    await saveState();
    render();
  }));
  app.querySelectorAll("[data-setting-number]").forEach((input) => input.addEventListener("change", async () => {
    state.settings[input.dataset.settingNumber] = Number(input.value);
    await saveState();
    render();
  }));

  const jump = app.querySelector("#jumpInput");
  if (jump) {
    jump.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const target = parseJump(jump.value);
      if (target) openPage(target);
    });
  }
}

async function handleAction(event, el) {
  const action = el.dataset.action;
  if (!action || action === "import-json") return;
  event.stopPropagation();
  if (action === "settings") settingsOpen = true;
  if (action === "close-settings") settingsOpen = false;
  if (action === "close-modal") detailTarget = null;
  if (action === "home") goHome();
  if (action === "previous-page") moveTrack("previous");
  if (action === "next-page") moveTrack("next");
  if (action === "toggle-page-bookmark") togglePageBookmark();
  if (action === "undo") undoLast();
  if (action === "decrement-detail") mutateDetail(-1);
  if (action === "decrement-ayah-detail") mutateSpecificDetail("ayah", -1);
  if (action === "decrement-transition-detail") mutateSpecificDetail("transition", -1);
  if (action === "reset-detail") resetDetail();
  if (action === "toggle-ayah-bookmark") toggleAyahBookmark();
  if (action === "start-review") startReview();
  if (action === "skip-review") skipReview();
  if (action === "next-review") nextReview();
  if (action === "finish-review") { review = null; goHome("progress"); return; }
  if (action === "export-json") exportJson();
  if (action === "reset-all") resetAll();
  if (!["previous-page", "next-page", "decrement-ayah-detail", "decrement-transition-detail"].includes(action)) render();
}

async function moveTrack(direction, options = {}) {
  if (pageNavigationInFlight) return;
  const targetPage = getTrackTargetPage({ currentPage: route.page, direction, pageCount: PAGE_COUNT });
  const pageTrack = app.querySelector(".page-track");
  if (!targetPage) {
    pageTrack?.animate(
      [
        { transform: `translateX(${TRACK_CURRENT_TRANSFORM})` },
        { transform: `translateX(calc(${TRACK_CURRENT_TRANSFORM} + ${direction === "next" ? "12px" : "-12px"}))` },
        { transform: `translateX(${TRACK_CURRENT_TRANSFORM})` }
      ],
      { duration: 180 }
    );
    if (navigator.vibrate && state.settings.vibration !== false) navigator.vibrate(12);
    return;
  }

  pageNavigationInFlight = true;
  try {
    const slotShift = direction === "next" ? TRACK_NEXT_TRANSFORM : TRACK_PREVIOUS_TRANSFORM;
    const dragOffset = Number(options.dragOffset) || 0;
    trackState = { direction, dragging: false, offset: dragOffset };
    applyTrackState();
    if (pageTrack) {
      await pageTrack.animate(
        [
          { transform: `translateX(calc(${TRACK_CURRENT_TRANSFORM} + ${dragOffset}px))` },
          { transform: `translateX(${slotShift})` }
        ],
        { duration: PAGE_TURN_DURATION, easing: PAGE_TURN_EASING, fill: "forwards" }
      ).finished;
    }

    route = { screen: "reading", tab: route.tab, page: targetPage, target: null };
    const loaded = await loadTrackPages(targetPage);
    trackPages = loaded.data;
    trackState = { direction: null, dragging: false, offset: 0 };
    state.recentPages = [route.page, ...state.recentPages.filter((item) => item !== route.page)].slice(0, 20);
    await saveState();
    render();
    applyTrackState();
  } finally {
    pageNavigationInFlight = false;
  }
}

function handleAyahTap(key) {
  if (pendingTap?.key === key) {
    clearTimeout(pendingTap.timer);
    const previous = previousVisibleAyah(key);
    if (previous) {
      logTransition(transitionKey(route.page, previous, key));
    } else {
      unavailableFeedback(key);
    }
    pendingTap = null;
    return;
  }
  pendingTap = {
    key,
    timer: setTimeout(() => {
      logAyah(key);
      pendingTap = null;
    }, state.settings.doubleTapWindow)
  };
}

async function logAyah(key) {
  state.ayahProgress[key] = { repetitionCount: getAyahCount(key) + 1 };
  addEvent("ayah-increment", { ayahKey: key, delta: 1, page: route.page });
  markReviewComplete("Ayah", key);
  await postMutationFeedback(key);
}

async function logTransition(key) {
  state.transitionProgress[key] = { repetitionCount: getTransitionCount(key) + 1 };
  addEvent("transition-increment", { transitionKey: key, delta: 1, page: route.page });
  markReviewComplete("Transition", key);
  await postMutationFeedback(key);
}

async function postMutationFeedback(key) {
  undoVisible = true;
  await saveState();
  render();
  const selector = key.includes("|")
    ? `[data-ayah="${CSS.escape(key.split("|")[2])}"]`
    : `[data-ayah="${CSS.escape(key)}"]`;
  app.querySelector(selector)?.classList.add("pulse");
  if (navigator.vibrate && state.settings.vibration !== false) navigator.vibrate(20);
}

function addEvent(type, payload) {
  state.practiceEvents.push({ id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), ...payload });
}

async function undoLast() {
  const last = [...state.practiceEvents].reverse().find((event) => event.delta && !event.undone);
  if (!last) return;
  last.undone = true;
  if (last.ayahKey) state.ayahProgress[last.ayahKey] = { repetitionCount: Math.max(0, getAyahCount(last.ayahKey) - last.delta) };
  if (last.transitionKey) state.transitionProgress[last.transitionKey] = { repetitionCount: Math.max(0, getTransitionCount(last.transitionKey) - last.delta) };
  addEvent("undo", { page: route.page, reversedEventId: last.id, delta: -last.delta, ayahKey: last.ayahKey, transitionKey: last.transitionKey });
  undoVisible = false;
  await saveState();
  render();
}

function mutateDetail(delta) {
  if (!detailTarget) return;
  if (detailTarget.kind === "ayah") {
    state.ayahProgress[detailTarget.key] = { repetitionCount: Math.max(0, getAyahCount(detailTarget.key) + delta) };
    addEvent("decrement", { ayahKey: detailTarget.key, delta, page: route.page });
  } else {
    state.transitionProgress[detailTarget.key] = { repetitionCount: Math.max(0, getTransitionCount(detailTarget.key) + delta) };
    addEvent("decrement", { transitionKey: detailTarget.key, delta, page: route.page });
  }
  saveState();
}

async function mutateSpecificDetail(kind, delta) {
  if (!detailTarget) return;

  if (kind === "ayah" && detailTarget.kind === "ayah") {
    state.ayahProgress[detailTarget.key] = { repetitionCount: Math.max(0, getAyahCount(detailTarget.key) + delta) };
    addEvent("decrement", { ayahKey: detailTarget.key, delta, page: route.page });
    await saveState();
    render();
    return;
  }

  if (kind === "transition") {
    const target = detailTarget.kind === "transition"
      ? detailTarget.key
      : resolveIncomingTransition(detailTarget.key)?.key;
    if (!target) return;
    state.transitionProgress[target] = { repetitionCount: Math.max(0, getTransitionCount(target) + delta) };
    addEvent("decrement", { transitionKey: target, delta, page: route.page });
    await saveState();
    render();
  }
}

function resetDetail() {
  if (!detailTarget) return;
  if (detailTarget.kind === "ayah") {
    const ayahCount = getAyahCount(detailTarget.key);
    state.ayahProgress[detailTarget.key] = { repetitionCount: 0 };
    addEvent("reset", { ayahKey: detailTarget.key, delta: -ayahCount, page: route.page });
  } else {
    const count = getTransitionCount(detailTarget.key);
    state.transitionProgress[detailTarget.key] = { repetitionCount: 0 };
    addEvent("reset", { transitionKey: detailTarget.key, delta: -count, page: route.page });
  }
  saveState();
}

function togglePageBookmark() {
  const exists = state.pageBookmarks.includes(route.page);
  state.pageBookmarks = exists ? state.pageBookmarks.filter((page) => page !== route.page) : [...state.pageBookmarks, route.page];
  saveState();
}

function removePageBookmark(page) {
  state.pageBookmarks = state.pageBookmarks.filter((item) => item !== page);
  saveState();
  render();
}

function toggleAyahBookmark() {
  if (!detailTarget || detailTarget.kind !== "ayah") return;
  const exists = state.ayahBookmarks.some((item) => item.key === detailTarget.key);
  state.ayahBookmarks = exists
    ? state.ayahBookmarks.filter((item) => item.key !== detailTarget.key)
    : [...state.ayahBookmarks, { key: detailTarget.key, page: detailTarget.page || route.page }];
  saveState();
}

function removeAyahBookmark(key) {
  state.ayahBookmarks = state.ayahBookmarks.filter((item) => item.key !== key);
  saveState();
  render();
}

function startReview() {
  const queue = getWeakItems().slice(0, state.settings.reviewQueueSize);
  if (!queue.length) return;
  review = { queue, index: 0, completed: 0, skipped: 0, done: false };
  openPage(queue[0].page, { target: queue[0].key });
}

function markReviewComplete(kind, key) {
  if (!review || review.done) return;
  const item = review.queue[review.index];
  if (item.kind === kind && item.key === key && !item.completed) {
    item.completed = true;
    review.completed += 1;
  }
}

function skipReview() {
  if (!review) return;
  const [item] = review.queue.splice(review.index, 1);
  review.queue.push({ ...item, completed: false });
  review.skipped += 1;
  openPage(review.queue[review.index].page, { target: review.queue[review.index].key });
}

function nextReview() {
  if (!review) return;
  if (review.index >= review.queue.length - 1) {
    review.done = true;
    render();
    return;
  }
  review.index += 1;
  openPage(review.queue[review.index].page, { target: review.queue[review.index].key });
}

function getWeakItems() {
  return buildWeakItems({
    ayahProgress: state.ayahProgress,
    transitionProgress: state.transitionProgress,
    metadata,
    ayahThresholds: state.settings.ayahThresholds,
    transitionThresholds: state.settings.transitionThresholds,
    labelAyah,
    labelTransition
  });
}

function rangeStrength(start, end) {
  const levels = [];
  for (let page = start; page <= end; page += 1) levels.push(pageStrength(page));
  return weakest(levels);
}

function pageStrength(page) {
  return getPageStrength(page, metadata, state.ayahProgress, state.settings.ayahThresholds);
}

function countPages(range, target) {
  let count = 0;
  for (let page = range[1]; page <= range[2]; page += 1) if (pageStrength(page) === target) count += 1;
  return count;
}

function countStrongPages(range) {
  let count = 0;
  for (let page = range[1]; page <= range[2]; page += 1) if (["strong", "mastered"].includes(pageStrength(page))) count += 1;
  return count;
}

function weakest(levels) {
  const rank = { empty: 0, weak: 1, building: 2, strong: 3, mastered: 4 };
  return levels.sort((a, b) => rank[a] - rank[b])[0] || "empty";
}

function keysOnPage(page) {
  return metadata.pages[String(page)]?.ayahKeys || [];
}

function previousVisibleAyah(key) {
  const visible = visibleAyahKeys();
  const index = visible.indexOf(key);
  return index > 0 ? visible[index - 1] : null;
}

function visibleAyahKeys() {
  const keys = [];
  trackPages.current?.lines?.forEach((line) => {
    line.words?.forEach((word) => {
      const text = decodeText(word.word);
      if (/[٠-٩]+$/.test(text)) {
        const [surah, ayah] = word.location.split(":");
        keys.push(`${Number(surah)}:${Number(ayah)}`);
      }
    });
  });
  return [...new Set(keys)];
}

function visibleAyahKeysForPage(pageData) {
  const keys = [];
  pageData?.lines?.forEach((line) => {
    line.words?.forEach((word) => {
      const text = decodeText(word.word);
      if (/[Ù -Ù©]+$/.test(text)) {
        const [surah, ayah] = word.location.split(":");
        keys.push(`${Number(surah)}:${Number(ayah)}`);
      }
    });
  });
  return [...new Set(keys)];
}

function buildPreviousAyahMap(pageData) {
  const previousByKey = new Map();
  let previous = null;
  pageData?.lines?.forEach((line) => {
    line.words?.forEach((word) => {
      const text = decodeText(word.word);
      const [surah, ayah] = word.location.split(":").map(Number);
      if (!text.match(/^(.*?)(?:\s+)?([Ù -Ù©]+)$/)) return;
      const key = `${surah}:${ayah}`;
      if (previousByKey.has(key)) return;
      previousByKey.set(key, previous);
      previous = key;
    });
  });
  return previousByKey;
}

function applyTrackState() {
  const pageShell = app.querySelector(".page-shell");
  const pageTrack = app.querySelector(".page-track");
  if (!pageShell || !pageTrack) return;
  pageShell.classList.toggle("dragging", trackState.dragging);
  pageTrack.classList.toggle("dragging", trackState.dragging);
  pageTrack.dataset.trackDirection = trackState.direction || "";
  pageTrack.style.setProperty("--track-offset", trackState.direction ? `${trackState.offset}px` : "0px");
}

function resetTrackState(animateBack = false) {
  const pageTrack = app.querySelector(".page-track");
  const offset = trackState.offset;
  trackState = { direction: null, dragging: false, offset: 0 };
  if (animateBack && pageTrack && offset) {
    pageTrack.animate(
      [
        { transform: `translateX(calc(${TRACK_CURRENT_TRANSFORM} + ${offset}px))` },
        { transform: `translateX(${TRACK_CURRENT_TRANSFORM})` }
      ],
      { duration: 160, easing: PAGE_TURN_EASING }
    );
  }
  applyTrackState();
}

function getAyahCount(key) {
  return state.ayahProgress[key]?.repetitionCount || 0;
}

function getTransitionCount(key) {
  return state.transitionProgress[key]?.repetitionCount || 0;
}

function transitionKey(page, from, to) {
  return `${page}|${from}|${to}`;
}

function strengthClass(count, thresholds) {
  return getStrengthClass(count, thresholds);
}

function parseJump(value) {
  return resolveNavigationTarget(value, metadata, PAGE_COUNT)?.page || null;
}

function pageForAyah(key) {
  return metadata.ayahToPage[key] || route.page;
}

function progressPrompt() {
  return state.practiceEvents.length ? `${state.practiceEvents.length} practice events stored locally.` : "Open a page and tap ayah numbers to start tracking.";
}

function summaryLine() {
  const total = Object.values(state.ayahProgress).reduce((sum, item) => sum + item.repetitionCount, 0);
  return total ? `${total} ayah repetitions saved offline.` : "Local-first Quran memorization tracker.";
}

function labelAyah(key) {
  const [surah, ayah] = key.split(":");
  return `Surah ${surah}:${ayah}`;
}

function labelTransition(key) {
  const [, from, to] = key.split("|");
  return `${from} -> ${to}`;
}

function resolveIncomingTransition(ayahKey) {
  const page = pageForAyah(ayahKey);
  const ayahKeys = metadata.pages[String(page)]?.ayahKeys || [];
  const index = ayahKeys.indexOf(ayahKey);
  if (index <= 0) return null;
  const previous = ayahKeys[index - 1];
  const key = transitionKey(page, previous, ayahKey);
  return {
    key,
    path: labelTransition(key)
  };
}

function renderCountValue(count, target) {
  return `
    <div class="detail-metric-value-line">
      <strong class="detail-metric-value">${count}</strong>
      <span class="detail-metric-target">/${target}</span>
    </div>
  `;
}

function resolveReaderTarget() {
  return resolveActiveTarget({
    review,
    routeTarget: normalizeTarget(route.target)
  });
}

function normalizeTarget(target) {
  if (!target) return null;
  if (typeof target === "object" && target.kind && target.key) return target;
  if (typeof target !== "string") return null;
  return target.includes("|")
    ? { kind: "Transition", key: target }
    : { kind: "Ayah", key: target };
}

function titleCase(text) {
  return text[0].toUpperCase() + text.slice(1);
}

function decodeText(text = "") {
  return text;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function clampPage(page) {
  return Math.min(PAGE_COUNT, Math.max(1, page));
}

function bindLongPress(el, callback) {
  let timer = null;
  el.addEventListener("pointerdown", () => { timer = setTimeout(callback, 520); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((event) => el.addEventListener(event, () => clearTimeout(timer)));
}

function unavailableFeedback(key) {
  app.querySelector(`[data-ayah="${CSS.escape(key)}"]`)?.animate([{ transform: "translateX(0)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 140 });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `tap-hifz-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importJson(file) {
  if (!file) return;
  state = mergeStoredState(defaultState, JSON.parse(await file.text()));
  await saveState();
  settingsOpen = false;
  render();
}

function resetAll() {
  const ok = confirm("Reset all progress?\n\nThis will remove all repetition counts, practice history, recent pages, and bookmarks stored on this device. This cannot be undone.");
  if (!ok) return;
  state = cloneValue(defaultState);
  addEvent("reset-all", { page: route.page });
  saveState();
}

function showFatalError(error) {
  console.error(error);
  app.innerHTML = `
    <main class="app-shell home-shell">
      <div class="detail-card">
        <div class="detail-title"><span>Startup error</span></div>
        <pre class="fatal-error">${escapeHtml(error?.stack || error?.message || String(error))}</pre>
      </div>
    </main>
  `;
}
