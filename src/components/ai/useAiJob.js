import { useCallback, useEffect, useState } from "react";
import { getAiStatus, peekAi, runAi } from "../../services/aiService";

/**
 * Runs a Claude job on demand. Never calls Claude automatically: on mount it
 * only shows an answer already cached in this browser for the same data.
 */
export function useAiJob(task, input) {
  const inputKey = input ? JSON.stringify(input) : "";
  const [state, setState] = useState(() => ({
    status: "idle",
    response: input ? peekAi(task, input) : null,
    error: null,
    inputKey,
  }));
  const [aiStatus, setAiStatus] = useState(null);

  // Data changed: show the cached answer for the new data, if any.
  if (state.inputKey !== inputKey && state.status !== "loading") {
    setState({ status: "idle", response: input ? peekAi(task, input) : null, error: null, inputKey });
  }

  useEffect(() => {
    let alive = true;
    getAiStatus().then((status) => {
      if (alive) setAiStatus(status);
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(
    async ({ force = false } = {}) => {
      if (!input) return null;
      setState((prev) => ({ ...prev, status: "loading", error: null }));
      try {
        const response = await runAi(task, input, { force });
        setState({ status: "done", response, error: null, inputKey });
        return response;
      } catch (error) {
        setState((prev) => ({ ...prev, status: "error", error }));
        return null;
      }
    },
    // inputKey captures the input's content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, inputKey]
  );

  return { ...state, run, aiStatus };
}

export function describeUsage(response) {
  if (!response) return "";
  if (response.fromBrowserCache) return "Saved answer, no tokens used";
  if (response.cached) return "Served from server cache, no tokens used";
  const usage = response.usage || {};
  const total = (usage.inputTokens || 0) + (usage.outputTokens || 0) + (usage.cacheReadTokens || 0);
  return `${total.toLocaleString()} tokens${usage.cacheReadTokens ? ` (${usage.cacheReadTokens.toLocaleString()} cached)` : ""}`;
}
