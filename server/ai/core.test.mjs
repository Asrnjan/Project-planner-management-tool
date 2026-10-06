import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_TASKS,
  buildRequestParams,
  createAnthropicClient,
  checkRateLimit,
  handleAiRequest,
  resetAiStateForTests,
} from "./core.mjs";

const ENV = { ANTHROPIC_API_KEY: "test-key" };

function fakeClient(responseText, extra = {}) {
  const message = {
    model: "claude-opus-5-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: responseText }],
    usage: { input_tokens: 900, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    ...extra,
  };
  const create = vi.fn().mockResolvedValue(message);
  return { create, client: { messages: { create }, beta: { messages: { create } } } };
}

const insights = JSON.stringify({ headline: "h", verdict: "at_risk", summary: "s", risks: [], recommendations: [], positives: [] });

beforeEach(() => resetAiStateForTests());
afterEach(() => vi.restoreAllMocks());

describe("buildRequestParams", () => {
  it("uses the default model, low effort, caching and a JSON schema", () => {
    const params = buildRequestParams("portfolio_insights", { a: 1 }, {});
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBe(AI_TASKS.portfolio_insights.maxTokens);
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.messages[0].content).toContain("<data>");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
  });

  it("drops effort and fallbacks for models that do not support them", () => {
    const params = buildRequestParams("ask", { q: 1 }, { AI_MODEL: "claude-haiku-4-5" });
    expect(params.output_config).toBeUndefined();
    expect(params.fallbacks).toBeUndefined();
  });

  it("keeps the system prompt identical across requests so it can be cached", () => {
    const a = buildRequestParams("project_insights", { x: 1 }, {});
    const b = buildRequestParams("project_insights", { x: 2 }, {});
    expect(a.system).toEqual(b.system);
  });

  it("uses only schema features structured outputs supports", () => {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      expect(node).not.toHaveProperty("minLength");
      expect(node).not.toHaveProperty("maximum");
      if (node.type === "object") expect(node.additionalProperties).toBe(false);
      Object.values(node).forEach(walk);
    };
    Object.values(AI_TASKS).forEach((task) => walk(task.schema));
  });
});

describe("handleAiRequest", () => {
  it("explains when the API key is missing", async () => {
    const result = await handleAiRequest({ body: { task: "ask", input: {} }, env: {} });
    expect(result.status).toBe(503);
    expect(result.body.code).toBe("not_configured");
  });

  it("rejects unknown jobs, bad input and oversized input", async () => {
    const { client } = fakeClient("x");
    expect((await handleAiRequest({ body: { task: "write_poem", input: {} }, env: ENV, client })).status).toBe(400);
    expect((await handleAiRequest({ body: { task: "ask" }, env: ENV, client })).status).toBe(400);
    const big = { blob: "x".repeat(30_000) };
    expect((await handleAiRequest({ body: { task: "ask", input: big }, env: ENV, client })).status).toBe(413);
  });

  it("returns parsed JSON and usage, then serves repeats from cache", async () => {
    const { client, create } = fakeClient(insights);
    const request = { body: { task: "portfolio_insights", input: { p: 1 } }, env: ENV, client, ip: "1.1.1.1" };

    const first = await handleAiRequest(request);
    expect(first.status).toBe(200);
    expect(first.body.result.verdict).toBe("at_risk");
    expect(first.body.usage).toMatchObject({ inputTokens: 900, outputTokens: 300 });
    expect(first.body.cached).toBe(false);

    const second = await handleAiRequest(request);
    expect(second.body.cached).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("calls the beta endpoint with fallbacks for the default model", async () => {
    const { client, create } = fakeClient(insights);
    await handleAiRequest({ body: { task: "project_insights", input: { p: 2 } }, env: ENV, client });
    expect(create.mock.calls[0][0]).toMatchObject({ fallbacks: "default", model: "claude-opus-5-5" });
  });

  it("returns plain text for the ask job", async () => {
    const { client } = fakeClient("Two tasks are late.");
    const result = await handleAiRequest({ body: { task: "ask", input: { question: "q" } }, env: ENV, client });
    expect(result.body.result).toBe("Two tasks are late.");
  });

  it("handles refusals, truncation and malformed output", async () => {
    let { client } = fakeClient("", { stop_reason: "refusal" });
    expect((await handleAiRequest({ body: { task: "ask", input: { a: 1 } }, env: ENV, client })).status).toBe(422);

    ({ client } = fakeClient('{"headline":', { stop_reason: "max_tokens" }));
    expect((await handleAiRequest({ body: { task: "portfolio_insights", input: { a: 2 } }, env: ENV, client })).body.code).toBe("truncated");

    ({ client } = fakeClient("not json"));
    expect((await handleAiRequest({ body: { task: "portfolio_insights", input: { a: 3 } }, env: ENV, client })).body.code).toBe("bad_output");
  });

  it("requires a signed-in Supabase user when Supabase is configured", async () => {
    const { client } = fakeClient(insights);
    const env = { ...ENV, SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const anonymous = await handleAiRequest({ body: { task: "ask", input: { a: 1 } }, env, client });
    expect(anonymous.status).toBe(401);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }));
    const signedIn = await handleAiRequest({
      body: { task: "ask", input: { a: 1 } },
      headers: { authorization: "Bearer token" },
      env,
      client,
    });
    expect(signedIn.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://x.supabase.co/auth/v1/user");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    const badToken = await handleAiRequest({
      body: { task: "ask", input: { a: 2 } },
      headers: { authorization: "Bearer expired" },
      env,
      client,
    });
    expect(badToken.status).toBe(401);
  });
});

describe("createAnthropicClient", () => {
  async function capturedHeaders(env) {
    let headers;
    const fetchStub = async (_url, init) => {
      headers = new Headers(init.headers);
      return new Response(
        JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const client = createAnthropicClient(env, { fetch: fetchStub, maxRetries: 0 });
    await client.messages.create({ model: "claude-opus-5-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }] });
    return headers;
  }

  it("sends the workspace id when ANTHROPIC_WORKSPACE_ID is set", async () => {
    const headers = await capturedHeaders({ ANTHROPIC_API_KEY: "k", ANTHROPIC_WORKSPACE_ID: " wrkspc_123 " });
    expect(headers.get("anthropic-workspace-id")).toBe("wrkspc_123");
    expect(headers.get("x-api-key")).toBe("k");
  });

  it("sends no workspace header otherwise", async () => {
    const headers = await capturedHeaders({ ANTHROPIC_API_KEY: "k" });
    expect(headers.get("anthropic-workspace-id")).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("limits per window and per day", () => {
    const env = { AI_RATE_LIMIT_PER_10_MIN: "2", AI_DAILY_LIMIT: "3" };
    const t0 = 1_000_000_000_000;
    expect(checkRateLimit("u", env, t0).ok).toBe(true);
    expect(checkRateLimit("u", env, t0 + 1).ok).toBe(true);
    expect(checkRateLimit("u", env, t0 + 2).ok).toBe(false);
    expect(checkRateLimit("u", env, t0 + 11 * 60 * 1000).ok).toBe(true);
    expect(checkRateLimit("u", env, t0 + 22 * 60 * 1000).ok).toBe(false);
    expect(checkRateLimit("other", env, t0).ok).toBe(true);
  });
});
