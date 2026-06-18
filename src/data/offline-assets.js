export const CACHE_VERSION = "tap-hifz-v12";

export const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/src/app.js",
  "/src/styles.css"
];

export const DATA_ASSETS = [
  "/src/data/juz.js",
  "/src/data/metadata-logic.js",
  "/src/data/mushaf-metadata.json",
  "/src/data/navigation-logic.js",
  "/src/data/navigation-metadata.json",
  "/src/data/offline-assets.js",
  "/src/data/storage.js"
];

export const MUSHAF_ASSETS = Array.from(
  { length: 604 },
  (_, index) => `/public/mushaf/page-${String(index + 1).padStart(3, "0")}.json`
);

export const PRECACHE_URLS = [...new Set([...SHELL_ASSETS, ...DATA_ASSETS, ...MUSHAF_ASSETS])];
