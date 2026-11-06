import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  db,
  save,
  remove,
  merge,
  backup,
  restore,
  validateBackup,
  importCandidates,
  moveApplication,
  attach,
  attachmentBlob,
  TrackerDB,
} from "../src/db";
import {
  searchPredicate,
  duplicate,
  metrics,
  defaults,
  zonedISO,
  ics,
  uid,
  now,
} from "../src/model";
import Dexie from "dexie";
beforeEach(async () => {
  await db.open();
  for (const t of db.tables) await t.clear();
});
afterAll(() => db.close());
const candidate = (extra = {}) =>
  save("candidates", {
    firstName: "Test",
    lastName: "Candidate",
    email: "test@example.invalid",
    status: "Sourced",
    ...extra,
  });
const job = (extra = {}) =>
  save("jobs", {
    title: "Test role",
    status: "Open",
    opened: "2026-01-01",
    ...extra,
  });
describe("Boolean search", () => {
  it("honors NOT > AND > OR and parentheses", () => {
    const p = searchPredicate("React OR Python AND NOT Junior");
    expect(p("React Junior")).toBe(true);
    expect(p("Python Junior")).toBe(false);
    expect(p("Python Senior")).toBe(true);
    expect(
      searchPredicate("(React OR Python) AND NOT Junior")("React Junior"),
    ).toBe(false);
  });
  it("supports exact phrases and implicit AND", () => {
    expect(
      searchPredicate('"project manager" remote')("Remote project manager"),
    ).toBe(true);
    expect(searchPredicate('"project manager"')("project senior manager")).toBe(
      false,
    );
  });
  it.each([
    "AND hello",
    "hello OR",
    "(hello",
    "hello)",
    '"hello',
    "hello AND OR bye",
  ])("rejects malformed expression %s", (q) =>
    expect(() => searchPredicate(q)).toThrow(),
  );
  it("normalizes duplicate email and phone without matching blank values", () => {
    expect(duplicate({ email: " A@B.com " }, { email: "a@b.com" })).toBe(true);
    expect(
      duplicate({ phone: "+1 (202) 555-0100" }, { phone: "12025550100" }),
    ).toBe(true);
    expect(duplicate({}, {})).toBe(false);
  });
});
describe("Persistent domain operations", () => {
  it("creates, edits, archives and reopens candidate data", async () => {
    const r = await candidate();
    await save("candidates", { ...r, skills: "TypeScript", archived: true });
    db.close();
    await db.open();
    expect((await db.candidates.get(r.id))?.archived).toBe(true);
    expect((await db.candidates.get(r.id))?.skills).toBe("TypeScript");
  });
  it("rejects stale writes and duplicates", async () => {
    const r = await candidate();
    await db.candidates.update(r.id, { updatedAt: "2099-01-01T00:00:00Z" });
    await expect(
      save("candidates", { ...r, firstName: "Changed" }),
    ).rejects.toThrow("another tab");
    await expect(candidate()).rejects.toThrow("duplicate");
    expect(await db.candidates.count()).toBe(1);
  });
  it("has independent per-job pipelines and records stage timestamps", async () => {
    const c = await candidate(),
      j1 = await job(),
      j2 = await job({ title: "Other role" });
    const a1 = await save("applications", {
        candidateId: c.id,
        jobId: j1.id,
        stage: "Sourced",
      }),
      a2 = await save("applications", {
        candidateId: c.id,
        jobId: j2.id,
        stage: "Interview",
      });
    await moveApplication(a1, "Offer");
    expect((await db.applications.get(a2.id))?.stage).toBe("Interview");
    expect((await db.applications.get(a1.id))?.stageSince).toBeTruthy();
    expect(await db.audit.where("entityId").equals(a1.id).count()).toBe(2);
    await expect(
      save("applications", {
        candidateId: c.id,
        jobId: j1.id,
        stage: "Sourced",
      }),
    ).rejects.toThrow("already has");
  });
  it("cascades candidate deletion and unlinks job histories", async () => {
    const c = await candidate(),
      j = await job();
    await save("activities", {
      candidateId: c.id,
      jobId: j.id,
      subject: "Call",
    });
    await save("applications", {
      candidateId: c.id,
      jobId: j.id,
      stage: "Sourced",
    });
    await remove("jobs", j.id);
    expect(await db.applications.count()).toBe(0);
    expect((await db.activities.toArray())[0].jobId).toBe("");
    await remove("candidates", c.id);
    expect(await db.activities.count()).toBe(0);
    expect(await db.audit.count()).toBeGreaterThan(0);
  });
  it("rolls back an entire failed import", async () => {
    await expect(
      importCandidates([
        {
          firstName: "Valid",
          lastName: "Person",
          email: "valid@example.invalid",
        },
        { firstName: "Invalid" },
      ]),
    ).rejects.toThrow();
    expect(await db.candidates.count()).toBe(0);
    expect(await db.audit.count()).toBe(0);
  });
  it("rejects duplicate rows inside an atomic import", async () => {
    await expect(
      importCandidates([
        { firstName: "A", lastName: "B", email: "same@example.invalid" },
        { firstName: "C", lastName: "D", email: "SAME@example.invalid" },
      ]),
    ).rejects.toThrow();
    expect(await db.candidates.count()).toBe(0);
  });
  it("merges relationships and preserves conflicting originals in notes", async () => {
    const c1 = await candidate(),
      c2 = await candidate({ email: "other@example.invalid" }),
      j = await job();
    await save("applications", {
      candidateId: c1.id,
      jobId: j.id,
      stage: "Sourced",
    });
    await save("applications", {
      candidateId: c2.id,
      jobId: j.id,
      stage: "Interview",
    });
    await save("activities", { candidateId: c2.id, subject: "Other contact" });
    await merge(c1.id, c2.id);
    expect(await db.candidates.count()).toBe(1);
    expect(await db.applications.count()).toBe(1);
    expect((await db.activities.toArray())[0].candidateId).toBe(c1.id);
    expect(await db.notes.count()).toBe(2);
  });
  it("stores and downloads valid resume bytes; rejects bad signatures and size", async () => {
    const c = await candidate();
    const file = new File(["%PDF-1.4\nTest fixture"], "resume.pdf", {
      type: "application/pdf",
    });
    await attach(c.id, file);
    const r = (await db.attachments.toArray())[0];
    expect(await attachmentBlob(r).text()).toContain("%PDF");
    await expect(
      attach(c.id, new File(["<script/>"], "bad.pdf")),
    ).rejects.toThrow("signature");
    await expect(
      attach(c.id, new File([new Uint8Array(11 * 1024 * 1024)], "big.pdf")),
    ).rejects.toThrow("10 MB");
  });
});
describe("Backup and recovery", () => {
  it("round trips records, settings, history, relationships and attachment bytes", async () => {
    const c = await candidate(),
      j = await job();
    await save("applications", {
      candidateId: c.id,
      jobId: j.id,
      stage: "Interview",
    });
    await attach(c.id, new File(["%PDF-1.4\nbackup-test"], "resume.pdf"));
    await db.settings.put({
      id: "main",
      value: { ...defaults, theme: "dark" },
    });
    const b = await backup();
    validateBackup(b);
    await remove("candidates", c.id);
    await restore(JSON.parse(JSON.stringify(b)));
    expect(await db.candidates.count()).toBe(1);
    expect(await db.applications.count()).toBe(1);
    expect((await db.settings.get("main"))?.value.theme).toBe("dark");
    expect(
      await attachmentBlob((await db.attachments.toArray())[0]).text(),
    ).toBe("%PDF-1.4\nbackup-test");
    expect(await db.audit.count()).toBe(b.data.audit.length);
  });
  it("rejects unsupported, corrupted and broken relationship backups without clearing data", async () => {
    const c = await candidate();
    const b = await backup();
    b.data.applications.push({
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
      candidateId: c.id,
      jobId: "missing",
      stage: "Sourced",
    });
    await expect(restore(b)).rejects.toThrow("relationship");
    expect(await db.candidates.count()).toBe(1);
    expect(() => validateBackup({ ...b, version: 99 })).toThrow("version");
  });
  it("rolls back replacement if a database insert fails", async () => {
    await candidate();
    const b = await backup();
    const insertion = vi
      .spyOn(Object.getPrototypeOf(db.candidates), "bulkAdd")
      .mockRejectedValueOnce(new Error("Injected storage failure"));
    try {
      await expect(restore(b)).rejects.toThrow("Injected storage failure");
    } finally {
      insertion.mockRestore();
    }
    expect(await db.candidates.count()).toBe(1);
  });
  it("upgrades a version 1 database without losing records", async () => {
    const name = "migration-test-" + uid();
    const old = new Dexie(name);
    old.version(1).stores({
      candidates:
        "id,emailKey,phoneKey,firstName,lastName,status,owner,source,createdAt,updatedAt",
      jobs: "id,status,createdAt",
      applications: "id,candidateId,jobId,[candidateId+jobId],stage",
      interviews: "id,candidateId,jobId,startAt,status",
      activities: "id,candidateId,jobId,due,completed",
      notes: "id,candidateId",
      attachments: "id,candidateId",
      audit: "id,entityId,candidateId,jobId,createdAt",
      searches: "id",
      templates: "id",
      settings: "id",
    });
    await old
      .table("candidates")
      .add({ id: "preserved", firstName: "Migration", lastName: "Fixture" });
    old.close();
    const upgraded = new TrackerDB(name);
    await upgraded.open();
    expect(await upgraded.candidates.get("preserved")).toBeTruthy();
    expect(upgraded.verno).toBe(2);
    await upgraded.delete();
  });
});
describe("Interviews, reminders and metrics", () => {
  it("converts time zones and exports escaped UTC calendar events", () => {
    expect(zonedISO("2026-01-15T09:30", "America/New_York")).toBe(
      "2026-01-15T14:30:00.000Z",
    );
    expect(() => zonedISO("2026-03-08T02:30", "America/New_York")).toThrow(
      "does not exist",
    );
    const text = ics({
      id: "event",
      createdAt: now(),
      updatedAt: now(),
      date: "2026-01-15T09:30",
      timezone: "America/New_York",
      location: "Room, A",
      type: "Technical",
    });
    expect(text).toContain("DTSTART:20260115T143000Z");
    expect(text).toContain("LOCATION:Room\\, A");
  });
  it("records interview feedback and task completion", async () => {
    const c = await candidate();
    const i = await save("interviews", {
      candidateId: c.id,
      date: "2026-12-01T10:00",
      timezone: "UTC",
      status: "Scheduled",
    });
    await save("interviews", {
      ...i,
      status: "Completed",
      feedback: "Test feedback",
    });
    const v = await save("activities", {
      candidateId: c.id,
      subject: "Follow up",
      due: "2020-01-01T10:00",
      completed: false,
    });
    let m = metrics([c], [], [], [], [v], []);
    expect(m.overdue).toBe(1);
    await save("activities", { ...v, completed: true });
    m = metrics([c], [], [], [], await db.activities.toArray(), []);
    expect(m.overdue).toBe(0);
  });
  it("does not fabricate offer or interview milestones for a direct hire", async () => {
    const c = await candidate(),
      j = await job(),
      a = await save("applications", {
        candidateId: c.id,
        jobId: j.id,
        stage: "Hired",
      });
    const m = metrics([c], [j], [a], [], [], await db.audit.toArray());
    expect(m.hires).toBe(1);
    expect(m.conversion).toBeNull();
    expect(m.acceptance).toBeNull();
  });
  it("calculates recorded conversions and time-to-fill", async () => {
    const c = await candidate(),
      j = await job();
    let a = await save("applications", {
      candidateId: c.id,
      jobId: j.id,
      stage: "Interview",
      appliedAt: "2026-01-01",
    });
    a = await moveApplication(a, "Offer");
    a = await moveApplication(a, "Hired");
    const filled = await save("jobs", { ...j, status: "Filled" });
    const m = metrics([c], [filled], [a], [], [], await db.audit.toArray());
    expect(m.acceptance).toBe(100);
    expect(m.conversion).toBe(100);
    expect(m.timeToFill).toBeGreaterThan(0);
    expect(m.timeToHire).toBeGreaterThan(0);
  });
});
describe("Additional recovery validation", () => {
  it("rejects invalid settings without replacing records", async () => {
    await candidate();
    await db.settings.put({ id: "main", value: defaults });
    const b = await backup();
    b.data.settings[0].value.name = { bad: true };
    expect(() => validateBackup(b)).toThrow("settings");
    expect(await db.candidates.count()).toBe(1);
  });
  it("normalizes restored duplicate lookup keys", async () => {
    await candidate();
    const b = await backup();
    b.data.candidates[0].emailKey = "wrong";
    await restore(b);
    await expect(candidate()).rejects.toThrow("duplicate");
  });
  it("rejects malformed DOCX and accepts a real document container", async () => {
    const { default: JSZip } = await import("jszip");
    const c = await candidate();
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("word/document.xml", "<document/>");
    await attach(
      c.id,
      new File(
        [await zip.generateAsync({ type: "uint8array" })],
        "resume.docx",
      ),
    );
    expect(await db.attachments.count()).toBe(1);
    await expect(
      attach(c.id, new File(["PKbroken"], "bad.docx")),
    ).rejects.toThrow();
  });
});
