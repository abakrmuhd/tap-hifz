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
} from "./data/storage.js";
import {
  buildRevealSurfaceState,
  clampRevealOffset,
  getRevealDirection,
  getRevealPage,
  shouldCommitSwipe
} from "./reader/swipe-reveal.js";

const PAGE_COUNT = 604;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const app = document.querySelector("#app");
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
let currentPageData = null;
let revealedPageData = null;
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
let revealState = {
  direction: null,
  offset: 0,
  dragging: false
};
let prefetchedPages = new Map();

const SWIPE_COMMIT_DISTANCE = 60;
const SWIPE_CANCEL_VERTICAL_LIMIT = 70;
const SWIPE_DRAG_START = 8;
const PAGE_TURN_DURATION = 220;
const PAGE_TURN_EASING = "cubic-bezier(.2, .8, .2, 1)";

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
  state = await loadState();
  document.documentElement.dataset.theme = state.settings.theme;
  const [mushafData, navigationData] = await Promise.all([
    fetchJson("/src/data/mushaf-metadata.json"),
    fetchJson("/src/data/navigation-metadata.json")
  ]);
  metadata = {
    ...mushafData,
    surahs: navigationData.surahs,
    juz: navigationData.juz
  };
  currentPageData = await fetchPage(1);
  revealedPageData = null;
  bindGlobalEvents();
  warmNeighborPages(1).catch(() => {});
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => {});
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

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Missing JSON resource ${path}`);
  return response.json();
}

async function prefetchPage(page) {
  if (page < 1 || page > PAGE_COUNT) return null;
  if (prefetchedPages.has(page)) return prefetchedPages.get(page);
  const data = await fetchPage(page);
  prefetchedPages.set(page, data);
  return data;
}

async function warmNeighborPages(page) {
  const targets = [page - 1, page + 1].filter((item) => item >= 1 && item <= PAGE_COUNT);
  await Promise.all(targets.map((target) => prefetchPage(target).catch(() => null)));
}

async function openPage(page, options = {}) {
  route = { screen: "reading", tab: route.tab, page: clampPage(page), target: options.target || null };
  currentPageData = prefetchedPages.get(route.page) || await fetchPage(route.page);
  revealState = { direction: null, offset: 0, dragging: false };
  revealedPageData = null;
  if (!options.silent) {
    state.recentPages = [route.page, ...state.recentPages.filter((item) => item !== route.page)].slice(0, 20);
    await saveState();
  }
  render();
  warmNeighborPages(route.page).catch(() => {});
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
      kind: "Surah",
      page: surah.startPage,
      title: surah.arabicName,
      sub: `${surah.number}. ${surah.transliteratedName || `Surah ${surah.number}`}`
    })),
    ...metadata.juz.map((juz) => ({ kind: "Juz", page: juz.startPage, title: `Juz ${juz.number}`, sub: "" }))
  ].sort((a, b) => a.page - b.page || (a.kind === "Juz" ? -1 : 1));
  return `
    <h2>Mushaf Order</h2>
    <div class="queue-list">
      ${entries.map((entry) => `
        <button class="list-row" data-page="${entry.page}">
          <span><strong>${entry.title}</strong><small>${entry.sub ? `${entry.sub}, ` : ""}Page ${entry.page}</small></span>
          <span class="type-pill">${entry.kind}</span>
        </button>
      `).join("")}
    </div>
  `;
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
  const page = currentPageData;
  const pageBookmarked = state.pageBookmarks.includes(route.page);
  const activeTarget = resolveReaderTarget();
  const surfaces = buildRevealSurfaceState({
    currentPage: route.page,
    direction: revealState.direction,
    pageCount: PAGE_COUNT
  });
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
        ${renderPageSurface(revealedPageData, surfaces.revealedPage, null, "revealed-page", true)}
        ${renderPageSurface(page, surfaces.activePage, activeTarget, "active-page")}
      </section>
      <p class="swipe-hint">Swipe left for previous page. Swipe right for next page.</p>
      ${undoVisible ? `<button class="floating-undo" data-action="undo" aria-label="Undo last count">${icons.undo}</button>` : ""}
      ${review ? renderReviewBar() : ""}
    </main>
  `;
}

function renderPageSurface(pageData, pageNumber, activeTarget, className, inert = false) {
  if (!pageData || !pageNumber) return "";
  const previousAyahMap = buildPreviousAyahMap(pageData);
  const attributes = [
    `class="page-surface ${className}"`,
    inert ? `aria-hidden="true"` : ""
  ].filter(Boolean).join(" ");
  const lines = pageData?.lines?.map((line) => renderLine(line, activeTarget, { inert, pageNumber, previousAyahMap })).join("") || "";
  return `<div ${attributes}><div class="mushaf" dir="rtl">${lines}</div></div>`;
}

function renderLine(line, activeTarget, options = {}) {
  if (line.type === "surah-header") return `<div class="surah-header">${decodeText(line.text)}</div>`;
  if (line.type === "basmala") return `<div class="basmala">${decodeText(line.qpcV2 || line.text || "")}</div>`;
  const words = line.words || [];
  const fit = words.length > 10 ? "fit-84" : words.length > 8 ? "fit-89" : words.length > 6 ? "fit-93" : "";
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
    isAyahBookmarked: (key) => state.ayahBookmarks.some((item) => item.key === key)
  });
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-label="${detail.title}">
        <header class="modal-head">
          <strong>${detail.title}</strong>
          <button class="icon-btn small" data-action="close-modal" aria-label="Close">${icons.close}</button>
        </header>
        <div class="detail-card">
          <div class="detail-title"><span>${detail.kindLabel}</span><span class="small-pill ${detail.strength}">${titleCase(detail.strength)}</span></div>
          <div class="detail-count">${detail.count}</div>
          <div class="actions">
            <button class="secondary-btn" data-action="decrement-detail">-1</button>
            <button class="danger-btn" data-action="reset-detail">Reset</button>
          </div>
          ${detail.canBookmark ? `<button class="secondary-btn full" data-action="toggle-ayah-bookmark">${detail.bookmarked ? "Remove ayah bookmark" : "Bookmark ayah"}</button>` : ""}
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
    if (event.key === "ArrowLeft") navigatePage(-1);
    if (event.key === "ArrowRight") navigatePage(1);
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

  app.querySelectorAll("button.ayah-mark[data-ayah]").forEach((button) => {
    button.addEventListener("click", () => handleAyahTap(button.dataset.ayah));
    bindLongPress(button, () => { detailTarget = { kind: "ayah", key: button.dataset.ayah, page: Number(button.dataset.page) }; render(); });
  });

  const pageShell = app.querySelector(".page-shell");
  if (pageShell) {
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
      revealState = { direction: null, offset: 0, dragging: false };
      pageShell.setPointerCapture?.(event.pointerId);
    });
    pageShell.addEventListener("pointermove", async (event) => {
      if (!swipeStart || pageNavigationInFlight) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      const direction = getRevealDirection({ dx, dy, startThreshold: SWIPE_DRAG_START });
      if (!direction) return;
      const revealPage = getRevealPage({ currentPage: route.page, direction, pageCount: PAGE_COUNT });
      if (!revealPage) return;
      if (direction !== revealState.direction || !revealedPageData) {
        revealedPageData = await prefetchPage(revealPage).catch(() => null);
        revealState.direction = direction;
        render();
      }
      swipeStart.dragging = true;
      swipeStart.offset = clampRevealOffset(dx, { maxOffset: 120, dragRatio: 0.45 });
      revealState.offset = swipeStart.offset;
      revealState.dragging = true;
      applyRevealVisualState();
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
      if (revealState.direction && shouldCommitSwipe({ dx, dy, commitDistance: SWIPE_COMMIT_DISTANCE, verticalLimit: SWIPE_CANCEL_VERTICAL_LIMIT })) {
        navigatePage(revealState.direction === "next" ? 1 : -1, { dragOffset, useReveal: true });
        return;
      }
      resetRevealState(true);
    });
    pageShell.addEventListener("pointercancel", () => {
      swipeStart = null;
      resetRevealState(true);
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
  if (action === "previous-page") navigatePage(-1);
  if (action === "next-page") navigatePage(1);
  if (action === "toggle-page-bookmark") togglePageBookmark();
  if (action === "undo") undoLast();
  if (action === "decrement-detail") mutateDetail(-1);
  if (action === "reset-detail") resetDetail();
  if (action === "toggle-ayah-bookmark") toggleAyahBookmark();
  if (action === "start-review") startReview();
  if (action === "skip-review") skipReview();
  if (action === "next-review") nextReview();
  if (action === "finish-review") { review = null; goHome("progress"); return; }
  if (action === "export-json") exportJson();
  if (action === "reset-all") resetAll();
  if (!["previous-page", "next-page"].includes(action)) render();
}

async function navigatePage(delta, options = {}) {
  if (pageNavigationInFlight) return;
  const next = route.page + delta;
  const activeSurface = app.querySelector(".active-page");
  if (next < 1 || next > PAGE_COUNT) {
    activeSurface?.animate([{ transform: "translateX(0)" }, { transform: `translateX(${delta > 0 ? 12 : -12}px)` }, { transform: "translateX(0)" }], { duration: 180 });
    if (activeSurface) activeSurface.style.transform = "";
    if (navigator.vibrate && state.settings.vibration !== false) navigator.vibrate(12);
    return;
  }
  pageNavigationInFlight = true;
  try {
    const direction = delta > 0 ? "next" : "previous";
    const nextPageData = prefetchedPages.get(next) || await prefetchPage(next);
    revealState = { direction, offset: Number(options.dragOffset) || 0, dragging: false };
    revealedPageData = nextPageData;
    render();
    const outgoingSurface = app.querySelector(".active-page");
    if (outgoingSurface) {
      const dragOffset = Number(options.dragOffset) || 0;
      await outgoingSurface.animate(
        [
          { transform: `translateX(${dragOffset}px)`, opacity: 1 },
          { transform: `translateX(${delta > 0 ? 100 : -100}%)`, opacity: .72 }
        ],
        { duration: PAGE_TURN_DURATION, easing: PAGE_TURN_EASING }
      ).finished;
      outgoingSurface.style.transform = "";
    }

    route = { screen: "reading", tab: route.tab, page: clampPage(next), target: null };
    currentPageData = nextPageData;
    revealState = { direction: null, offset: 0, dragging: false };
    revealedPageData = null;
    state.recentPages = [route.page, ...state.recentPages.filter((item) => item !== route.page)].slice(0, 20);
    await saveState();
    render();
    warmNeighborPages(route.page).catch(() => {});

    app.querySelector(".active-page")?.animate(
      [
        { transform: `translateX(${delta > 0 ? -100 : 100}%)`, opacity: .72 },
        { transform: "translateX(0)", opacity: 1 }
      ],
      { duration: PAGE_TURN_DURATION, easing: PAGE_TURN_EASING }
    );
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

function resetDetail() {
  if (!detailTarget) return;
  if (detailTarget.kind === "ayah") {
    const count = getAyahCount(detailTarget.key);
    state.ayahProgress[detailTarget.key] = { repetitionCount: 0 };
    addEvent("reset", { ayahKey: detailTarget.key, delta: -count, page: route.page });
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

function applyRevealVisualState() {
  const pageShell = app.querySelector(".page-shell");
  const activeSurface = app.querySelector(".active-page");
  if (!pageShell || !activeSurface) return;
  if (revealState.direction) {
    pageShell.dataset.revealDirection = revealState.direction;
  } else {
    delete pageShell.dataset.revealDirection;
  }
  pageShell.classList.toggle("dragging", revealState.dragging);
  activeSurface.style.transform = revealState.direction ? `translateX(${revealState.offset}px)` : "";
}

function resetRevealState(animateBack = false) {
  const activeSurface = app.querySelector(".active-page");
  const offset = revealState.offset;
  revealState = { direction: null, offset: 0, dragging: false };
  revealedPageData = null;
  if (animateBack && activeSurface && offset) {
    activeSurface.animate(
      [{ transform: `translateX(${offset}px)` }, { transform: "translateX(0)" }],
      { duration: 160, easing: PAGE_TURN_EASING }
    );
  }
  render();
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
