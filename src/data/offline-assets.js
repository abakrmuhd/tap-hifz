export const CACHE_VERSION = "hifz-trackr-v72-transition-metadata";

export const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/src/app.js?v=2026-07-01-transition-metadata",
  "/src/styles.css?v=2026-07-01-transition-metadata"
];

export const DATA_ASSETS = [
  "/src/data/home-search-view.js?v=2026-06-28-home-search",
  "/src/data/juz.js",
  "/src/data/metadata-logic.js?v=2026-06-28-progress-cell-gradient",
  "/src/data/mushaf-line-fit.js?v=2026-06-26-density-fit-all-3",
  "/src/data/mushaf-metadata.json",
  "/src/data/navigation-logic.js?v=2026-06-28-home-search",
  "/src/data/navigation-metadata.json",
  "/src/data/offline-assets.js",
  "/src/data/reader-halo-logic.js?v=2026-06-27-transition-underline",
  "/src/data/runtime-environment.js",
  "/src/data/detail-logic.js?v=2026-06-27-transition-underline",
  "/src/data/storage.js"
];

export const READER_ASSETS = [
  "/src/reader/qcf4-data.js",
  "/src/reader/qcf4-logic.js",
  "/src/reader/qcf4-renderer.js?v=2026-06-29-surah-title-box",
  "/src/reader/swipe-reveal.js"
];

export const MUSHAF_ASSETS = Array.from(
  { length: 604 },
  (_, index) => `/public/mushaf/page-${String(index + 1).padStart(3, "0")}.json`
);

export const QCF4_MUSHAF_ASSETS = Array.from(
  { length: 604 },
  (_, index) => `/public/mushaf-qcf4/page-${String(index + 1).padStart(3, "0")}.json`
);

export const FONT_ASSETS = [
  "/public/fonts/qcf4/QCF4_QBSML.woff2",
  ...Array.from(
    { length: 47 },
    (_, index) => `/public/fonts/qcf4/QCF4_Hafs_${String(index + 1).padStart(2, "0")}_W.woff2`
  )
];

export const PRECACHE_URLS = [...new Set([
  ...SHELL_ASSETS,
  ...DATA_ASSETS,
  ...READER_ASSETS,
  ...MUSHAF_ASSETS,
  ...QCF4_MUSHAF_ASSETS,
  ...FONT_ASSETS
])];
