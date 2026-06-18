export const APP_DB_NAME = "tap-hifz";
export const APP_DB_VERSION = 1;
export const APP_STORE_NAME = "app-state";
export const APP_STATE_KEY = "tap-hifz-app-state";
export const LEGACY_LOCAL_STORAGE_KEY = "tap-hifz-state";

const cloneValue = globalThis.structuredClone
  ? (value) => globalThis.structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

export function mergeStoredState(base, value) {
  return {
    ...cloneValue(base),
    ...value,
    settings: {
      ...base.settings,
      ...(value?.settings || {}),
      ayahThresholds: { ...base.settings.ayahThresholds, ...(value?.settings?.ayahThresholds || {}) },
      transitionThresholds: { ...base.settings.transitionThresholds, ...(value?.settings?.transitionThresholds || {}) }
    }
  };
}

export function selectInitialStateSource({ indexedState, legacyRawState, defaultState }) {
  if (indexedState) {
    return { source: APP_STATE_KEY, state: mergeStoredState(defaultState, indexedState) };
  }

  if (legacyRawState) {
    return {
      source: LEGACY_LOCAL_STORAGE_KEY,
      state: mergeStoredState(defaultState, JSON.parse(legacyRawState))
    };
  }

  return { source: "default", state: cloneValue(defaultState) };
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function canUseLocalStorage() {
  return typeof localStorage !== "undefined";
}

function openStateDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_DB_NAME, APP_DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_STORE_NAME)) db.createObjectStore(APP_STORE_NAME);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function withStore(mode, task) {
  return openStateDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(APP_STORE_NAME, mode);
    const store = transaction.objectStore(APP_STORE_NAME);
    let result;

    transaction.addEventListener("complete", () => {
      db.close();
      resolve(result);
    });
    transaction.addEventListener("error", () => {
      db.close();
      reject(transaction.error);
    });
    transaction.addEventListener("abort", () => {
      db.close();
      reject(transaction.error);
    });

    result = task(store);
  }));
}

async function readIndexedState() {
  const request = await withStore("readonly", (store) => store.get(APP_STATE_KEY));
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function writeIndexedState(state) {
  const request = await withStore("readwrite", (store) => store.put(state, APP_STATE_KEY));
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function loadPersistedState(defaultState) {
  let indexedState = null;
  if (canUseIndexedDb()) {
    try {
      indexedState = await readIndexedState();
    } catch {
      indexedState = null;
    }
  }

  const legacyRawState = canUseLocalStorage() ? localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY) : null;
  const selected = selectInitialStateSource({ indexedState, legacyRawState, defaultState });

  if (selected.source === LEGACY_LOCAL_STORAGE_KEY && canUseIndexedDb()) {
    try {
      await writeIndexedState(selected.state);
      if (canUseLocalStorage()) localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    } catch {
      if (canUseLocalStorage()) {
        localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(selected.state));
      }
    }
  }

  return selected.state;
}

export async function savePersistedState(state) {
  if (canUseIndexedDb()) {
    try {
      await writeIndexedState(state);
      return;
    } catch {
      // Fall back to localStorage below.
    }
  }

  if (canUseLocalStorage()) localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(state));
}
