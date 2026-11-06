import Dexie, { type Table } from "dexie";
import {
  type Row,
  type Kind,
  type Settings,
  defaults,
  kinds,
  now,
  uid,
  validate,
  emailKey,
  phoneKey,
  zonedISO,
  duplicate,
} from "./model";
export class TrackerDB extends Dexie {
  [key: string]: any;
  candidates!: Table<Row>;
  jobs!: Table<Row>;
  applications!: Table<Row>;
  interviews!: Table<Row>;
  activities!: Table<Row>;
  notes!: Table<Row>;
  attachments!: Table<Row>;
  audit!: Table<Row>;
  searches!: Table<Row>;
  templates!: Table<Row>;
  settings!: Table<{ id: string; value: Settings }>;
  constructor(name = "candidate-tracker-local-v1") {
    super(name);
    this.version(1).stores({
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
    this.version(2).stores({
      applications: "id,candidateId,jobId,&[candidateId+jobId],stage",
    });
  }
}
export const db = new TrackerDB();
export async function settings() {
  return { ...defaults, ...(await db.settings.get("main"))?.value };
}
export async function audit(
  action: string,
  r: Row,
  kind: string,
  extra: Record<string, unknown> = {},
) {
  const t = now();
  await db.audit.add({
    id: uid(),
    createdAt: t,
    updatedAt: t,
    entityId: r.id,
    candidateId: kind === "candidates" ? r.id : r.candidateId,
    jobId: kind === "jobs" ? r.id : r.jobId,
    action,
    ...extra,
  });
}
export async function save(
  kind: Kind,
  values: Partial<Row>,
  options: { allowDuplicate?: boolean } = {},
) {
  validate(kind, values);
  const t = now();
  const r = {
    ...values,
    id: values.id || uid(),
    createdAt: values.createdAt || t,
    updatedAt: t,
  } as Row;
  return db.transaction("rw", db.tables, async () => {
    const config = await settings();
    if (kind === "applications" && !config.stages.includes(r.stage))
      throw Error("Select a configured stage.");
    if (kind === "candidates" && r.status && !config.stages.includes(r.status))
      throw Error("Candidate status must match a configured stage.");
    if (kind === "jobs" && r.status && !config.jobStatuses.includes(r.status))
      throw Error("Select a configured requisition status.");
    const old = await db.table(kind).get(r.id);
    if (old && values.updatedAt && old.updatedAt !== values.updatedAt)
      throw Error(
        "This record changed in another tab. Close and reopen it before saving.",
      );
    if (kind === "candidates") {
      r.emailKey = emailKey(r.email);
      r.phoneKey = phoneKey(r.phone);
      if (!options.allowDuplicate) {
        const matches = [
          ...(r.emailKey
            ? await db.candidates.where("emailKey").equals(r.emailKey).toArray()
            : []),
          ...(r.phoneKey
            ? await db.candidates.where("phoneKey").equals(r.phoneKey).toArray()
            : []),
        ];
        if (matches.some((x) => x.id !== r.id))
          throw Error(
            "Potential duplicate email or phone. Review existing candidates or explicitly allow a separate record.",
          );
      }
    }
    if (r.candidateId && !(await db.candidates.get(r.candidateId)))
      throw Error("Candidate no longer exists.");
    if (r.jobId && !(await db.jobs.get(r.jobId)))
      throw Error("Requisition no longer exists.");
    if (kind === "applications") {
      if (
        (
          await db.applications
            .where("[candidateId+jobId]")
            .equals([r.candidateId, r.jobId])
            .toArray()
        ).some((x) => x.id !== r.id)
      )
        throw Error(
          "This candidate already has an application for this requisition.",
        );
      if (old?.stage !== r.stage) r.stageSince = t;
    }
    if (kind === "jobs" && r.status === "Filled" && old?.status !== "Filled")
      r.filledAt = t;
    if (kind === "interviews") r.startAt = zonedISO(r.date, r.timezone);
    await db.table(kind).put(r);
    if (r.candidateId && kind !== "audit")
      await db.candidates.update(r.candidateId, { updatedAt: t });
    await audit(old ? "Updated" : "Created", r, kind, {
      ...(kind === "applications" && old?.stage !== r.stage
        ? { fromStage: old?.stage || null, toStage: r.stage }
        : {}),
      detail: kind === "notes" ? r.text : undefined,
    });
    return r;
  });
}
export async function moveApplication(r: Row, stage: string, reason = "") {
  return save("applications", { ...r, stage, rejectionReason: reason });
}
export async function remove(kind: Kind, id: string) {
  await db.transaction("rw", db.tables, async () => {
    const r = await db.table(kind).get(id);
    if (!r) return;
    if (kind === "candidates")
      for (const k of [
        "applications",
        "interviews",
        "activities",
        "notes",
        "attachments",
      ] as Kind[])
        await db.table(k).where("candidateId").equals(id).delete();
    if (kind === "jobs") {
      await db.applications.where("jobId").equals(id).delete();
      for (const k of ["interviews", "activities"] as Kind[])
        await db.table(k).where("jobId").equals(id).modify({ jobId: "" });
    }
    await db.table(kind).delete(id);
    await audit("Deleted", r, kind);
  });
}
export async function merge(keepId: string, otherId: string) {
  if (keepId === otherId) throw Error("Select two different candidates.");
  await db.transaction("rw", db.tables, async () => {
    const keep = await db.candidates.get(keepId),
      other = await db.candidates.get(otherId);
    if (!keep || !other) throw Error("Candidate not found.");
    for (const k of [
      "interviews",
      "activities",
      "notes",
      "attachments",
      "audit",
    ] as Kind[])
      await db
        .table(k)
        .where("candidateId")
        .equals(otherId)
        .modify({ candidateId: keepId });
    for (const a of await db.applications
      .where("candidateId")
      .equals(otherId)
      .toArray()) {
      const conflict = await db.applications
        .where("[candidateId+jobId]")
        .equals([keepId, a.jobId])
        .first();
      if (conflict) {
        await db.notes.add({
          id: uid(),
          candidateId: keepId,
          text: `Merged application snapshot: ${JSON.stringify(a)}`,
          createdAt: now(),
          updatedAt: now(),
        });
        await db.applications.delete(a.id);
      } else await db.applications.update(a.id, { candidateId: keepId });
    }
    await db.notes.add({
      id: uid(),
      candidateId: keepId,
      text: `Merged profile snapshot (primary profile retained): ${JSON.stringify(other)}`,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.candidates.delete(otherId);
    await db.candidates.update(keepId, { updatedAt: now() });
    await audit("Merged duplicate", keep, "candidates", {
      detail: `Merged ${otherId}; original profile preserved in notes.`,
    });
  });
}
export async function attach(candidateId: string, file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw Error("Maximum resume size is 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf =
    /\.pdf$/i.test(file.name) &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const docx = /\.docx$/i.test(file.name) && bytes[0] === 80 && bytes[1] === 75;
  if (!pdf && !docx)
    throw Error("Choose a PDF or DOCX with a valid file signature.");
  if (docx) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(bytes);
    if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml"))
      throw Error("Invalid DOCX document.");
  }
  return save("attachments", {
    candidateId,
    name: file.name,
    size: file.size,
    type: pdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: bytes.buffer,
  });
}
export const attachmentBlob = (r: Row): Blob =>
  r.blob instanceof Blob ? r.blob : new Blob([r.bytes], { type: r.type });
export type Backup = {
  format: "candidate-tracker";
  version: 1;
  createdAt: string;
  data: Record<string, any[]>;
};
export async function backup(): Promise<Backup> {
  const data: Record<string, any[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const t of db.tables) data[t.name] = await t.toArray();
  });
  data.attachments = await Promise.all(
    data.attachments.map(async (r) => {
      const bytes = new Uint8Array(await attachmentBlob(r).arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.slice(i, i + 8192));
      const { blob, bytes: storedBytes, ...rest } = r;
      return { ...rest, base64: btoa(binary) };
    }),
  );
  return { format: "candidate-tracker", version: 1, createdAt: now(), data };
}
export function validateBackup(b: any): asserts b is Backup {
  if (b?.format !== "candidate-tracker" || b.version !== 1 || !b.data)
    throw Error("Unsupported backup format or version.");
  for (const k of [...kinds, "settings"]) {
    if (!Array.isArray(b.data[k])) throw Error(`Missing table: ${k}`);
    const ids = new Set();
    for (const r of b.data[k]) {
      if (!r || typeof r.id !== "string" || ids.has(r.id))
        throw Error(`Invalid or duplicate ID in ${k}`);
      ids.add(r.id);
      if (k !== "settings") {
        if (
          !r.createdAt ||
          !r.updatedAt ||
          !Number.isFinite(Date.parse(r.createdAt)) ||
          !Number.isFinite(Date.parse(r.updatedAt))
        )
          throw Error(`Invalid timestamps in ${k}`);
        validate(k as Kind, r);
      } else {
        if (
          r.id !== "main" ||
          !r.value ||
          !Array.isArray(r.value.stages) ||
          !r.value.stages.length
        )
          throw Error("Invalid settings.");
        for (const key of [
          "name",
          "theme",
          "timezone",
          "dateFormat",
          "timeFormat",
          "lastBackup",
        ])
          if (typeof r.value[key] !== "string")
            throw Error("Invalid settings value.");
        if (
          !["light", "dark"].includes(r.value.theme) ||
          !["locale", "iso"].includes(r.value.dateFormat) ||
          !["12", "24"].includes(r.value.timeFormat) ||
          typeof r.value.backupReminder !== "boolean" ||
          !Number.isFinite(r.value.retentionDays) ||
          r.value.retentionDays < 1
        )
          throw Error("Invalid settings value.");
        try {
          new Intl.DateTimeFormat("en", { timeZone: r.value.timezone });
        } catch {
          throw Error("Invalid settings time zone.");
        }
        for (const key of [
          "stages",
          "sources",
          "recruiters",
          "customFields",
          "jobStatuses",
        ])
          if (
            !Array.isArray(r.value[key]) ||
            r.value[key].some(
              (x: unknown) => typeof x !== "string" || !x.trim(),
            ) ||
            new Set(r.value[key]).size !== r.value[key].length
          )
            throw Error("Invalid settings lists.");
      }
    }
  }
  const cs = new Set(b.data.candidates.map((r: Row) => r.id)),
    js = new Set(b.data.jobs.map((r: Row) => r.id)),
    pairs = new Set();
  for (const k of [
    "applications",
    "interviews",
    "activities",
    "notes",
    "attachments",
  ])
    for (const r of b.data[k]) {
      if (!cs.has(r.candidateId) || (r.jobId && !js.has(r.jobId)))
        throw Error(`Broken relationship in ${k}`);
      if (k === "applications") {
        const key = JSON.stringify([r.candidateId, r.jobId]);
        if (pairs.has(key)) throw Error("Duplicate application.");
        pairs.add(key);
      }
      if (k === "interviews" && r.startAt !== zonedISO(r.date, r.timezone))
        throw Error("Interview time is inconsistent with its time zone.");
      if (k === "attachments") {
        if (
          typeof r.base64 !== "string" ||
          r.base64.length > 14 * 1024 * 1024 ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(r.base64)
        )
          throw Error("Invalid attachment.");
        const binary = atob(r.base64);
        if (
          r.size > 10 * 1024 * 1024 ||
          binary.length !== r.size ||
          (!(/\.pdf$/i.test(r.name) && binary.startsWith("%PDF-")) &&
            !(/\.docx$/i.test(r.name) && binary.startsWith("PK")))
        )
          throw Error("Invalid attachment content.");
      }
    }
}
export async function restore(b: Backup) {
  validateBackup(b);
  const data: Record<string, any[]> = {
    ...b.data,
    candidates: b.data.candidates.map((r) => ({
      ...r,
      emailKey: emailKey(r.email),
      phoneKey: phoneKey(r.phone),
    })),
    attachments: b.data.attachments.map((r) => {
      const { base64, ...rest } = r;
      return {
        ...rest,
        bytes: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer,
      };
    }),
  };
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (data[t.name].length) await t.bulkAdd(data[t.name]);
    }
  });
}
export async function importCandidates(rows: Partial<Row>[]) {
  await db.transaction("rw", db.tables, async () => {
    const existing = await db.candidates.toArray(),
      config = await settings();
    const emails = new Set(
        existing.map((x) => emailKey(x.email)).filter(Boolean),
      ),
      phones = new Set(existing.map((x) => phoneKey(x.phone)).filter(Boolean));
    const t = now();
    const records = rows.map((values) => {
      validate("candidates", values);
      if (values.status && !config.stages.includes(values.status))
        throw Error("Unknown candidate status.");
      const email = emailKey(values.email),
        phone = phoneKey(values.phone);
      if ((email && emails.has(email)) || (phone && phones.has(phone)))
        throw Error("Duplicate detected. No rows imported.");
      if (email) emails.add(email);
      if (phone) phones.add(phone);
      return {
        ...values,
        id: uid(),
        createdAt: t,
        updatedAt: t,
        emailKey: email,
        phoneKey: phone,
      } as Row;
    });
    await db.candidates.bulkAdd(records);
    await db.audit.bulkAdd(
      records.map((r) => ({
        id: uid(),
        createdAt: t,
        updatedAt: t,
        entityId: r.id,
        candidateId: r.id,
        action: "Imported",
      })),
    );
  });
}
