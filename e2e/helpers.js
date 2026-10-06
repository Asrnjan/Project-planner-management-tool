import { expect } from "@playwright/test";

/** Fails the test on any browser error except blocked web fonts. */
export function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR_|Failed to load resource/.test(text)) return;
    errors.push(text);
  });
  return {
    assertNone: () => expect(errors, errors.join("\n")).toEqual([]),
  };
}

export const insightsFixture = {
  headline: "CRM Migration is slipping because field mapping is blocked.",
  verdict: "at_risk",
  summary: "Website Relaunch is close to plan; CRM Migration is behind.",
  risks: [{ title: "Field mapping blocked", detail: "Waiting for CRM admin licence.", severity: "high", project: "CRM Migration" }],
  recommendations: [{ action: "Escalate the licence request", reason: "It blocks three tasks.", when: "today" }],
  positives: ["Design signed off"],
};

/** Mocks /api/ai. `configured: false` simulates a server without an API key. */
export async function mockClaude(page, { configured = true, onPost } = {}) {
  const calls = [];
  await page.route("**/api/ai", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ json: { configured, model: "claude-opus-5-5", effort: "low" } });
    }
    const body = request.postDataJSON();
    calls.push(body);
    const usage = { inputTokens: 800, outputTokens: 250, cacheReadTokens: 400, cacheWriteTokens: 0 };
    const results = {
      portfolio_insights: insightsFixture,
      project_insights: insightsFixture,
      ask: "- Map fields to CRM objects is 4 days late.\n- Hannah Weber has the most open work.",
      weekly_report: {
        overallStatus: "Amber",
        executiveSummary: "Drafted summary from Claude.",
        achievements: "- Export finished",
        nextWeekPlan: "- Load data",
        risks: "- Licence delay",
        issues: "None",
        mitigationPlan: "- Escalate",
        confidenceLevel: "Medium",
      },
      generate_plan: {
        tasks: [
          { key: "T1", title: "Gather requirements", phase: "Discovery", durationDays: 3, dependsOn: [], isMilestone: false, priority: "High" },
          { key: "T2", title: "Requirements sign-off", phase: "Discovery", durationDays: 1, dependsOn: ["T1"], isMilestone: true, priority: "High" },
          { key: "T3", title: "Build portal", phase: "Delivery", durationDays: 10, dependsOn: ["T2"], isMilestone: false, priority: "Medium" },
        ],
      },
      map_columns: { mappings: [] },
    };
    const result = onPost ? onPost(body) : results[body.task];
    return route.fulfill({ json: { task: body.task, result, model: "claude-opus-5-5", usage, cached: false } });
  });
  return calls;
}

export async function loadSample(page) {
  await page.goto("/");
  await page.getByTestId("load-sample").click();
  await expect(page.getByTestId("project-card")).toHaveCount(2);
}
