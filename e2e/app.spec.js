import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { insightsFixture, loadSample, mockClaude, trackErrors } from "./helpers";

test.describe("first run and navigation", () => {
  test("new user creates a project and a task from scratch", async ({ page }) => {
    const errors = trackErrors(page);
    await mockClaude(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Let's set up your first project" })).toBeVisible();
    await page.getByRole("button", { name: "Create a project" }).click();

    const dialog = page.getByRole("dialog", { name: "New project" });
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Give the project a name.");

    await dialog.getByLabel("Project name").fill("Office move");
    await dialog.getByLabel("Owner").fill("Sam");
    await dialog.getByLabel("Start date").fill("2026-01-05");
    await dialog.getByLabel("Target end date").fill("2026-01-02");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog.getByRole("alert")).toContainText("end date");
    await dialog.getByLabel("Target end date").fill("2026-02-27");
    await dialog.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/planner\?projectId=.+&tab=schedule/);
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue(/project-/);

    await page.getByTestId("add-task").click();
    const taskDialog = page.getByRole("dialog", { name: "Add a task" });
    await taskDialog.getByLabel("Task name").fill("Book movers");
    await taskDialog.getByLabel("Assigned to").fill("Sam");
    await taskDialog.getByLabel("Start").fill("2026-01-12");
    await taskDialog.getByLabel("Due").fill("2026-01-16");
    await taskDialog.getByRole("button", { name: "Save & add another" }).click();
    await taskDialog.getByLabel("Task name").fill("Pack archive");
    await taskDialog.getByRole("button", { name: "Add task" }).click();
    await expect(taskDialog).toBeHidden();

    await expect(page.getByRole("textbox", { name: "Task name" })).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: "Task name" }).first()).toHaveValue("Book movers");

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await expect(page.getByTestId("project-card")).toContainText("Office move");

    await page.reload();
    await expect(page.getByTestId("project-card")).toContainText("Office move");
    errors.assertNone();
  });

  test("every main page and planner tab renders", async ({ page }) => {
    const errors = trackErrors(page);
    await mockClaude(page);
    await loadSample(page);

    for (const name of ["Planner", "Ask Claude", "Import & Export", "Help & Guide", "Dashboard"]) {
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
      await expect(page.locator("main h1, main select#planner-project").first()).toBeVisible();
    }

    await page.getByTestId("project-card").filter({ hasText: "Website Relaunch" }).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: "Website Relaunch", exact: true })).toBeVisible();

    for (const tab of ["Schedule", "Board", "Timeline", "Sprints", "People", "Documents", "Reports", "Overview"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByTestId("tab-hint")).not.toBeEmpty();
    }
    errors.assertNone();
  });

  test("command palette finds tasks and jumps to them", async ({ page }) => {
    await mockClaude(page);
    await loadSample(page);
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Search and commands" });
    await palette.getByRole("combobox").fill("SEO");
    await palette.getByRole("option", { name: /SEO redirects/ }).click();
    await expect(page).toHaveURL(/tab=schedule&taskId=/);
    await expect(page.locator('input[value="SEO redirects and metadata"]')).toBeVisible();
  });

  test("mobile menu navigates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockClaude(page);
    await loadSample(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Help & Guide" }).click();
    await expect(page.getByRole("heading", { name: "How to use Project Planner" })).toBeVisible();
  });
});

test.describe("planning", () => {
  test("needs-attention item opens the late task", async ({ page }) => {
    await mockClaude(page);
    await loadSample(page);
    await page.getByRole("button", { name: /Map fields to CRM objects/ }).click();
    await expect(page).toHaveURL(/tab=schedule&taskId=/);
    await expect(page.getByLabel("Project", { exact: true })).toHaveValue(/project-/);
  });

  test("editing a cell keeps dependencies and dates (regression)", async ({ page }) => {
    await mockClaude(page);
    await loadSample(page);
    await page.getByTestId("project-card").filter({ hasText: "CRM Migration" }).getByRole("link", { name: "Open" }).click();
    await page.getByRole("tab", { name: "Schedule" }).click();

    const readTask = (title) =>
      page.evaluate((taskTitle) => {
        const key = Object.keys(localStorage).find((k) => k.startsWith("gantt-planner-data-v1-local"));
        return JSON.parse(localStorage.getItem(key)).tasks.find((task) => task.title === taskTitle);
      }, title);

    const before = await readTask("Load data into CRM");
    expect(before.dependencyIds).toHaveLength(1);

    const row = page.getByRole("row").filter({ has: page.locator('input[value="Load data into CRM"]') });
    const owner = row.locator("td").nth(9).locator("input");
    await owner.fill("Priya");
    await owner.press("Enter");
    await expect.poll(async () => (await readTask("Load data into CRM")).owner).toBe("Priya");

    const after = await readTask("Load data into CRM");
    expect(after.dependencyIds).toEqual(before.dependencyIds);
    expect(after.plannedStart).toBe(before.plannedStart);
    expect(after.plannedEnd).toBe(before.plannedEnd);
  });

  test("board quick actions change status", async ({ page }) => {
    await mockClaude(page);
    await loadSample(page);
    await page.goto("/planner?tab=board");
    const card = page.locator("div[draggable=true]").filter({ hasText: "Train the sales team" });
    await card.getByRole("button", { name: "Start" }).click();
    await expect(page.locator("div[draggable=true]").filter({ hasText: "Train the sales team" }).getByRole("button", { name: "Start" })).toHaveCount(0);
  });

  test("sprints and documents are managed in dialogs", async ({ page }) => {
    const errors = trackErrors(page);
    await mockClaude(page);
    await loadSample(page);
    await page.getByTestId("project-card").filter({ hasText: "Website Relaunch" }).getByRole("link", { name: "Open" }).click();

    await page.getByRole("tab", { name: "Sprints" }).click();
    await page.getByRole("button", { name: "New sprint" }).click();
    const sprintDialog = page.getByRole("dialog", { name: "New sprint" });
    await sprintDialog.getByLabel("Sprint name").fill("Sprint 4 - Launch");
    await sprintDialog.getByLabel("Start date").fill("2026-10-18");
    await sprintDialog.getByLabel("End date").fill("2026-10-31");
    await sprintDialog.getByRole("button", { name: "Create sprint" }).click();
    await expect(page.getByRole("heading", { name: "Sprint 4 - Launch" })).toBeVisible();

    await page.getByRole("tab", { name: "Documents" }).click();
    await page.getByRole("button", { name: "Add document" }).click();
    const docDialog = page.getByRole("dialog", { name: "Add document" });
    await docDialog.getByLabel("Title").fill("Launch checklist");
    await docDialog.getByLabel("Link").fill("not a url");
    await docDialog.getByRole("button", { name: "Add document" }).click();
    await expect(docDialog.getByRole("alert")).toContainText("http");
    await docDialog.getByLabel("Link").fill("https://example.com/checklist");
    await docDialog.getByRole("button", { name: "Add document" }).click();
    await expect(page.getByRole("link", { name: /Launch checklist/ })).toHaveAttribute("href", "https://example.com/checklist");

    await page.getByRole("tab", { name: "Reports" }).click();
    for (const view of ["Analysis", "Baselines", "Dependencies", "Status reports"]) {
      await page.getByRole("radio", { name: view }).click();
      await expect(page.getByRole("radio", { name: view })).toHaveAttribute("aria-checked", "true");
    }
    errors.assertNone();
  });

  test("deleting a project asks for confirmation", async ({ page }) => {
    await mockClaude(page);
    await loadSample(page);
    const card = page.getByTestId("project-card").filter({ hasText: "CRM Migration" });
    await card.getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(2);

    await card.getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
  });
});

test.describe("import and export", () => {
  test("imports a Jira-style CSV with automatic column matching", async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    await mockClaude(page);
    await page.goto("/data");

    const csv = [
      "Issue key,Summary,Status,Assignee,Priority,Created,Due date,Epic Link",
      "APP-1,Login page,Done,Ann,High,03/02/2026,13/02/2026,Auth",
      'APP-2,"Password reset, with email",In Review,Bo,Medium,16/02/2026,20/02/2026,Auth',
      "APP-3,Billing page,To Do,,Low,23/02/2026,06/03/2026,",
    ].join("\n");
    const file = testInfo.outputPath("jira.csv");
    await fs.writeFile(file, csv);

    await page.getByTestId("import-file-input").setInputFiles(file);
    await expect(page.getByTestId("import-review")).toBeVisible();
    await expect(page.getByLabel("Field for Summary")).toHaveValue("title");
    await expect(page.getByLabel("Field for Due date")).toHaveValue("plannedEnd");
    await expect(page.getByLabel("Field for Epic Link")).toHaveValue("parent");
    await expect(page.getByTestId("import-stats")).toContainText("4 tasks");

    await page.getByTestId("import-confirm").click();
    await expect(page).toHaveURL(/\/planner\?projectId=.+&tab=schedule/);
    await expect(page.getByLabel("Project", { exact: true }).locator("option:checked")).toHaveText("Jira");
    await expect(page.locator('input[value="Password reset, with email"]')).toBeVisible();
    errors.assertNone();
  });

  test("full backup exports and restores", async ({ page }, testInfo) => {
    await mockClaude(page);
    await loadSample(page);
    await page.goto("/data");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-json").click();
    const download = await downloadPromise;
    const backup = testInfo.outputPath("backup.json");
    await download.saveAs(backup);
    const parsed = JSON.parse(await fs.readFile(backup, "utf8"));
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.weeklyReports).toHaveLength(1);

    for (const id of ["export-xlsx", "export-csv", "export-msproject", "export-ics"]) {
      const pending = page.waitForEvent("download");
      await page.getByTestId(id).click();
      expect((await pending).suggestedFilename()).toMatch(/^workspace-\d{4}-\d{2}-\d{2}\./);
    }

    await page.getByTestId("import-file-input").setInputFiles(backup);
    await page.getByRole("radio", { name: /Replace my workspace/ }).check();
    await page.getByTestId("import-confirm").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await page.goto("/");
    await expect(page.getByTestId("project-card")).toHaveCount(2);
  });
});

test.describe("Claude", () => {
  test("dashboard briefing runs on request and is cached", async ({ page }) => {
    const calls = await mockClaude(page);
    await loadSample(page);
    expect(calls).toHaveLength(0);

    await page.getByTestId("ai-briefing-run").click();
    await expect(page.getByTestId("ai-insights")).toContainText("Field mapping blocked");
    expect(calls).toHaveLength(1);
    expect(calls[0].task).toBe("portfolio_insights");
    expect(JSON.stringify(calls[0].input)).not.toContain("task-sample");

    await page.reload();
    await expect(page.getByTestId("ai-insights")).toBeVisible();
    await expect(page.getByTestId("ai-insight-card")).toContainText("Saved answer, no tokens used");
    expect(calls).toHaveLength(1);
  });

  test("answers questions, drafts plans and weekly reports", async ({ page }) => {
    const calls = await mockClaude(page);
    await loadSample(page);
    await page.goto("/assistant");

    await page.getByRole("button", { name: "What are the biggest risks this week?" }).click();
    await expect(page.getByText("Hannah Weber has the most open work.")).toBeVisible();

    await page.getByLabel("Project name").fill("Feedback portal");
    await page.getByLabel("Project brief").fill("Build a customer feedback portal with SSO and voting, two developers, live next quarter.");
    await page.getByRole("button", { name: "Draft plan" }).click();
    await expect(page.getByTestId("plan-preview")).toContainText("3 tasks in 2 phases");
    await page.getByTestId("plan-apply").click();
    await expect(page).toHaveURL(/tab=schedule/);
    await expect(page.locator('input[value="Build portal"]')).toBeVisible();
    await expect(page.locator('input[value="Discovery"]')).toBeVisible();

    await page.getByLabel("Project", { exact: true }).selectOption({ label: "CRM Migration" });
    await page.getByRole("tab", { name: "Reports" }).click();
    await page.getByTestId("ai-draft-report").click();
    await expect(page.getByText(/Claude drafted the summary/)).toBeVisible();

    expect(calls.map((call) => call.task)).toEqual(["ask", "generate_plan", "weekly_report"]);
  });

  test("briefing and chat fit the screen; the question box needs no page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const longBriefing = {
      ...insightsFixture,
      risks: Array.from({ length: 6 }, (_, i) => ({ ...insightsFixture.risks[0], title: `Risk ${i + 1}` })),
      recommendations: Array.from({ length: 5 }, (_, i) => ({ ...insightsFixture.recommendations[0], action: `Action ${i + 1}` })),
    };
    await mockClaude(page, { onPost: (body) => (body.task === "ask" ? "Short answer." : longBriefing) });
    await loadSample(page);
    await page.goto("/assistant");
    await page.getByTestId("ai-briefing-run").click();
    await expect(page.getByText("Action 5")).toBeAttached();

    const input = page.getByLabel("Your question");
    await expect(input).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await input.fill("Any risks?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Short answer.")).toBeVisible();
    await expect(input).toBeInViewport();
  });

  test("explains clearly when Claude is not configured", async ({ page }) => {
    const calls = await mockClaude(page, { configured: false });
    await loadSample(page);
    await expect(page.getByText("Claude isn't connected yet.")).toBeVisible();
    await page.goto("/assistant");
    await expect(page.getByRole("button", { name: "Ask" })).toBeDisabled();
    await page.getByRole("link", { name: "How to enable it" }).first().click();
    await expect(page.getByRole("heading", { name: "About Claude" })).toBeVisible();
    expect(calls).toHaveLength(0);
  });
});
