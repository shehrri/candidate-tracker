import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import writeXlsxFile from "write-excel-file/universal";
import { readSheet } from "read-excel-file/universal";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
async function addCandidate(page: any, first = "Test", last = "Recruit") {
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .first()
    .click();
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last name").fill(last);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${first.toLowerCase()}@example.invalid`);
  await page.getByLabel("Primary skills").fill("React TypeScript");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function navigate(page: any, name: string) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
test("candidate, job, independent application, interview, attachment, backup and persistence", async ({
  page,
}) => {
  await addCandidate(page);
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  await page.getByLabel("Job title").fill("Test Engineer");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Pipeline");
  await page.getByRole("button", { name: "Add application" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Candidate")
    .selectOption({ label: "Test Recruit · test@example.invalid" });
  await page
    .getByRole("dialog")
    .getByLabel("Requisition")
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Move Test Recruit").selectOption("Interview");
  await expect(
    page.locator(".kanban-column").filter({
      has: page.locator(".kanban-title").filter({ hasText: /^Interview/ }),
    }),
  ).toContainText("Test Recruit");
  await navigate(page, "Interviews");
  await page
    .getByRole("button", { name: "Record interview", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Candidate")
    .selectOption({ index: 1 });
  await page.getByLabel("Local date and time").fill("2026-12-10T10:30");
  await page.getByLabel("IANA time zone").fill("America/New_York");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("table")).toContainText("2026-12-10 10:30");
  const icsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: ".ics", exact: true }).click();
  const ics = await icsDownload;
  expect(await fs.readFile((await ics.path())!, "utf8")).toContain(
    "DTSTART:20261210T153000Z",
  );
  await navigate(page, "Candidates");
  await page
    .getByRole("button", { name: "Test Recruit test@example.invalid" })
    .click();
  await page.locator('input[type=file][accept=".pdf,.docx"]').setInputFiles({
    name: "resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nFixture"),
  });
  await expect(page.getByText(/resume\.pdf/).first()).toBeVisible();
  await page
    .getByPlaceholder("Add a note or interview feedback…")
    .fill("Functional test note");
  await page.getByRole("button", { name: "Add timestamped note" }).click();
  await expect(
    page.getByText("Functional test note", { exact: true }).first(),
  ).toBeVisible();
  const backupPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Backup Data", exact: true })
    .first()
    .click();
  const backup = JSON.parse(
    await fs.readFile((await (await backupPromise).path())!, "utf8"),
  );
  expect(backup.data.candidates).toHaveLength(1);
  expect(backup.data.attachments[0].base64).toBeTruthy();
  expect(backup.data.applications[0].stage).toBe("Interview");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await navigate(page, "Candidates");
  await expect(page.locator("table")).toContainText("Test Recruit");
});
test("CSV and XLSX mapped imports, duplicate previews, search and export", async ({
  page,
}) => {
  await navigate(page, "Candidates");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[accept=".csv,.xlsx"]').setInputFiles({
    name: "candidates.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "firstName,lastName,email,skills\nAlpha,Fixture,alpha@example.invalid,React\nBeta,Fixture,beta@example.invalid,Python\nClone,Fixture,alpha@example.invalid,Java\n",
    ),
  });
  await expect(page.getByText(/3 rows · 2 valid · 1 issues/)).toBeVisible();
  await page.getByRole("button", { name: "Import 2 new candidates" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Boolean candidate search")
    .fill("React OR Python AND NOT React");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByLabel("Boolean candidate search")
    .fill("(React OR Python) AND NOT React");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Beta");
  await page.getByRole("button", { name: "Clear filters" }).click();
  const bytes = await (
    await writeXlsxFile([
      ["firstName", "lastName", "email"],
      ["Gamma", "Fixture", "gamma@example.invalid"],
    ]).toBlob()
  ).arrayBuffer();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[accept=".csv,.xlsx"]').setInputFiles({
    name: "candidates.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(bytes),
  });
  await expect(page.getByText(/1 rows · 1 valid · 0 issues/)).toBeVisible();
  await page.getByRole("button", { name: "Import 1 new candidates" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page.getByLabel("Export candidates").selectOption("xlsx");
  const file = await download;
  const exported = await readSheet(
    new Blob([await fs.readFile((await file.path())!)]),
  );
  expect(exported).toHaveLength(4);
  expect(exported[0]).toContain("firstName");
  expect(
    exported
      .slice(1)
      .map((row) => row[1])
      .sort(),
  ).toEqual(["Alpha", "Beta", "Gamma"]);
});
test("atomic restore through UI, archive, delete and offline network boundary", async ({
  page,
  context,
}) => {
  const remote: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:47831") &&
      !r.url().startsWith("blob:")
    )
      remote.push(r.url());
  });
  await addCandidate(page, "Restore", "Fixture");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Backup Data", exact: true })
    .first()
    .click();
  const saved = await fs.readFile((await (await pending).path())!);
  await navigate(page, "Candidates");
  await page
    .getByRole("button", { name: "Restore Fixture restore@example.invalid" })
    .click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Back to candidates" }).click();
  await expect(page.getByText("No candidates found")).toBeVisible();
  await page.getByLabel("Include archived").check();
  await page
    .getByRole("button", { name: "Restore Fixture restore@example.invalid" })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Settings");
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: saved,
  });
  await page.getByRole("button", { name: "Replace workspace" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Candidates");
  await expect(page.locator("table")).toContainText("Restore Fixture");
  await context.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:47831")
      ? route.continue()
      : route.abort(),
  );
  await page.reload();
  await navigate(page, "Candidates");
  await expect(page.locator("table")).toContainText("Restore Fixture");
  expect(remote).toEqual([]);
});
test("settings, follow-ups, templates, calendar, reports and drag-and-drop", async ({
  page,
}) => {
  await addCandidate(page, "Workflow", "Fixture");
  await navigate(page, "Settings");
  await page
    .getByLabel("Recruiter names (one per line)")
    .fill("Test Recruiter");
  await page.getByLabel("Recruiter names (one per line)").blur();
  await page.getByRole("button", { name: "Save lists", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await navigate(page, "Activities");
  await page.getByRole("button", { name: "Log activity", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Candidate")
    .selectOption({ index: 1 });
  await page
    .getByLabel("Subject", { exact: false })
    .fill("Test overdue follow-up");
  await page.getByLabel("Follow-up due").fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(page.getByText("Overdue", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page.getByLabel("Template name").fill("Test outreach");
  await page.getByLabel("Message body").fill("Fixture message, not sent.");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByText("Test outreach", { exact: true })).toBeVisible();
  await navigate(page, "Calendar");
  await expect(page.locator(".calendar-cell")).toHaveCount(42);
  await navigate(page, "Reports");
  await expect(
    page.getByRole("heading", { name: "Stage conversion & aging" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  await page.getByLabel("Job title").fill("Drag test job");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, "Pipeline");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Candidate")
    .selectOption({ index: 1 });
  await page
    .getByRole("dialog")
    .getByLabel("Requisition")
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".kanban-card")
    .dragTo(page.locator(".kanban-column").nth(1));
  await expect(page.locator(".kanban-column").nth(1)).toContainText(
    "Workflow Fixture",
  );
});
test("ten thousand candidates remain searchable and paginated", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Performance exercise runs once on Chromium.",
  );
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("candidate-tracker-local-v1");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("candidates", "readwrite");
        const store = tx.objectStore("candidates");
        for (let index = 0; index < 10000; index++) {
          store.put({
            id: "benchmark-" + index,
            firstName: "Benchmark",
            lastName: String(index).padStart(5, "0"),
            email: `fixture${index}@example.invalid`,
            emailKey: `fixture${index}@example.invalid`,
            skills:
              index === 9999 ? "UniqueBenchmarkSkill" : "GeneralFixtureSkill",
            status: "Sourced",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  const start = Date.now();
  await page.reload();
  await navigate(page, "Candidates");
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByText("Page 1 of 200 · 50 per page")).toBeVisible();
  const searchStart = Date.now();
  await page
    .getByLabel("Boolean candidate search")
    .fill("UniqueBenchmarkSkill");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("09999");
  await testInfo.attach("performance-observation", {
    body: JSON.stringify({
      records: 10000,
      reloadAndTableMs: searchStart - start,
      searchAndAssertionMs: Date.now() - searchStart,
    }),
    contentType: "application/json",
  });
});
