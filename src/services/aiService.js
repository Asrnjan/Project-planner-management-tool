import { supabase } from "../lib/supabaseClient";

// Browser side of the Claude integration.
// - Answers are cached in this browser, so asking the same thing about the
//   same data again costs nothing. "Refresh" bypasses the cache.
// - Identical requests already in flight are shared, not repeated.
// - Token usage is tallied locally so people can see what AI costs them.

const ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || "/api/ai";
const CACHE_KEY = "pm-ai-cache-v1";
const USAGE_KEY = "pm-ai-usage-v1";
const MAX_ENTRIES = 40;
const TTL_MS = {
  ask: 60 * 60 * 1000,
  default: 24 * 60 * 60 * 1000,
};

const inFlight = new Map();

export class AiError extends Error {
  constructor(message, code = "error", status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Small, fast, non-cryptographic hash (FNV-1a) for cache keys. */
export function hashKey(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36) + text.length.toString(36);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: caching is an optimisation only.
  }
}

function readCached(key, task) {
  const cache = readJson(CACHE_KEY, {});
  const entry = cache[key];
  if (!entry) return null;
  const ttl = TTL_MS[task] || TTL_MS.default;
  if (Date.now() - entry.at > ttl) return null;
  return entry;
}

function writeCached(key, value) {
  const cache = readJson(CACHE_KEY, {});
  cache[key] = { at: Date.now(), value };
  const keys = Object.keys(cache).sort((a, b) => cache[a].at - cache[b].at);
  while (keys.length > MAX_ENTRIES) delete cache[keys.shift()];
  writeJson(CACHE_KEY, cache);
}

export function clearAiCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

function recordUsage(usage) {
  if (!usage) return;
  const month = new Date().toISOString().slice(0, 7);
  const stats = readJson(USAGE_KEY, {});
  const current = stats.month === month ? stats : { month, requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  current.requests += 1;
  current.inputTokens += usage.inputTokens || 0;
  current.outputTokens += usage.outputTokens || 0;
  current.cacheReadTokens += usage.cacheReadTokens || 0;
  writeJson(USAGE_KEY, current);
}

export function getUsageThisMonth() {
  const month = new Date().toISOString().slice(0, 7);
  const stats = readJson(USAGE_KEY, {});
  return stats.month === month
    ? stats
    : { month, requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
}

async function authHeader() {
  if (!supabase) return {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

let statusPromise = null;

/** Asks the server whether Claude is configured. Cached for the session. */
export function getAiStatus({ refresh = false } = {}) {
  if (!statusPromise || refresh) {
    statusPromise = fetch(ENDPOINT, { method: "GET" })
      .then(async (response) => {
        // Only a JSON answer with "configured" proves the AI server is
        // there. A dev proxy error or the static site's HTML page does not.
        const body = await response.json().catch(() => null);
        if (!response.ok || !body || typeof body.configured !== "boolean") {
          return { configured: false, reachable: false };
        }
        return { reachable: true, ...body };
      })
      .catch(() => ({ configured: false, reachable: false }));
  }
  return statusPromise;
}

/**
 * Runs one Claude job.
 * @param {string} task  one of the server's fixed jobs
 * @param {object} input compact data for that job
 * @param {{ force?: boolean }} options force skips the browser cache
 */
export async function runAi(task, input, { force = false } = {}) {
  const key = `${task}:${hashKey(stableStringify(input))}`;

  if (!force) {
    const cached = readCached(key, task);
    if (cached) {
      return { ...cached.value, fromBrowserCache: true, cachedAt: cached.at };
    }
  }

  if (inFlight.has(key)) return inFlight.get(key);

  const request = (async () => {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ task, input }),
      });
    } catch {
      throw new AiError("Could not reach the server. Check your connection.", "network");
    }

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const fallback =
        response.status === 404
          ? "The Claude endpoint is not deployed. See the README section on enabling Claude."
          : "Claude request failed.";
      throw new AiError(body.error || fallback, body.code || "error", response.status);
    }

    if (!body.cached) recordUsage(body.usage);
    writeCached(key, body);
    return { ...body, fromBrowserCache: false, cachedAt: Date.now() };
  })();

  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}

/** Returns a cached answer without calling Claude, or null. */
export function peekAi(task, input) {
  const key = `${task}:${hashKey(stableStringify(input))}`;
  const cached = readCached(key, task);
  return cached ? { ...cached.value, fromBrowserCache: true, cachedAt: cached.at } : null;
}
