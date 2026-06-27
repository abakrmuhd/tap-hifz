const app = document.querySelector("#app");
const STARTUP_ASSET_VERSION = "2026-06-27-qcf4-renderer";
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function renderStartupError(error) {
  if (!app) return;
  app.innerHTML = `
    <main class="app-shell home-shell">
      <div class="detail-card">
        <div class="detail-title"><span>Module startup error</span></div>
        <pre class="fatal-error">${escapeHtml(error?.stack || error?.message || String(error))}</pre>
      </div>
    </main>
  `;
}

globalThis.addEventListener("error", (event) => {
  if (event.error) renderStartupError(event.error);
});

async function clearLocalDevCaches() {
  if (!LOCALHOST_HOSTNAMES.has(globalThis.location?.hostname || "")) return;
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
  }
  if ("caches" in globalThis) {
    const keys = await caches.keys().catch(() => []);
    await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
  }
}

clearLocalDevCaches()
  .catch(() => {})
  .then(() => import(`/src/app.js?v=${STARTUP_ASSET_VERSION}`))
  .catch(renderStartupError);
