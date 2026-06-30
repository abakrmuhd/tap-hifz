import { JUZ_RANGES } from "./data/juz.js";
import { describeDetailTarget } from "./data/detail-logic.js?v=2026-06-27-transition-underline";
import {
  buildLowCountItems,
  getPageCellProgressState,
  getPageRangeCellProgressState,
  getPageRepetitionLevel,
  resolveOutgoingTransition,
  resolveActiveTarget
} from "./data/metadata-logic.js?v=2026-06-28-progress-cell-gradient";
import {
  buildCountProgressColor,
  buildCountProgressInkColor,
  buildRepetitionAriaLabel,
  buildRepetitionRingState
} from "./data/reader-halo-logic.js?v=2026-06-27-transition-underline";
import {
  resolveNavigationTarget,
  searchNavigationTargets
} from "./data/navigation-logic.js?v=2026-06-28-home-search";
import { renderHomeSearchResults } from "./data/home-search-view.js?v=2026-06-28-home-search";
import { bulkFillAyahRangeCounts } from "./data/bulk-progress.js";
import { buildDeveloperSeedState } from "./data/developer-seed.js";
import {
  clearSeedBackup,
  loadPersistedState,
  loadSeedBackup,
  mergeStoredState,
  saveSeedBackup,
  savePersistedState
} from "./data/storage.js?v=2";
import {
  limitRecentPages,
  pushRecentPage
} from "./data/recent-pages.js?v=2026-06-28-recent-pages";
import {
  applyDeveloperThresholdMode,
  buildTripleActivationState,
  getCountIncreaseSoundConfig,
  normalizeThresholdProfile,
  updateNumericSetting,
  updateThresholdProfile
} from "./data/settings-logic.js";
import { getLineFitClass } from "./data/mushaf-line-fit.js?v=2026-06-26-density-fit-all-3";
import { shouldRegisterServiceWorker } from "./data/runtime-environment.js";
import { fetchQcf4Page } from "./reader/qcf4-data.js?v=2026-06-26-qcf4-renderer";
import { collectQcf4AyahKeys } from "./reader/qcf4-logic.js?v=2026-06-26-qcf4-renderer";
import { renderQcf4Page } from "./reader/qcf4-renderer.js?v=2026-06-29-surah-title-box";
import {
  buildTrackPages,
  clampTrackOffset,
  getTrackDirection,
  getTrackTargetPage,
  shouldCommitTrackMove,
  shouldStartTrackGesture
} from "./reader/swipe-reveal.js?v=2026-06-22-page-turn-fill";

const PAGE_COUNT = 604;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const app = document.querySelector("#app");
const setBootStatus = (label) => {
  if (!app) return;
  app.innerHTML = `
    <main class="app-shell home-shell">
      <div class="detail-card">
        <div class="detail-title"><span>Starting Hifz Trackr</span></div>
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
  lastPage: 1,
  lastRoute: { screen: "home", tab: "progress", page: 1, target: null },
  recentPages: [],
  ayahBookmarks: [],
  pageBookmarks: [],
  practiceEvents: [],
  helpSeen: false,
  settings: {
    theme: "dark",
    sound: false,
    vibration: "auto",
    developerMode: false,
    reviewQueueSize: 12,
    doubleTapWindow: 250,
    repetitionThresholds: { ...defaultThresholds },
    transitionCountThresholds: { ...defaultThresholds }
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
let animatePageGridOnRender = false;
let pendingTap = null;
let undoVisible = false;
let detailTarget = null;
let settingsOpen = false;
let helpOpen = false;
let helpSlideIndex = 0;
let bulkFillOpen = false;
let bulkFillForm = null;
let bulkFillPicker = null;
let settingsError = null;
let hasSeedBackup = false;
let developerModeTapState = null;
let review = null;
let swipeStart = null;
let suppressClickUntil = 0;
let lastPointerAyahTap = { key: null, until: 0 };
let pageNavigationInFlight = false;
let trackState = {
  direction: null,
  dragging: false,
  offset: 0
};
let countIncreaseAudioContext = null;
let pageCache = new Map();
let qcf4PageCache = new Map();
let surahVerseCounts = new Map();
let homeSearch = {
  query: "",
  results: []
};

const SWIPE_COMMIT_DISTANCE = 60;
const SWIPE_CANCEL_VERTICAL_LIMIT = 70;
const SWIPE_DRAG_START = 8;
const PAGE_TURN_DURATION = 220;
const PAGE_TURN_EASING = "cubic-bezier(.2, .8, .2, 1)";
const TRACK_NEXT_TRANSFORM = "0%";
const TRACK_CURRENT_TRANSFORM = "-33.333333%";
const TRACK_PREVIOUS_TRANSFORM = "-66.666667%";
const NUMERIC_SETTING_RULES = {
  doubleTapWindow: { min: 150, max: 600, step: 25, label: "Double tap window" },
  reviewQueueSize: { min: 4, max: 30, step: 1, label: "Review queue size" }
};

const icons = {
  back: `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`,
  previousPage: `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>`,
  nextPage: `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`,
  help: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.2 2.2 0 0 1 4.3.8c0 1.8-2.1 2-2.1 3.7"/><path d="M12 17h.01"/></svg>`,
  settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M19 14.5a1.8 1.8 0 0 0 .4 2l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21a2 2 0 1 1-4 0v-.4a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1H3a2 2 0 1 1 0-4h.4a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7V3a2 2 0 1 1 4 0v.4a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1H21a2 2 0 1 1 0 4h-.4a1.8 1.8 0 0 0-1.6 1Z"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  undo: `<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="m18 6-12 12M6 6l12 12"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>`,
  export: `<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`
};

init().catch(showFatalError);

async function init() {
  setBootStatus("Loading saved state...");
  state = await loadState();
  hasSeedBackup = Boolean(await loadSeedBackup());
  state.lastPage = clampPage(state.lastPage);
  state.lastRoute = normalizeRouteState(state.lastRoute, state.lastPage);
  setBootStatus("Loading metadata...");
  document.documentElement.dataset.theme = state.settings.theme;
  const [mushafData, navigationData] = await Promise.all([
    fetchJson("/src/data/mushaf-metadata.json"),
    fetchJson("/src/data/navigation-metadata.json")
  ]);
  const initialPage = clampPage(state.lastRoute.page || state.lastPage);
  setBootStatus(`Loading page ${initialPage}...`);
  metadata = {
    ...mushafData,
    surahs: navigationData.surahs,
    juz: navigationData.juz
  };
  surahVerseCounts = buildSurahVerseCounts(metadata.pages);
  const initialTrack = await loadTrackPages(initialPage);
  trackPages = initialTrack.data;
  route = {
    screen: state.lastRoute.screen,
    tab: state.lastRoute.tab,
    page: initialPage,
    target: null
  };
  setBootStatus("Binding events...");
  bindGlobalEvents();
  setBootStatus("Rendering...");
  render();
  if ("serviceWorker" in navigator && shouldRegisterServiceWorker(globalThis.location?.hostname || "")) {
    navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => {});
  }
}

async function loadState() {
  const loaded = await loadPersistedState(defaultState);
  loaded.recentPages = limitRecentPages(loaded.recentPages);
  loaded.settings.repetitionThresholds = normalizeThresholdProfile(
    loaded.settings.repetitionThresholds,
    defaultState.settings.repetitionThresholds
  );
  loaded.settings.transitionCountThresholds = normalizeThresholdProfile(
    loaded.settings.transitionCountThresholds,
    defaultState.settings.transitionCountThresholds
  );
  return loaded;
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

async function getQcf4PageData(page) {
  if (!page) return null;
  if (qcf4PageCache.has(page)) return qcf4PageCache.get(page);
  const data = await fetchQcf4Page(page);
  qcf4PageCache.set(page, data);
  return data;
}

async function loadTrackPages(currentPage) {
  const pages = buildTrackPages({ currentPage, pageCount: PAGE_COUNT });
  const [previous, current, next, previousQcf4, currentQcf4, nextQcf4] = await Promise.all([
    pages.previous ? getPageData(pages.previous).catch(() => null) : Promise.resolve(null),
    getPageData(pages.current),
    pages.next ? getPageData(pages.next).catch(() => null) : Promise.resolve(null),
    pages.previous ? getQcf4PageData(pages.previous).catch(() => null) : Promise.resolve(null),
    getQcf4PageData(pages.current).catch(() => null),
    pages.next ? getQcf4PageData(pages.next).catch(() => null) : Promise.resolve(null)
  ]);
  return {
    numbers: pages,
    data: {
      previous: { legacy: previous, qcf4: previousQcf4 },
      current: { legacy: current, qcf4: currentQcf4 },
      next: { legacy: next, qcf4: nextQcf4 }
    }
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
    rememberCurrentRoute();
    state.recentPages = pushRecentPage(state.recentPages, route.page);
    await saveState();
  }
  render();
}

async function goHome(tab = route.tab || "progress") {
  route = { screen: "home", tab, page: route.page, target: null };
  rememberCurrentRoute();
  await saveState();
  render();
}

function render() {
  document.documentElement.dataset.theme = state.settings.theme;
  app.innerHTML = route.screen === "reading" ? renderReading() : renderHome();
  if (settingsOpen) app.insertAdjacentHTML("beforeend", renderSettings());
  if (helpOpen) app.insertAdjacentHTML("beforeend", renderHelpModal());
  if (bulkFillOpen) app.insertAdjacentHTML("beforeend", renderBulkFillModal());
  if (detailTarget) app.insertAdjacentHTML("beforeend", renderDetails());
  bindScreenEvents();
  animatePageGridOnRender = false;
}

function renderHome() {
  return `
    <main class="app-shell home-shell">
      <header class="topbar">
        <div>
          <h1>Hifz Trackr</h1>
          <p>tap, track, tathbit</p>
        </div>
        <div class="top-actions">
          ${renderHelpButton()}
          <button class="icon-btn" data-action="settings" data-dev-mode-trigger aria-label="Settings">${icons.settings}</button>
        </div>
      </header>
      <label class="search-box">
        ${icons.search}
        <input id="jumpInput" type="search" placeholder="Page 48, Al-Baqarah, Juz 3" autocomplete="off" value="${escapeHtml(homeSearch.query)}" />
      </label>
      ${renderHomeSearchResults(homeSearch.results)}
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
  const previewQueueSize = 5;
  const strip = JUZ_RANGES.map(([number, start, end]) => `<span class="mushaf-strip-segment ${rangeRepetitionLevel(start, end)}" aria-hidden="true" title="Juz ${number}"></span>`).join("");
  const juzItems = JUZ_RANGES.map(([number, start, end]) => {
    const progressState = rangeCellProgressState(start, end);
    return `<button class="juz-cell ${cellProgressClass(progressState)} ${number === selectedJuz ? "selected" : ""}"${cellProgressStyle(progressState)} data-juz="${number}" aria-label="Juz ${number}">${number}</button>`;
  }).join("");
  const current = JUZ_RANGES.find(([number]) => number === selectedJuz);
  const pages = [];
  for (let page = current[1]; page <= current[2]; page += 1) {
    const progressState = pageCellProgressState(page);
    pages.push(`<button class="page-cell ${cellProgressClass(progressState)}"${cellProgressStyle(progressState, pages.length)} data-page="${page}"><span class="page-cell-number">${page}</span></button>`);
  }
  const lowCountItems = getLowCountItems();
  const previewItems = lowCountItems.slice(0, previewQueueSize);
  return `
    <div class="progress-card">
      <div class="mushaf-strip" aria-hidden="true">${strip}</div>
      <div class="section-caption mushaf-strip-label">Juz</div>
      <div class="juz-grid" dir="ltr">${juzItems}</div>
      <div class="selected-head">
        <strong class="section-caption">Page</strong>
        <span class="summary-pills"><span class="small-pill weak">${countPages(current, "weak")} weak</span><span class="small-pill strong">${countHighCountPages(current)} strong</span></span>
      </div>
      <div class="page-grid ${animatePageGridOnRender ? "page-grid-zoom" : ""}" dir="ltr">${pages.join("")}</div>
    </div>
    <h3 class="label">Practice Next</h3>
    <div class="queue-list">
      ${previewItems.length ? previewItems.map(renderQueueItem).join("") : `<p class="empty-state">Open a page and tap ayah numbers to start tracking.</p>`}
    </div>
  `;
}

function renderQueueItem(item) {
  const countLabel = item.kind === "Ayah" ? "repetition count" : "transition count";
  const primaryLabel = item.kind === "Transition"
    ? formatQueueTransitionLabel(item.key)
    : formatQueueAyahLabel(item.label);
  const typeLabel = item.kind === "Ayah" ? "Repetition" : "Transition";
  return `
    <button class="list-row" data-review-target="${encodeURIComponent(JSON.stringify(item))}">
      <span><strong>${primaryLabel}</strong><small>Page ${item.page}, ${countLabel} ${item.count}</small></span>
      <span class="queue-pills"><span class="small-pill ${item.countLevel}">${titleCase(item.countLevel)}</span><span class="type-pill">${typeLabel}</span></span>
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
          <span class="surah-row-page" aria-label="Page ${entry.page}">${entry.page}</span>
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
    for (const key of pageData.ayahKeys || []) {
      const [surahNumber, ayahNumber] = key.split(":").map(Number);
      updateSurahVerseCount(counts, surahNumber, ayahNumber);
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
  const recentPages = limitRecentPages(state.recentPages);
  return `
    <h2>Bookmarks</h2>
    <h3 class="label">Recent Pages</h3>
    <div class="queue-list">
      ${recentPages.length ? recentPages.map((page) => `
        <div class="list-row static"><button data-page="${page}"><strong>Page ${page}</strong><small>${metadata.pages[String(page)]?.label || ""}</small></button></div>
      `).join("") : `<p class="empty-state">Pages you open will appear here.</p>`}
    </div>
    <h3 class="label">Page Bookmarks</h3>
    <div class="queue-list">
      ${state.pageBookmarks.length ? [...state.pageBookmarks].sort((a, b) => a - b).map((page) => `
        <div class="list-row static"><button data-page="${page}"><strong>Page ${page}</strong><small>${metadata.pages[String(page)]?.label || ""}</small></button><button class="icon-btn small bookmark-btn active" data-remove-page-bookmark="${page}" aria-label="Remove page bookmark">${icons.bookmark}</button></div>
      `).join("") : `<p class="empty-state">No page bookmarks yet.</p>`}
    </div>
    <h3 class="label">Ayah Bookmarks</h3>
    <div class="queue-list">
      ${state.ayahBookmarks.length ? state.ayahBookmarks.map((item) => `
        <div class="list-row static"><button data-page="${item.page}" data-target="${item.key}"><strong>${labelAyah(item.key)}</strong><small>Page ${item.page}</small></button><button class="icon-btn small bookmark-btn active" data-remove-ayah-bookmark="${item.key}" aria-label="Remove ayah bookmark">${icons.bookmark}</button></div>
      `).join("") : `<p class="empty-state">No ayah bookmarks yet.</p>`}
    </div>
  `;
}

function renderReading() {
  const pageNumbers = buildTrackPages({ currentPage: route.page, pageCount: PAGE_COUNT });
  const pageBookmarked = state.pageBookmarks.includes(route.page);
  const activeTarget = resolveReaderTarget();
  const bulkFillButtonClasses = [
    "reader-bulk-fill-btn",
    review ? "with-review" : ""
  ].filter(Boolean).join(" ");
  const undoButtonClasses = [
    "floating-undo",
    review ? "with-review" : ""
  ].filter(Boolean).join(" ");
  return `
    <main class="app-shell reader-shell">
      <header class="reading-top">
        <button class="icon-btn" data-action="home" aria-label="Back">${icons.back}</button>
        <div class="reading-meta">${review ? `Review · ${review.index + 1} of ${review.queue.length}` : ""}</div>
        <div class="top-actions">
          <button class="icon-btn ${pageBookmarked ? "active" : ""} bookmark-btn" data-action="toggle-page-bookmark" aria-label="Toggle page bookmark">${icons.bookmark}</button>
          ${renderHelpButton()}
          <button class="icon-btn" data-action="settings" data-dev-mode-trigger aria-label="Settings">${icons.settings}</button>
        </div>
      </header>
      <section class="page-shell ${route.page % 2 ? "odd" : "even"}" aria-label="Mushaf page ${route.page}">
        ${renderPageChrome(route.page)}
        <div class="page-track" data-track-direction="${trackState.direction || ""}">
          ${renderPageSlot(trackPages.next, pageNumbers.next, "next", true)}
          ${renderPageSlot(trackPages.current, route.page, "current", false, activeTarget)}
          ${renderPageSlot(trackPages.previous, pageNumbers.previous, "previous", true)}
        </div>
      </section>
      <nav class="reader-bottom-nav" aria-label="Page navigation">
        <button class="reader-bottom-btn next" data-action="next-page" aria-label="Next page" ${pageNumbers.next ? "" : "disabled"}>${icons.nextPage}</button>
        <button class="reader-bottom-btn previous" data-action="previous-page" aria-label="Previous page" ${pageNumbers.previous ? "" : "disabled"}>${icons.previousPage}</button>
      </nav>
      <button class="${bulkFillButtonClasses}" data-action="open-bulk-fill" aria-label="Bulk fill counts">+</button>
      ${undoVisible ? `<button class="${undoButtonClasses}" data-action="undo" aria-label="Undo last repetition count">${icons.undo}</button>` : ""}
      ${review ? renderReviewBar() : ""}
    </main>
  `;
}

function renderPageChrome(page) {
  const pageData = metadata.pages[String(page)] || {};
  return `
    <div class="page-chrome page-top-meta" aria-label="Page metadata">
      <span class="page-meta-surah">${escapeHtml(getPagePrimarySurahName(pageData))}</span>
      <span class="page-meta-range">${escapeHtml(formatPageAyahRange(pageData.ayahKeys))}</span>
      <span class="page-meta-juz">Juz ${pageData.juz || ""}</span>
    </div>
    <div class="page-chrome page-bottom-wrap" aria-hidden="true">
      <div class="page-bottom-meta">${page}</div>
    </div>
  `;
}

function getPagePrimarySurahName(pageData) {
  const firstKey = pageData.ayahKeys?.[0] || "";
  const firstSurah = Number(firstKey.split(":")[0]) || pageData.surahsPresent?.[0] || 1;
  const surah = metadata.surahs?.find((entry) => entry.number === firstSurah);
  return surah?.transliteratedName || surah?.englishName || `Surah ${firstSurah}`;
}

function formatPageAyahRange(ayahKeys = []) {
  const first = ayahKeys[0];
  const last = ayahKeys[ayahKeys.length - 1] || first;
  if (!first || !last) return "";
  const [firstSurah, firstAyah] = first.split(":");
  const [lastSurah, lastAyah] = last.split(":");
  return `${firstSurah} : ${firstAyah} - ${lastSurah} : ${lastAyah}`;
}

const helpSlides = [
  {
    title: "Open a page",
    eyebrow: "Navigation",
    body: "Use Progress to pick a juz and page, Surahs to jump by surah, Bookmarks to return to saved places, or search for a page, surah, or juz.",
    visual: "navigation"
  },
  {
    title: "Track practice",
    eyebrow: "Tap rhythm",
    body: "Use one tap when you repeat that ayah by itself. Use two quick taps when you practice connecting that ayah into the next one. Hifz Trackr keeps those counts separate so you can see both ayah strength and transition strength.",
    visual: "tap"
  },
  {
    title: "Inspect details",
    eyebrow: "Long press",
    body: "Long press an ayah marker to open its detail view, where you can inspect counts, decrement mistakes, reset an item, or bookmark the ayah.",
    visual: "details"
  },
  {
    title: "Progress colors",
    eyebrow: "Color logic",
    body: "Grey/white means not started. The more you repeat, the greener the ayah marker becomes. Page and juz cells stay honest by following the weakest ayah or transition inside them.",
    visual: "colors"
  }
];

function renderHelpButton() {
  const pulse = state.helpSeen ? "" : " first-run-pulse";
  return `<button class="icon-btn help-btn${pulse}" data-action="open-help" aria-label="Open help tutorial">${icons.help}</button>`;
}

function renderHelpModal() {
  const slide = helpSlides[helpSlideIndex] || helpSlides[0];
  return `
    <div class="modal-backdrop" data-action="close-help">
      <section class="modal help-modal" role="dialog" aria-modal="true" aria-label="Help tutorial">
        <header class="modal-head">
          <strong>How Hifz Trackr works</strong>
          <button class="icon-btn small" data-action="close-help" aria-label="Close">${icons.close}</button>
        </header>
        <div class="help-slide">
          <div class="help-visual ${slide.visual}" aria-hidden="true">${renderHelpVisual(slide.visual)}</div>
          <p class="section-caption">${slide.eyebrow}</p>
          <h2>${slide.title}</h2>
          <p>${slide.body}</p>
        </div>
        <div class="help-progress" aria-label="Help slide ${helpSlideIndex + 1} of ${helpSlides.length}">
          ${helpSlides.map((_, index) => `<span class="${index === helpSlideIndex ? "active" : ""}"></span>`).join("")}
        </div>
        <div class="help-actions">
          <button class="secondary-btn" data-action="previous-help" ${helpSlideIndex === 0 ? "disabled" : ""}>Previous</button>
          <button class="primary-btn" data-action="${helpSlideIndex === helpSlides.length - 1 ? "close-help" : "next-help"}">${helpSlideIndex === helpSlides.length - 1 ? "Done" : "Next"}</button>
        </div>
      </section>
    </div>
  `;
}

function renderHelpVisual(type) {
  if (type === "colors") {
    const colorLevels = [
      { level: "empty", progress: 0, clip: 50, ink: "#263500" },
      { level: "weak", progress: 25, clip: 37.5, ink: "#f7f7ef" },
      { level: "building", progress: 50, clip: 25, ink: "#fef3c7" },
      { level: "strong", progress: 75, clip: 12.5, ink: "#263500" },
      { level: "mastered", progress: 100, clip: 0, ink: "#263500" }
    ];
    return `
      <div class="help-color-row">
        ${colorLevels.map(({ level, progress, clip, ink }) => `
          <span class="ayah-marker ayah-mark ${level} transition-count-${level} help-color-marker" style="font-family: 'QCF2001'; --count-color: var(--${level}); --count-ink: ${ink}; --transition-progress: ${progress}%; --transition-clip: ${clip}%; --transition-color: var(--${level})">&#xf1a3;</span>
        `).join("")}
      </div>
    `;
  }
  if (type === "navigation") {
    return `
      <div class="help-home-preview" aria-label="Home navigation preview">
        <div class="help-search-box">
          ${icons.search}
          <span>Page 48, Al-Baqarah, Juz 3</span>
        </div>
        <div class="help-home-tabs">
          <span class="active">Progress</span>
          <span>Surahs</span>
          <span>Bookmarks</span>
        </div>
      </div>
    `;
  }
  if (type === "tap") {
    return `
      <div class="help-tap-demo">
        <span class="help-tap-label single">1 tap</span>
        <div class="help-ayah-demo" aria-label="Ayah 12 with transition count line">
          <span class="ayah-marker ayah-mark building transition-count-building help-ayah-glyph" style="font-family: 'QCF2001'; --count-color: var(--building); --count-ink: #fef3c7; --transition-progress: 62%; --transition-clip: 19%; --transition-color: var(--building)">&#xf1a3;</span>
          <span class="help-plus-pop ayah" aria-hidden="true">+</span>
          <span class="help-plus-pop transition" aria-hidden="true">+</span>
          <span class="help-hand-tap" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8.5 12.5V5.8a1.7 1.7 0 1 1 3.4 0v5.5"/>
              <path d="M11.9 11V8.4a1.6 1.6 0 1 1 3.2 0V12"/>
              <path d="M15.1 12V9.9a1.5 1.5 0 0 1 3 0v4.8c0 3.1-2.3 5.3-5.5 5.3h-1.1a5.1 5.1 0 0 1-4.1-2.1l-2.5-3.3a1.5 1.5 0 0 1 .2-2.1 1.7 1.7 0 0 1 2.3.2l1.1 1.1"/>
            </svg>
          </span>
        </div>
        <span class="help-tap-label double">2 taps</span>
      </div>
    `;
  }
  return `
    <div class="help-long-press-demo">
      <div class="help-ayah-demo help-detail-marker-wrap">
        <span class="ayah-marker ayah-mark building transition-count-building help-ayah-glyph help-detail-glyph" style="font-family: 'QCF2001'; --count-color: var(--building); --count-ink: #fef3c7; --transition-progress: 62%; --transition-clip: 19%; --transition-color: var(--building)">&#xf1a3;</span>
        <span class="help-long-press-ring" aria-hidden="true"></span>
        <span class="help-hand-tap help-long-press-hand" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8.5 12.5V5.8a1.7 1.7 0 1 1 3.4 0v5.5"/>
            <path d="M11.9 11V8.4a1.6 1.6 0 1 1 3.2 0V12"/>
            <path d="M15.1 12V9.9a1.5 1.5 0 0 1 3 0v4.8c0 3.1-2.3 5.3-5.5 5.3h-1.1a5.1 5.1 0 0 1-4.1-2.1l-2.5-3.3a1.5 1.5 0 0 1 .2-2.1 1.7 1.7 0 0 1 2.3.2l1.1 1.1"/>
          </svg>
        </span>
      </div>
      <div class="help-detail-card" aria-hidden="true">
        <strong>Ayah detail</strong>
        <span>Count · Reset · Bookmark</span>
      </div>
    </div>
  `;
}

function renderPageSlot(pageData, pageNumber, slotName, inert = false, activeTarget = null) {
  const legacyPageData = pageData?.legacy || pageData;
  const qcf4PageData = pageData?.qcf4 || null;
  const visiblePageData = qcf4PageData || legacyPageData;
  if (!pageNumber || !visiblePageData) {
    return `<div class="page-slot ${slotName} empty" aria-hidden="true"></div>`;
  }
  const parity = pageNumber % 2 ? "odd" : "even";
  const openingPage = pageNumber <= 2 ? "opening-page" : "";
  if (qcf4PageData) {
    return `
      <div class="page-slot ${slotName} ${parity} ${openingPage} qcf4-slot" ${inert ? 'aria-hidden="true"' : ""}>
        ${renderQcf4Page(qcf4PageData, {
          inert,
          buildAyahAttrs: () => "",
          buildAyahMarkerAttrs: (key) => buildQcf4AyahMarkerAttrs(key, { pageNumber }),
          buildAyahMarkerClass: (key) => buildQcf4AyahMarkerClass(key, activeTarget),
          buildAyahMarkerStyle: (key) => buildQcf4AyahMarkerStyle(key),
          buildGroupClass: (key) => buildQcf4AyahGroupClass(key)
        })}
      </div>
    `;
  }
  const lines = legacyPageData.lines.map((line) => renderLine(line, activeTarget, { inert, pageNumber })).join("");
  return `
    <div class="page-slot ${slotName} ${parity} ${openingPage}" ${inert ? 'aria-hidden="true"' : ""}>
      <div class="mushaf" dir="rtl">${lines}</div>
    </div>
  `;
}

function renderLine(line, activeTarget, options = {}) {
  if (line.type === "surah-header") return `<div class="surah-header">${decodeText(line.text)}</div>`;
  if (line.type === "basmala") return `<div class="basmala">${decodeText(line.text || line.qpcV2 || "")}</div>`;
  const words = line.words || [];
  const lineLength = words.reduce((total, word) => total + [...decodeText(word.word)].length, 0);
  const fit = getLineFitClass(words.length, lineLength);
  const parts = words.map((word) => renderWord(word, activeTarget, options)).join("");
  const unjustify = (options.pageNumber || route.page) <= 2 ? "unjustified" : "";
  const basmalaLine = options.pageNumber === 1 && line.verseRange === "1:1-1:1" ? "basmala-line" : "";
  return `<div class="mushaf-line ${fit} ${unjustify} ${basmalaLine} ${words.length <= 3 ? "short" : ""}">${parts}</div>`;
}

function renderWord(word, activeTarget, options = {}) {
  const text = decodeText(word.word);
  const [surah, ayah] = word.location.split(":").map(Number);
  const match = text.match(/^(.*?)(?:\s+)?([٠-٩]+)$/);
  if (!match) return `<span class="qword">${escapeHtml(text)}</span>`;
  const key = `${surah}:${ayah}`;
  const pageNumber = options.pageNumber || route.page;
  const transition = resolveOutgoingTransition(key, metadata);
  const ringState = buildRepetitionRingState({
    repetitionCount: getRepetitionCount(key),
    transitionCount: transition ? getTransitionCount(transition.key) : null,
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds
  });
  const ayahActive = activeTarget?.kind === "Ayah" && activeTarget.key === key;
  const transitionActive = activeTarget?.kind === "Transition" && activeTarget.key === transition?.key;
  const ayahClass = [
    "ayah-mark",
    ringState.repetitionCountLevel,
    ringState.hasTransitionRing ? `transition-count-${ringState.transitionCountLevel}` : "",
    ringState.isFullyMastered ? "fully-mastered" : "",
    transitionActive ? "transition-target" : "",
    ayahActive ? "target" : ""
  ].filter(Boolean).join(" ");
  const transitionUnderlineStyle = ringState.hasTransitionRing
    ? `--transition-progress: ${ringState.transitionProgressPercent}%; --transition-clip: ${(100 - ringState.transitionProgressPercent) / 2}%; --transition-color: ${ringState.transitionCountColor}; `
    : "";
  const ayahStyle = ` style="${transitionUnderlineStyle}--count-color: ${ringState.repetitionCountColor}; --count-ink: ${ringState.repetitionCountInkColor}"`;
  const ayahGlyph = renderAyahMarkGlyph(match[2]);
  if (options.inert) {
    return `
      <span class="qword">${escapeHtml(match[1])}</span>
      <span class="${ayahClass}"${ayahStyle} aria-hidden="true">${ayahGlyph}</span>
    `;
  }
  const ariaLabel = buildRepetitionAriaLabel({
    ayahLabel: labelAyah(key),
    repetitionCountLevel: ringState.repetitionCountLevel,
    transitionCountLevel: ringState.transitionCountLevel
  });
  return `
    <span class="qword">${escapeHtml(match[1])}</span>
    <button class="${ayahClass}"${ayahStyle} data-ayah="${key}" data-page="${pageNumber}" aria-label="${ariaLabel}">${ayahGlyph}</button>
  `;
}

function renderAyahMarkGlyph(value) {
  return `<span class="ayah-mark-glyph"><span class="ayah-mark-glyph-base">${value}</span><span class="ayah-mark-glyph-shine" aria-hidden="true">${value}</span></span>`;
}

function buildQcf4AyahMarkerAttrs(key, { pageNumber }) {
  const ariaLabel = buildRepetitionAriaLabel({
    ayahLabel: labelAyah(key),
    repetitionCountLevel: getCountLevelForAyah(key),
    transitionCountLevel: getTransitionLevelForAyah(key)
  });
  return `data-ayah="${escapeHtml(key)}" data-page="${pageNumber}" role="button" tabindex="0" aria-label="${escapeHtml(ariaLabel)}"`;
}

function buildQcf4AyahMarkerStyle(key) {
  const count = getRepetitionCount(key);
  const transition = resolveOutgoingTransition(key, metadata);
  const transitionCount = transition ? getTransitionCount(transition.key) : null;
  const transitionStyle = transition
    ? (() => {
        const ringState = buildRepetitionRingState({
          repetitionCount: count,
          transitionCount,
          repetitionThresholds: state.settings.repetitionThresholds,
          transitionCountThresholds: state.settings.transitionCountThresholds
        });
        return `; --transition-progress: ${ringState.transitionProgressPercent}%; --transition-clip: ${(100 - ringState.transitionProgressPercent) / 2}%; --transition-color: ${ringState.transitionCountColor}`;
      })()
    : "";
  return `--count-color: ${buildCountProgressColor(count, state.settings.repetitionThresholds)}; --count-ink: ${buildCountProgressInkColor(count, state.settings.repetitionThresholds)}${transitionStyle}`;
}

function buildQcf4AyahMarkerClass(key, activeTarget) {
  const transition = resolveOutgoingTransition(key, metadata);
  const ringState = buildRepetitionRingState({
    repetitionCount: getRepetitionCount(key),
    transitionCount: transition ? getTransitionCount(transition.key) : null,
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds
  });
  const ayahActive = activeTarget?.kind === "Ayah" && activeTarget.key === key;
  const transitionActive = activeTarget?.kind === "Transition" && activeTarget.key === transition?.key;
  return [
    "ayah-marker",
    "ayah-mark",
    ringState.repetitionCountLevel,
    ringState.hasTransitionRing ? `transition-count-${ringState.transitionCountLevel}` : "",
    ringState.isFullyMastered ? "fully-mastered" : "",
    transitionActive ? "transition-target" : "",
    ayahActive ? "target" : ""
  ].filter(Boolean).join(" ");
}

function buildQcf4AyahGroupClass(key) {
  return [
    "ayah-group",
    state.ayahBookmarks.some((item) => item.key === key) ? "bookmarked-ayah" : ""
  ].filter(Boolean).join(" ");
}

function getCountLevelForAyah(key) {
  return buildRepetitionRingState({
    repetitionCount: getRepetitionCount(key),
    transitionCount: null,
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds
  }).repetitionCountLevel;
}

function getTransitionLevelForAyah(key) {
  const transition = resolveOutgoingTransition(key, metadata);
  if (!transition) return null;
  return buildRepetitionRingState({
    repetitionCount: getRepetitionCount(key),
    transitionCount: getTransitionCount(transition.key),
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds
  }).transitionCountLevel;
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
    getRepetitionCount,
    getTransitionCount,
    labelAyah,
    labelTransition,
    isAyahBookmarked: (key) => state.ayahBookmarks.some((item) => item.key === key),
    resolveOutgoingTransition: resolveDetailTransition
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
                <div class="detail-block-copy">
                  <div class="detail-block-head">
                    <span class="small-pill ${detail.transitionOnly.countLevel}"${countColorStyle(detail.transitionOnly.count, state.settings.transitionCountThresholds)}>${titleCase(detail.transitionOnly.countLevel)}</span>
                    <span class="detail-metric-label">${detail.transitionOnly.label}</span>
                  </div>
                  <div class="detail-count-row">
                    ${renderCountValue(detail.transitionOnly.count, detail.transitionOnly.target)}
                    <div class="detail-count-actions">
                      <button class="detail-mini-action secondary-btn" data-action="decrement-detail" aria-label="Decrease transition count">-</button>
                      <button class="detail-mini-action secondary-btn" data-action="increment-detail" aria-label="Increase transition count">+</button>
                    </div>
                  </div>
                </div>
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
              <span class="small-pill ${detail.transition.countLevel}"${countColorStyle(detail.transition.count, state.settings.transitionCountThresholds)}>${titleCase(detail.transition.countLevel)}</span>
              <span class="detail-metric-label">${detail.transition.label}</span>
            </div>
            <div class="detail-count-row">
              ${renderCountValue(detail.transition.count, detail.transition.target)}
              <div class="detail-count-actions">
                <button class="detail-mini-action secondary-btn" data-action="decrement-transition-detail" aria-label="Decrease transition count">-</button>
                <button class="detail-mini-action secondary-btn" data-action="increment-transition-detail" aria-label="Increase transition count">+</button>
              </div>
            </div>
            <strong class="detail-transition-path">${detail.transition.path}</strong>
          </div>
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
            <button class="icon-btn small bookmark-btn ${detail.bookmarked ? "active" : ""}" data-action="toggle-ayah-bookmark" aria-label="${detail.headerBookmarkLabel}">${icons.bookmark}</button>
            <button class="icon-btn small" data-action="close-modal" aria-label="Close">${icons.close}</button>
          </div>
        </header>
          <div class="detail-panel">
            <div class="detail-block">
              <div class="detail-block-copy">
                <div class="detail-block-head">
                  <span class="small-pill ${detail.ayah.countLevel}"${countColorStyle(detail.ayah.count, state.settings.repetitionThresholds)}>${titleCase(detail.ayah.countLevel)}</span>
                  <span class="detail-metric-label">${detail.ayah.label}</span>
                </div>
                <div class="detail-count-row">
                  ${renderCountValue(detail.ayah.count, detail.ayah.target)}
                  <div class="detail-count-actions">
                    <button class="detail-mini-action secondary-btn" data-action="decrement-repetition-detail" aria-label="Decrease repetition count">-</button>
                    <button class="detail-mini-action secondary-btn" data-action="increment-repetition-detail" aria-label="Increase repetition count">+</button>
                  </div>
                </div>
              </div>
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
        <header class="modal-head"><strong data-dev-mode-trigger>Settings</strong><button class="icon-btn small" data-action="close-settings" aria-label="Close">${icons.close}</button></header>
        ${settingsError ? `<p class="settings-error" role="alert">${escapeHtml(settingsError)}</p>` : ""}
        <h3 class="label">Storage</h3>
        <div class="setting-row static"><span>Practice events<small>${progressPrompt()}</small></span></div>
        <h3 class="label">Appearance</h3>
        <div class="setting-row"><span>Dark mode<small>Default on</small></span><button class="toggle ${s.theme === "dark" ? "on" : ""}" data-setting="theme" role="switch" aria-checked="${s.theme === "dark"}"></button></div>
        <h3 class="label">Feedback</h3>
        <div class="setting-row"><span>Sound<small>Default off</small></span><button class="toggle ${s.sound ? "on" : ""}" data-setting="sound" role="switch" aria-checked="${s.sound}"></button></div>
        <div class="setting-row"><span>Vibration<small>Default on when supported</small></span><button class="toggle ${s.vibration !== false ? "on" : ""}" data-setting="vibration" role="switch" aria-checked="${s.vibration !== false}"></button></div>
        <label class="setting-row"><span>Double tap window<small>Gesture timing</small></span><input data-setting-number="doubleTapWindow" type="number" min="150" max="600" step="25" value="${s.doubleTapWindow}" /></label>
        <label class="setting-row"><span>Review queue size<small>Low-count items per session</small></span><input data-setting-number="reviewQueueSize" type="number" min="4" max="30" step="1" value="${s.reviewQueueSize}" /></label>
        <h3 class="label">Count Thresholds</h3>
        ${renderThresholdSettings("Repetition count", "repetitionThresholds", s.repetitionThresholds)}
        ${renderThresholdSettings("Transition count", "transitionCountThresholds", s.transitionCountThresholds)}
        <h3 class="label">Backup</h3>
        <div class="actions"><button class="secondary-btn" data-action="export-json">${icons.export} Export JSON</button><label class="secondary-btn file-btn">Import JSON<input type="file" accept="application/json" data-action="import-json" /></label></div>
        ${s.developerMode ? `<h3 class="label">Developer</h3><div class="actions"><button class="secondary-btn" data-action="seed-test-data">Seed test data</button><button class="secondary-btn" data-action="restore-test-data" ${hasSeedBackup ? "" : "disabled"}>Restore pre-seed data</button></div><p class="settings-note">${hasSeedBackup ? "A pre-seed snapshot is ready to restore." : "Seed once to enable restore."}</p>` : ""}
        <button class="danger-btn full" data-action="reset-all">Reset all data</button>
      </section>
    </div>
  `;
}

function renderBulkFillModal() {
  if (!bulkFillForm) return "";
  const surahOptions = buildBulkFillSurahOptions();
  const currentSurahOption = metadata.surahs?.find((surah) => surah.number === bulkFillForm.surahNumber);
  const surahLabel = currentSurahOption?.transliteratedName || currentSurahOption?.englishName || `Surah ${bulkFillForm.surahNumber}`;
  const verseMax = getBulkFillVerseMax(bulkFillForm.surahNumber);
  const modeLabel = bulkFillForm.mode === "increment" ? "Increment" : "Replace";
  return `
    <div class="modal-backdrop" data-action="close-bulk-fill">
      <section class="modal bulk-fill-modal" data-bulk-fill-modal role="dialog" aria-modal="true" aria-label="Bulk fill counts">
        <header class="modal-head">
          <strong>Bulk Fill Counts</strong>
          <button class="icon-btn small" data-action="close-bulk-fill" aria-label="Close">${icons.close}</button>
        </header>
        <p class="settings-note">Defaults come from the first visible surah on this page. Reversed ayah ranges are normalized automatically before applying.</p>
        <div class="setting-row bulk-fill-picker-row${bulkFillPicker === "mode" ? " open" : ""}">
          <span>Mode<small>Replace current counts or add on top</small></span>
          <div class="bulk-fill-picker-wrap">
            <button class="bulk-fill-picker-trigger" data-action="toggle-bulk-fill-picker" data-picker="mode" aria-expanded="${bulkFillPicker === "mode"}">
              <span>${modeLabel}</span>
              <span class="bulk-fill-picker-caret">${bulkFillPicker === "mode" ? "▴" : "▾"}</span>
            </button>
            ${bulkFillPicker === "mode" ? renderBulkFillPickerMenu({
              picker: "mode",
              options: [
                { value: "replace", label: "Replace", selected: bulkFillForm.mode === "replace" },
                { value: "increment", label: "Increment", selected: bulkFillForm.mode === "increment" }
              ]
            }) : ""}
          </div>
        </div>
        <div class="setting-row bulk-fill-picker-row${bulkFillPicker === "surahNumber" ? " open" : ""}">
          <span>Surah<small>${escapeHtml(surahLabel)}</small></span>
          <div class="bulk-fill-picker-wrap">
            <button class="bulk-fill-picker-trigger" data-action="toggle-bulk-fill-picker" data-picker="surahNumber" aria-expanded="${bulkFillPicker === "surahNumber"}">
              <span>${escapeHtml(buildBulkFillSurahLabel(bulkFillForm.surahNumber))}</span>
              <span class="bulk-fill-picker-caret">${bulkFillPicker === "surahNumber" ? "▴" : "▾"}</span>
            </button>
            ${bulkFillPicker === "surahNumber" ? renderBulkFillPickerMenu({
              picker: "surahNumber",
              options: surahOptions.map((option) => ({
                value: String(option.number),
                label: option.label,
                selected: option.number === bulkFillForm.surahNumber
              }))
            }) : ""}
          </div>
        </div>
        <div class="bulk-fill-range-grid">
          <label class="setting-row">
            <span>Start ayah<small>Current page default</small></span>
            ${renderBulkFillWheel({
              key: "startAyah",
              value: bulkFillForm.startAyah,
              min: 1,
              max: verseMax,
              label: "Start ayah"
            })}
          </label>
          <label class="setting-row">
            <span>End ayah<small>Current page default</small></span>
            ${renderBulkFillWheel({
              key: "endAyah",
              value: bulkFillForm.endAyah,
              min: 1,
              max: verseMax,
              label: "End ayah"
            })}
          </label>
        </div>
        <label class="setting-row">
          <span>Repetition count<small>Applied to each ayah in range</small></span>
          ${renderBulkFillWheel({
            key: "repetitionCount",
            value: bulkFillForm.repetitionCount,
            min: 0,
            max: 40,
            label: "Repetition count"
          })}
        </label>
        <label class="setting-row">
          <span>Transition count<small>Only for consecutive in-range ayahs</small></span>
          ${renderBulkFillWheel({
            key: "transitionCount",
            value: bulkFillForm.transitionCount,
            min: 0,
            max: 40,
            label: "Transition count"
          })}
        </label>
        <div class="actions">
          <button class="secondary-btn" data-action="close-bulk-fill">Cancel</button>
          <button class="primary-btn" data-action="submit-bulk-fill">Apply</button>
        </div>
      </section>
    </div>
  `;
}

function renderBulkFillPickerMenu({ picker, options }) {
  return `
    <div class="bulk-fill-picker-menu" data-bulk-fill-picker-menu="${picker}">
      ${options.map((option) => `
        <button
          class="bulk-fill-picker-option${option.selected ? " selected" : ""}"
          data-action="select-bulk-fill-picker"
          data-picker="${picker}"
          data-value="${escapeHtml(option.value)}"
        >
          <span>${escapeHtml(option.label)}</span>
          ${option.selected ? `<span class="bulk-fill-picker-check">✓</span>` : ""}
        </button>
      `).join("")}
    </div>
  `;
}

function renderBulkFillWheel({ key, value, min, max, label }) {
  const previous = value > min ? value - 1 : "";
  const next = value < max ? value + 1 : "";
  return `
    <div
      class="bulk-fill-wheel"
      data-bulk-fill-wheel="${key}"
      data-min="${min}"
      data-max="${max}"
      tabindex="0"
      role="spinbutton"
      aria-label="${label}"
      aria-valuemin="${min}"
      aria-valuemax="${max}"
      aria-valuenow="${value}"
    >
      <div class="bulk-fill-wheel-hit top" aria-hidden="true"></div>
      <div class="bulk-fill-wheel-value ghost" data-bulk-fill-previous>${previous}</div>
      <div class="bulk-fill-wheel-value active" data-bulk-fill-current>${value}</div>
      <div class="bulk-fill-wheel-value ghost" data-bulk-fill-next>${next}</div>
      <div class="bulk-fill-wheel-hit bottom" aria-hidden="true"></div>
    </div>
  `;
}

function renderThresholdSettings(title, profileKey, profile) {
  return `
    <fieldset class="threshold-group">
      <legend>${title}</legend>
      <label class="threshold-field">
        <span>Weak ends</span>
        <input data-threshold-profile="${profileKey}" data-threshold-key="weakMax" type="number" min="1" max="999" step="1" value="${profile.weakMax}" />
      </label>
      <label class="threshold-field">
        <span>Building ends</span>
        <input data-threshold-profile="${profileKey}" data-threshold-key="buildingMax" type="number" min="2" max="999" step="1" value="${profile.buildingMax}" />
      </label>
      <label class="threshold-field">
        <span>Strong ends</span>
        <input data-threshold-profile="${profileKey}" data-threshold-key="strongMax" type="number" min="3" max="999" step="1" value="${profile.strongMax}" />
      </label>
    </fieldset>
  `;
}

function bindGlobalEvents() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (bulkFillOpen) {
        closeBulkFill();
        render();
        return;
      }
      if (helpOpen) {
        helpOpen = false;
        render();
        return;
      }
      if (settingsOpen) {
        settingsOpen = false;
        render();
        return;
      }
      if (detailTarget) {
        detailTarget = null;
        render();
        return;
      }
    }
    if (route.screen !== "reading") return;
    if (event.key === "ArrowLeft") moveTrack("next");
    if (event.key === "ArrowRight") moveTrack("previous");
  });
}

function bindScreenEvents() {
  app.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => event.stopPropagation());
  });
  app.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => goHome(button.dataset.tab)));
  app.querySelectorAll("[data-page]:not([data-ayah])").forEach((button) => button.addEventListener("click", () => openPage(Number(button.dataset.page), { target: button.dataset.target || null })));
  app.querySelectorAll("[data-juz]").forEach((button) => button.addEventListener("click", () => {
    const nextJuz = Number(button.dataset.juz);
    animatePageGridOnRender = nextJuz !== selectedJuz;
    selectedJuz = nextJuz;
    render();
  }));
  app.querySelectorAll("[data-review-target]").forEach((button) => button.addEventListener("click", () => {
    const item = JSON.parse(decodeURIComponent(button.dataset.reviewTarget));
    openPage(item.page, { target: item.key });
  }));
  app.querySelectorAll("[data-remove-page-bookmark]").forEach((button) => button.addEventListener("click", () => removePageBookmark(Number(button.dataset.removePageBookmark))));
  app.querySelectorAll("[data-remove-ayah-bookmark]").forEach((button) => button.addEventListener("click", () => removeAyahBookmark(button.dataset.removeAyahBookmark)));
  app.querySelectorAll("[data-bulk-fill-field]").forEach((field) => {
    const handler = () => updateBulkFillField(field.dataset.bulkFillField, field.value);
    field.addEventListener("input", handler);
    field.addEventListener("change", handler);
  });
  app.querySelectorAll("[data-bulk-fill-wheel]").forEach((wheel) => bindBulkFillWheel(wheel));

  app.querySelectorAll(".page-slot.current .ayah-marker[data-ayah], .page-slot.current button.ayah-mark[data-ayah]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.button !== 0) return;
      if (lastPointerAyahTap.key === button.dataset.ayah && Date.now() < lastPointerAyahTap.until) return;
      handleAyahTap(button.dataset.ayah, button);
    });
    bindLongPress(button, () => openAyahDetail(button));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAyahDetail(button);
    });
  });

  app.querySelectorAll(".page-slot.current button.transition-mark[data-transition]").forEach((button) => {
    bindLongPress(button, () => {
      cancelPageGesture();
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
      if (event.button !== 0) return;
      if (!shouldStartTrackGesture({
        pointerType: event.pointerType,
        startedOnSelectableText: Boolean(event.target.closest?.(".mushaf-line"))
      })) return;
      event.preventDefault();
      swipeStart = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        offset: 0,
        dragging: false
      };
      trackState = { direction: null, dragging: false, offset: 0 };
      pageShell.classList.add("swipe-armed");
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
      pageShell.classList.remove("swipe-armed");
      pageShell.releasePointerCapture?.(event.pointerId);
      const ayahMarker = !didDrag ? resolveAyahMarkerAtPoint(event.clientX, event.clientY) : null;
      if (ayahMarker) {
        lastPointerAyahTap = { key: ayahMarker.dataset.ayah, until: Date.now() + 500 };
        handleAyahTap(ayahMarker.dataset.ayah, ayahMarker);
      }
      if (didDrag) suppressClickUntil = Date.now() + 350;
      if (trackState.direction && shouldCommitTrackMove({ dx, dy, commitDistance: SWIPE_COMMIT_DISTANCE, verticalLimit: SWIPE_CANCEL_VERTICAL_LIMIT })) {
        moveTrack(trackState.direction, { dragOffset });
        return;
      }
      resetTrackState(true);
    });
    pageShell.addEventListener("pointercancel", () => {
      swipeStart = null;
      pageShell.classList.remove("swipe-armed");
      resetTrackState(true);
    });
  }

  app.querySelectorAll("[data-dev-mode-trigger]").forEach((el) => {
    el.addEventListener("click", () => handleDeveloperModeTrigger());
  });

  app.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (event) => handleAction(event, el));
    if (el.matches("input[type=file]")) el.addEventListener("change", (event) => importJson(event.target.files[0]));
  });

  app.querySelectorAll("[data-setting]").forEach((button) => button.addEventListener("click", async () => {
    const key = button.dataset.setting;
    if (key === "theme") state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    if (key === "sound") state.settings.sound = !state.settings.sound;
    if (key === "vibration") state.settings.vibration = state.settings.vibration === false ? "auto" : false;
    settingsError = null;
    await saveState();
    render();
  }));
  app.querySelectorAll("[data-setting-number]").forEach((input) => input.addEventListener("change", async () => {
    const key = input.dataset.settingNumber;
    const rule = NUMERIC_SETTING_RULES[key];
    if (!rule) return;
    const result = updateNumericSetting(state.settings[key], input.value, rule);
    if (result.error) {
      settingsError = result.error;
      render();
      return;
    }
    state.settings[key] = result.value;
    settingsError = null;
    await saveState();
    render();
  }));
  app.querySelectorAll("[data-threshold-profile]").forEach((input) => input.addEventListener("change", async () => {
    const profileKey = input.dataset.thresholdProfile;
    const thresholdKey = input.dataset.thresholdKey;
    if (!["repetitionThresholds", "transitionCountThresholds"].includes(profileKey)) return;

    const result = updateThresholdProfile(state.settings[profileKey], thresholdKey, input.value);
    if (result.error) {
      settingsError = result.error;
      render();
      return;
    }

    state.settings[profileKey] = result.profile;
    settingsError = null;
    await saveState();
    render();
  }));

  const jump = app.querySelector("#jumpInput");
  if (jump) {
    jump.addEventListener("input", () => {
      const nextQuery = jump.value;
      updateHomeSearch(nextQuery, {
        selectionStart: jump.selectionStart ?? nextQuery.length,
        selectionEnd: jump.selectionEnd ?? nextQuery.length
      });
    });
    jump.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const target = homeSearch.results[0]?.page || parseJump(jump.value);
      if (!target) return;
      clearHomeSearch();
      openPage(target);
    });
  }

  app.querySelectorAll("[data-search-page]").forEach((el) => {
    el.addEventListener("click", () => {
      const page = Number(el.dataset.searchPage);
      if (!page) return;
      clearHomeSearch();
      openPage(page);
    });
  });
}

function resolveAyahMarkerAtPoint(x, y) {
  return document
    .elementFromPoint(x, y)
    ?.closest?.(".page-slot.current .ayah-marker[data-ayah], .page-slot.current button.ayah-mark[data-ayah]") || null;
}

async function handleAction(event, el) {
  const action = el.dataset.action;
  if (!action || action === "import-json") return;
  event.stopPropagation();
  if (action === "settings") settingsOpen = true;
  if (action === "close-settings") settingsOpen = false;
  if (action === "open-help") { await openHelp(); return; }
  if (action === "close-help") helpOpen = false;
  if (action === "open-bulk-fill") openBulkFill();
  if (action === "close-bulk-fill") closeBulkFill();
  if (action === "toggle-bulk-fill-picker") toggleBulkFillPicker(el.dataset.picker);
  if (action === "select-bulk-fill-picker") selectBulkFillPicker(el.dataset.picker, el.dataset.value);
  if (action === "next-help") helpSlideIndex = Math.min(helpSlides.length - 1, helpSlideIndex + 1);
  if (action === "previous-help") helpSlideIndex = Math.max(0, helpSlideIndex - 1);
  if (action === "close-modal") detailTarget = null;
  if (action === "home") { await goHome(); return; }
  if (action === "previous-page") moveTrack("previous");
  if (action === "next-page") moveTrack("next");
  if (action === "toggle-page-bookmark") togglePageBookmark();
  if (action === "undo") undoLast();
  if (action === "decrement-detail") mutateDetail(-1);
  if (action === "increment-detail") mutateDetail(1);
  if (action === "decrement-repetition-detail") mutateSpecificDetail("ayah", -1);
  if (action === "increment-repetition-detail") mutateSpecificDetail("ayah", 1);
  if (action === "decrement-transition-detail") mutateSpecificDetail("transition", -1);
  if (action === "increment-transition-detail") mutateSpecificDetail("transition", 1);
  if (action === "reset-detail") resetDetail();
  if (action === "toggle-ayah-bookmark") toggleAyahBookmark();
  if (action === "start-review") startReview();
  if (action === "skip-review") skipReview();
  if (action === "next-review") nextReview();
  if (action === "finish-review") { review = null; await goHome("progress"); return; }
  if (action === "export-json") exportJson();
  if (action === "submit-bulk-fill") { await submitBulkFill(); return; }
  if (action === "seed-test-data") seedTestData();
  if (action === "restore-test-data") restoreSeedBackup();
  if (action === "reset-all") resetAll();
  if (!["previous-page", "next-page", "decrement-repetition-detail", "increment-repetition-detail", "decrement-transition-detail", "increment-transition-detail"].includes(action)) render();
}

async function openHelp() {
  helpOpen = true;
  helpSlideIndex = 0;
  if (!state.helpSeen) {
    state.helpSeen = true;
    await saveState();
  }
  render();
}

async function handleDeveloperModeTrigger() {
  developerModeTapState = buildTripleActivationState(developerModeTapState, Date.now(), 250);
  if (!developerModeTapState.activated) return;

  state = applyDeveloperThresholdMode(state, defaultThresholds);
  settingsError = null;
  await saveState();
  render();
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
    rememberCurrentRoute();
    state.recentPages = pushRecentPage(state.recentPages, route.page);
    await saveState();
    render();
    applyTrackState();
  } finally {
    pageNavigationInFlight = false;
  }
}

function buildBulkFillDefaults(pageData, currentPage) {
  const ayahKeys = visibleAyahKeysForPage(pageData);
  const firstAyahKey = ayahKeys[0] || `${metadata.pages[String(currentPage)]?.surahsPresent?.[0] || 1}:1`;
  const firstSurah = Number(firstAyahKey.split(":")[0]);
  const surahAyahKeys = ayahKeys.filter((key) => Number(key.split(":")[0]) === firstSurah);
  const startAyahKey = surahAyahKeys[0] || firstAyahKey;
  const endAyahKey = surahAyahKeys[surahAyahKeys.length - 1] || startAyahKey;

  return {
    currentPage,
    surahNumber: firstSurah,
    startAyah: Number(startAyahKey.split(":")[1]),
    endAyah: Number(endAyahKey.split(":")[1]),
    repetitionCount: 0,
    transitionCount: 0,
    mode: "replace"
  };
}

function buildBulkFillSurahOptions() {
  const visibleSurahNumbers = metadata.pages[String(route.page)]?.surahsPresent || [];
  if (visibleSurahNumbers.length) {
    return visibleSurahNumbers.map((number) => ({
      number,
      label: buildBulkFillSurahLabel(number)
    }));
  }

  return (metadata.surahs || []).map((surah) => ({
    number: surah.number,
    label: buildBulkFillSurahLabel(surah.number)
  }));
}

function buildBulkFillSurahLabel(surahNumber) {
  const surah = metadata.surahs?.find((entry) => entry.number === surahNumber);
  const name = surah?.transliteratedName || surah?.englishName || `Surah ${surahNumber}`;
  return `${surahNumber}. ${name}`;
}

function getBulkFillVerseMax(surahNumber) {
  return surahVerseCounts.get(surahNumber) || 1;
}

function clampBulkFillAyah(value, surahNumber) {
  return Math.min(Math.max(1, Number(value) || 1), getBulkFillVerseMax(surahNumber));
}

function clampBulkFillCount(value) {
  return Math.min(40, Math.max(0, Number(value) || 0));
}

function applyBulkFillSurahDefaults(surahNumber) {
  if (!bulkFillForm) return;
  const visibleAyahs = visibleAyahKeysForPage(trackPages.current).filter((key) => Number(key.split(":")[0]) === surahNumber);
  bulkFillForm = {
    ...bulkFillForm,
    surahNumber,
    startAyah: visibleAyahs.length
      ? Number(visibleAyahs[0].split(":")[1])
      : clampBulkFillAyah(bulkFillForm.startAyah, surahNumber),
    endAyah: visibleAyahs.length
      ? Number(visibleAyahs[visibleAyahs.length - 1].split(":")[1])
      : clampBulkFillAyah(bulkFillForm.endAyah, surahNumber)
  };
}

function updateBulkFillField(key, value) {
  if (!bulkFillForm) return;
  if (key === "surahNumber") {
    applyBulkFillSurahDefaults(Number(value));
    render();
    return;
  }

  if (key === "startAyah" || key === "endAyah") {
    bulkFillForm = {
      ...bulkFillForm,
      [key]: clampBulkFillAyah(value, bulkFillForm.surahNumber)
    };
    render();
    return;
  }

  bulkFillForm = {
    ...bulkFillForm,
    [key]: ["repetitionCount", "transitionCount"].includes(key) ? clampBulkFillCount(value) : value
  };
}

function stepBulkFillField(key, direction) {
  if (!bulkFillForm || !direction) return;
  if (key === "startAyah" || key === "endAyah") {
    updateBulkFillField(key, bulkFillForm[key] + direction);
    syncBulkFillWheel(key);
    return;
  }
  if (key === "repetitionCount" || key === "transitionCount") {
    updateBulkFillField(key, bulkFillForm[key] + direction);
    syncBulkFillWheel(key);
  }
}

function syncBulkFillWheel(key) {
  if (!bulkFillForm) return;
  const wheel = app.querySelector(`[data-bulk-fill-wheel="${key}"]`);
  if (!wheel) return;

  const min = key === "startAyah" || key === "endAyah" ? 1 : 0;
  const max = key === "startAyah" || key === "endAyah"
    ? getBulkFillVerseMax(bulkFillForm.surahNumber)
    : 40;
  const value = key === "startAyah" || key === "endAyah"
    ? clampBulkFillAyah(bulkFillForm[key], bulkFillForm.surahNumber)
    : clampBulkFillCount(bulkFillForm[key]);
  const previous = value > min ? value - 1 : "";
  const next = value < max ? value + 1 : "";

  wheel.dataset.min = String(min);
  wheel.dataset.max = String(max);
  wheel.setAttribute("aria-valuemin", String(min));
  wheel.setAttribute("aria-valuemax", String(max));
  wheel.setAttribute("aria-valuenow", String(value));

  const previousEl = wheel.querySelector("[data-bulk-fill-previous]");
  const currentEl = wheel.querySelector("[data-bulk-fill-current]");
  const nextEl = wheel.querySelector("[data-bulk-fill-next]");
  if (previousEl) previousEl.textContent = String(previous);
  if (currentEl) currentEl.textContent = String(value);
  if (nextEl) nextEl.textContent = String(next);
}

function bindBulkFillWheel(wheel) {
  let pointerY = null;
  let dragCarry = 0;
  let dragDistance = 0;
  let suppressClick = false;
  const dragStepPx = 18;
  const clickZoneRatio = 0.34;

  wheel.addEventListener("wheel", (event) => {
    event.preventDefault();
    stepBulkFillField(wheel.dataset.bulkFillWheel, event.deltaY > 0 ? -1 : 1);
  }, { passive: false });

  wheel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      stepBulkFillField(wheel.dataset.bulkFillWheel, 1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      stepBulkFillField(wheel.dataset.bulkFillWheel, -1);
    }
  });

  wheel.addEventListener("pointerdown", (event) => {
    pointerY = event.clientY;
    dragCarry = 0;
    dragDistance = 0;
    suppressClick = false;
    wheel.setPointerCapture?.(event.pointerId);
  });

  wheel.addEventListener("pointermove", (event) => {
    if (pointerY == null) return;
    const delta = pointerY - event.clientY;
    dragDistance += Math.abs(delta);
    if (dragDistance >= 6) suppressClick = true;
    dragCarry += delta;
    const steps = dragCarry > 0
      ? Math.floor(dragCarry / dragStepPx)
      : Math.ceil(dragCarry / dragStepPx);
    if (!steps) {
      pointerY = event.clientY;
      return;
    }
    stepBulkFillField(wheel.dataset.bulkFillWheel, steps);
    dragCarry -= steps * dragStepPx;
    pointerY = event.clientY;
  });

  const finishPointer = (event) => {
    if (pointerY == null) return;
    pointerY = null;
    dragCarry = 0;
    if (wheel.hasPointerCapture?.(event.pointerId)) {
      wheel.releasePointerCapture(event.pointerId);
    }
  };

  wheel.addEventListener("pointerup", finishPointer);
  wheel.addEventListener("pointercancel", finishPointer);
  wheel.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      return;
    }
    const rect = wheel.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    if (offsetY <= rect.height * clickZoneRatio) {
      stepBulkFillField(wheel.dataset.bulkFillWheel, 1);
      return;
    }
    if (offsetY >= rect.height * (1 - clickZoneRatio)) {
      stepBulkFillField(wheel.dataset.bulkFillWheel, -1);
    }
  });
}

function openBulkFill() {
  bulkFillForm = buildBulkFillDefaults(trackPages.current, route.page);
  bulkFillOpen = true;
  bulkFillPicker = null;
}

function closeBulkFill() {
  bulkFillOpen = false;
  bulkFillForm = null;
  bulkFillPicker = null;
}

async function submitBulkFill() {
  if (!bulkFillForm) return;

  state = bulkFillAyahRangeCounts({
    state,
    metadata,
    startAyahKey: `${bulkFillForm.surahNumber}:${clampBulkFillAyah(bulkFillForm.startAyah, bulkFillForm.surahNumber)}`,
    endAyahKey: `${bulkFillForm.surahNumber}:${clampBulkFillAyah(bulkFillForm.endAyah, bulkFillForm.surahNumber)}`,
    repetitionCount: Number.isFinite(bulkFillForm.repetitionCount) ? bulkFillForm.repetitionCount : 0,
    transitionCount: Number.isFinite(bulkFillForm.transitionCount) ? bulkFillForm.transitionCount : 0,
    mode: bulkFillForm.mode === "increment" ? "increment" : "replace"
  });

  closeBulkFill();
  await saveState();
  render();
}

function toggleBulkFillPicker(picker) {
  bulkFillPicker = bulkFillPicker === picker ? null : picker;
}

function selectBulkFillPicker(picker, value) {
  if (!bulkFillForm) return;
  updateBulkFillField(picker, value);
  bulkFillPicker = null;
}

function handleAyahTap(key, marker = null) {
  if (marker) playAyahTapFeedback(marker);
  prepareCountIncreaseSound();
  if (pendingTap?.key === key) {
    clearTimeout(pendingTap.timer);
    const transition = resolveOutgoingTransition(key, metadata);
    if (transition) {
      logTransition(transition.key);
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
  state.ayahProgress[key] = { repetitionCount: getRepetitionCount(key) + 1 };
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
    ? `[data-ayah="${CSS.escape(key.split("|")[1])}"]`
    : `[data-ayah="${CSS.escape(key)}"]`;
  const marker = app.querySelector(selector);
  const count = key.includes("|") ? getTransitionCount(key) : getRepetitionCount(key);
  if (marker) {
    restartAyahPulse(marker);
    if (key.includes("|")) restartTransitionShine(marker);
    spawnRepetitionCountPop(marker, count, app);
  }
  playCountIncreaseSound();
  if (navigator.vibrate && state.settings.vibration !== false) navigator.vibrate(20);
}

function restartAyahPulse(marker) {
  playAyahTapFeedback(marker);
}

function restartTransitionShine(marker) {
  marker.classList.remove("transition-shine");
  void marker.offsetWidth;
  marker.classList.add("transition-shine");
  marker.addEventListener("animationend", () => marker.classList.remove("transition-shine"), { once: true });
}

function playAyahTapFeedback(marker) {
  if (!marker?.animate) {
    marker?.classList.add("pulse");
    return;
  }
  marker.getAnimations?.().forEach((animation) => {
    if (animation.effect?.target === marker) animation.cancel();
  });
  marker.animate(
    [
      { transform: "scale(1.22)" },
      { transform: "scale(.98)", offset: .72 },
      { transform: "scale(1)" }
    ],
    { duration: 420, easing: "ease-out" }
  );
}

function playCountIncreaseSound() {
  const config = getCountIncreaseSoundConfig(state.settings);
  if (!config) return;
  prepareCountIncreaseSound();
  const context = countIncreaseAudioContext;
  if (!context) return;

  if (context.state === "suspended") {
    context.resume().then(() => playCountIncreaseTone(context, config)).catch(() => {});
    return;
  }

  playCountIncreaseTone(context, config);
}

function prepareCountIncreaseSound() {
  if (!getCountIncreaseSoundConfig(state.settings)) return;
  const AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextConstructor) return;

  countIncreaseAudioContext ||= new AudioContextConstructor();
  if (countIncreaseAudioContext.state === "suspended") {
    countIncreaseAudioContext.resume().catch(() => {});
  }
}

function playCountIncreaseTone(context, config) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = config.wave;
  oscillator.frequency.setValueAtTime(config.frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(config.gain, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + config.duration + 0.012);

  if (config.secondFrequency) {
    const second = context.createOscillator();
    const secondGain = context.createGain();
    second.type = "sine";
    second.frequency.setValueAtTime(config.secondFrequency, now + 0.035);
    secondGain.gain.setValueAtTime(0.0001, now + 0.035);
    secondGain.gain.exponentialRampToValueAtTime(config.gain * 0.72, now + 0.05);
    secondGain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration + 0.045);
    second.connect(secondGain).connect(context.destination);
    second.start(now + 0.035);
    second.stop(now + config.duration + 0.055);
  }
}

function spawnRepetitionCountPop(marker, count, container) {
  const rect = getAyahMarkerVisualRect(marker);
  const pop = document.createElement("span");
  pop.className = "repetition-count-pop";
  pop.textContent = String(count);
  pop.setAttribute("aria-hidden", "true");
  pop.style.left = `${rect.left + rect.width / 2}px`;
  pop.style.top = `${rect.top}px`;
  container.append(pop);
  pop.addEventListener("animationend", () => pop.remove(), { once: true });
}

function getAyahMarkerVisualRect(marker) {
  return marker.querySelector?.(".ayah-mark-glyph")?.getBoundingClientRect?.() || marker.getBoundingClientRect();
}

function addEvent(type, payload) {
  state.practiceEvents.push({ id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), ...payload });
}

async function undoLast() {
  const last = [...state.practiceEvents].reverse().find((event) => event.delta && !event.undone);
  if (!last) return;
  last.undone = true;
  if (last.ayahKey) state.ayahProgress[last.ayahKey] = { repetitionCount: Math.max(0, getRepetitionCount(last.ayahKey) - last.delta) };
  if (last.transitionKey) state.transitionProgress[last.transitionKey] = { repetitionCount: Math.max(0, getTransitionCount(last.transitionKey) - last.delta) };
  addEvent("undo", { page: route.page, reversedEventId: last.id, delta: -last.delta, ayahKey: last.ayahKey, transitionKey: last.transitionKey });
  undoVisible = false;
  await saveState();
  render();
}

function mutateDetail(delta) {
  if (!detailTarget) return;
  if (detailTarget.kind === "ayah") {
    state.ayahProgress[detailTarget.key] = { repetitionCount: Math.max(0, getRepetitionCount(detailTarget.key) + delta) };
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
    const currentCount = getRepetitionCount(detailTarget.key);
    const nextCount = Math.max(0, currentCount + delta);
    if (nextCount === currentCount) return;
    state.ayahProgress[detailTarget.key] = { repetitionCount: nextCount };
    addEvent("decrement", { ayahKey: detailTarget.key, delta, page: route.page });
    await saveState();
    render();
    return;
  }

  if (kind === "transition") {
    const target = detailTarget.kind === "transition"
      ? detailTarget.key
      : resolveDetailTransition(detailTarget.key)?.key;
    if (!target) return;
    const currentCount = getTransitionCount(target);
    const nextCount = Math.max(0, currentCount + delta);
    if (nextCount === currentCount) return;
    state.transitionProgress[target] = { repetitionCount: nextCount };
    addEvent("decrement", { transitionKey: target, delta, page: route.page });
    await saveState();
    render();
  }
}

function resetDetail() {
  if (!detailTarget) return;
  if (detailTarget.kind === "ayah") {
    const repetitionCount = getRepetitionCount(detailTarget.key);
    state.ayahProgress[detailTarget.key] = { repetitionCount: 0 };
    addEvent("reset", { ayahKey: detailTarget.key, delta: -repetitionCount, page: route.page });
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
  const queue = getLowCountItems().slice(0, state.settings.reviewQueueSize);
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

function getLowCountItems() {
  return buildLowCountItems({
    ayahProgress: state.ayahProgress,
    transitionProgress: state.transitionProgress,
    metadata,
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds,
    labelAyah,
    labelTransition
  });
}

function rangeRepetitionLevel(start, end) {
  const levels = [];
  for (let page = start; page <= end; page += 1) levels.push(pageRepetitionLevel(page));
  return lowestCountLevel(levels);
}

function pageRepetitionLevel(page) {
  return getPageRepetitionLevel(page, metadata, state.ayahProgress, state.settings.repetitionThresholds);
}

function pageCellProgressState(page) {
  return getPageCellProgressState({
    page,
    metadata,
    ayahProgress: state.ayahProgress,
    transitionProgress: state.transitionProgress,
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds
  });
}

function rangeCellProgressState(startPage, endPage) {
  return getPageRangeCellProgressState({
    startPage,
    endPage,
    metadata,
    ayahProgress: state.ayahProgress,
    transitionProgress: state.transitionProgress,
    repetitionThresholds: state.settings.repetitionThresholds,
    transitionCountThresholds: state.settings.transitionCountThresholds
  });
}

function cellProgressClass(progressState) {
  return progressState.empty ? "empty" : "progress-cell";
}

function cellProgressStyle(progressState, cellIndex = null) {
  const indexStyle = cellIndex == null ? "" : `--cell-index: ${cellIndex};`;
  if (progressState.empty) return indexStyle ? ` style="${indexStyle}"` : "";
  const progress = Math.round(progressState.progress * 1000) / 10;
  const ink = progressState.progress >= 0.64 ? "#263500" : "#f7f7ef";
  return ` style="--cell-progress: ${progress}%; --cell-ink: ${ink}; ${indexStyle}"`;
}

function countPages(range, target) {
  let count = 0;
  for (let page = range[1]; page <= range[2]; page += 1) if (pageRepetitionLevel(page) === target) count += 1;
  return count;
}

function countHighCountPages(range) {
  let count = 0;
  for (let page = range[1]; page <= range[2]; page += 1) if (["strong", "mastered"].includes(pageRepetitionLevel(page))) count += 1;
  return count;
}

function lowestCountLevel(levels) {
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
  const currentPageData = trackPages.current?.qcf4 || trackPages.current;
  if (currentPageData?.renderer === "qcf4") return collectQcf4AyahKeys(currentPageData);
  const keys = [];
  currentPageData?.lines?.forEach((line) => {
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
  const currentPageData = pageData?.qcf4 || pageData;
  if (currentPageData?.renderer === "qcf4") return collectQcf4AyahKeys(currentPageData);
  const keys = [];
  currentPageData?.lines?.forEach((line) => {
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
  app.querySelector(".page-shell")?.classList.remove("swipe-armed");
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

function cancelPageGesture() {
  const pageShell = app.querySelector(".page-shell");
  if (swipeStart?.pointerId !== undefined) {
    pageShell?.releasePointerCapture?.(swipeStart.pointerId);
  }
  swipeStart = null;
  suppressClickUntil = Date.now() + 350;
  resetTrackState(true);
}

function getRepetitionCount(key) {
  return state.ayahProgress[key]?.repetitionCount || 0;
}

function getTransitionCount(key) {
  return state.transitionProgress[key]?.repetitionCount || 0;
}

function transitionKey(page, from, to) {
  return `${page}|${from}|${to}`;
}

function parseJump(value) {
  return resolveNavigationTarget(value, metadata, PAGE_COUNT)?.page || null;
}

function clearHomeSearch() {
  homeSearch = {
    query: "",
    results: []
  };
}

function updateHomeSearch(query, selection = null) {
  homeSearch = {
    query,
    results: searchNavigationTargets(query, metadata, PAGE_COUNT)
  };
  render();
  if (!selection) return;
  const nextJump = app.querySelector("#jumpInput");
  if (!nextJump) return;
  nextJump.focus();
  nextJump.setSelectionRange(selection.selectionStart, selection.selectionEnd);
}

function pageForAyah(key) {
  return metadata.ayahToPage[key] || route.page;
}

function progressPrompt() {
  return state.practiceEvents.length ? `${state.practiceEvents.length} practice events stored locally.` : "Open a page and tap ayah numbers to start tracking.";
}

function labelAyah(key) {
  const [surah, ayah] = key.split(":");
  return `Surah ${surah}:${ayah}`;
}

function labelTransition(key) {
  const [, from, to] = key.split("|");
  return `${from} -> ${to}`;
}

function formatQueueAyahLabel(label) {
  const compact = label.replace(/^Surah\s+/, "");
  const [surah, ayah] = compact.split(":");
  return `${surah} : ${ayah}`;
}

function formatQueueTransitionLabel(key) {
  const [, from, to] = key.split("|");
  const [surah, fromAyah] = from.split(":");
  const [, toAyah] = to.split(":");
  return `${surah} : ${fromAyah} - ${toAyah}`;
}

function resolveDetailTransition(ayahKey) {
  const transition = resolveOutgoingTransition(ayahKey, metadata);
  if (!transition) return null;
  return {
    key: transition.key,
    path: formatTransitionPath(transition.from, transition.to)
  };
}

function formatTransitionPath(from, to) {
  return `${from.split(":")[1]} - ${to.split(":")[1]}`;
}

function renderCountValue(count, target) {
  return `
    <div class="detail-metric-value-line">
      <strong class="detail-metric-value">${count}</strong>
      <span class="detail-metric-target">/${target}</span>
    </div>
  `;
}

function countColorStyle(count, thresholds) {
  return ` style="--count-color: ${buildCountProgressColor(count, thresholds)}; --count-ink: ${buildCountProgressInkColor(count, thresholds)}"`;
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

function normalizeRouteState(value, fallbackPage = 1) {
  const validTabs = new Set(["progress", "surahs", "bookmarks"]);
  const screen = value?.screen === "reading" || value?.screen === "home" ? value.screen : "home";
  const tab = validTabs.has(value?.tab) ? value.tab : "progress";
  return {
    screen,
    tab,
    page: clampPage(value?.page || fallbackPage),
    target: null
  };
}

function rememberCurrentRoute() {
  state.lastPage = clampPage(route.page);
  state.lastRoute = {
    screen: route.screen === "reading" ? "reading" : "home",
    tab: ["progress", "surahs", "bookmarks"].includes(route.tab) ? route.tab : "progress",
    page: state.lastPage,
    target: null
  };
}

function bindLongPress(el, callback) {
  let timer = null;
  let cleanupPointerEnd = null;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    cleanupPointerEnd?.();
    cleanupPointerEnd = null;
  };
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    clear();
    const pointerId = event.pointerId;
    const clearMatchingPointer = (nextEvent) => {
      if (nextEvent.pointerId === pointerId) clear();
    };
    cleanupPointerEnd = () => {
      document.removeEventListener("pointerup", clearMatchingPointer, true);
      document.removeEventListener("pointercancel", clearMatchingPointer, true);
    };
    document.addEventListener("pointerup", clearMatchingPointer, true);
    document.addEventListener("pointercancel", clearMatchingPointer, true);
    timer = setTimeout(() => {
      timer = null;
      cleanupPointerEnd?.();
      cleanupPointerEnd = null;
      callback();
    }, 520);
  });
  el.addEventListener("pointerleave", clear);
}

function openAyahDetail(button) {
  clearPendingTap();
  cancelPageGesture();
  detailTarget = { kind: "ayah", key: button.dataset.ayah, page: Number(button.dataset.page) };
  render();
}

function clearPendingTap() {
  if (!pendingTap) return;
  clearTimeout(pendingTap.timer);
  pendingTap = null;
}

function unavailableFeedback(key) {
  app.querySelector(`[data-ayah="${CSS.escape(key)}"]`)?.animate([{ transform: "translateX(0)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 140 });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `hifz-trackr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importJson(file) {
  if (!file) return;
  state = mergeStoredState(defaultState, JSON.parse(await file.text()));
  state.lastPage = clampPage(state.lastPage);
  state.lastRoute = normalizeRouteState(state.lastRoute, state.lastPage);
  hasSeedBackup = false;
  settingsOpen = false;
  await clearSeedBackup();
  await saveState();
  render();
}

async function seedTestData() {
  const ok = confirm("Seed developer test data?\n\nThis will replace progress, practice history, recent pages, and bookmarks on this device, but it will keep your settings.");
  if (!ok) return;
  const backup = cloneValue(state);
  state = buildDeveloperSeedState({ ...cloneValue(defaultState), settings: cloneValue(state.settings) }, metadata);
  state.lastPage = clampPage(state.lastPage);
  state.lastRoute = normalizeRouteState(state.lastRoute, state.lastPage);
  hasSeedBackup = true;
  settingsOpen = false;
  settingsError = null;
  render();
  await saveSeedBackup(backup);
  await saveState();
}

async function restoreSeedBackup() {
  const backup = await loadSeedBackup();
  if (!backup) {
    settingsError = "No pre-seed data is available to restore.";
    render();
    return;
  }
  state = mergeStoredState(defaultState, backup);
  state.lastPage = clampPage(state.lastPage);
  state.lastRoute = normalizeRouteState(state.lastRoute, state.lastPage);
  hasSeedBackup = false;
  settingsOpen = false;
  settingsError = null;
  await clearSeedBackup();
  await saveState();
  render();
}

function resetAll() {
  const ok = confirm("Reset all progress?\n\nThis will remove all repetition counts, practice history, recent pages, and bookmarks stored on this device. This cannot be undone.");
  if (!ok) return;
  state = cloneValue(defaultState);
  hasSeedBackup = false;
  addEvent("reset-all", { page: route.page });
  clearSeedBackup();
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
