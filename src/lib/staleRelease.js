import { flushPendingCloudSave } from "../store/usePlannerStore";

// After a new release, a tab opened earlier may ask for code files that the
// release replaced ("Failed to fetch dynamically imported module"). Reloading
// fetches the new version. Pending changes are saved first, and a short
// guard prevents a reload loop if the files are genuinely unreachable.

const RELOAD_KEY = "pm-stale-release-reload";
const GUARD_MS = 30_000;

export function isStaleReleaseError(error) {
  const message = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message
  );
}

/** Reloads once to pick up the new release. Returns false if it just did. */
export function reloadForNewRelease() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage we still reload once; the browser keeps us from looping
    // because the reloaded page has the new file names.
  }
  flushPendingCloudSave()
    .catch(() => {})
    .finally(() => window.location.reload());
  return true;
}

export function installStaleReleaseHandler() {
  // Vite fires this when a lazily loaded page's files can't be fetched.
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewRelease()) event.preventDefault();
  });
}
