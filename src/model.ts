export type Row = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};
export type Kind =
  | "candidates"
  | "jobs"
  | "applications"
  | "interviews"
  | "activities"
  | "notes"
  | "attachments"
  | "audit"
  | "searches"
  | "templates";
export const kinds: Kind[] = [
  "candidates",
  "jobs",
  "applications",
  "interviews",
  "activities",
  "notes",
  "attachments",
  "audit",
  "searches",
  "templates",
];
export const defaultStages = [
  "Sourced",
  "Contacted",
  "Responded",
  "Recruiter Screen",
  "Hiring Manager Review",
  "Assessment",
  "Interview",
  "Final Interview",
  "Offer",
  "Hired",
  "Rejected",
  "Withdrawn",
  "On Hold",
];
export const defaults = {
  name: "Candidate Tracker",
  theme: "light",
  stages: defaultStages,
  sources: [
    "LinkedIn",
    "Referral",
    "Job Board",
    "Career Site",
    "Direct",
    "Other",
  ],
  recruiters: [] as string[],
  jobStatuses: ["Draft", "Open", "On Hold", "Filled", "Cancelled", "Closed"],
  customFields: [] as string[],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: "locale",
  timeFormat: "24",
  backupReminder: true,
  lastBackup: "",
  retentionDays: 365,
};
export type Settings = typeof defaults;
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const emailKey = (s: string = "") => s.trim().toLowerCase();
export const phoneKey = (s: string = "") => s.replace(/\D/g, "");
export const nameOf = (r?: Row) =>
  r
    ? `${r.firstName || ""} ${r.lastName || ""}`.trim() ||
      r.title ||
      r.subject ||
      r.id
    : "Unknown record";
export const duplicate = (a: Partial<Row>, b: Partial<Row>) =>
  Boolean(
    (emailKey(a.email) && emailKey(a.email) === emailKey(b.email)) ||
    (phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone)),
  );
export const safeURL = (s: string) => {
  try {
    const u = new URL(s);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
};
export function validate(kind: Kind, r: Partial<Row>) {
  if (!r || typeof r !== "object" || Array.isArray(r))
    throw Error("Invalid record.");
  for (const [key, value] of Object.entries(r)) {
    if (value == null) continue;
    if (["blob", "bytes", "filters"].includes(key)) continue;
    if (!["string", "number", "boolean"].includes(typeof value))
      throw Error(`Invalid field type: ${key}`);
  }
  for (const key of [
    "firstName",
    "lastName",
    "email",
    "phone",
    "title",
    "status",
    "stage",
    "candidateId",
    "jobId",
    "subject",
    "text",
    "skills",
    "notes",
    "source",
    "owner",
    "date",
    "timezone",
  ])
    if (r[key] != null && typeof r[key] !== "string")
      throw Error(`${key} must be text.`);
  for (const key of [
    "applicationDate",
    "appliedAt",
    "opened",
    "targetClose",
    "date",
    "due",
  ])
    if (r[key] && !Number.isFinite(Date.parse(r[key])))
      throw Error(`Invalid date: ${key}`);
  if (
    r.openings !== undefined &&
    r.openings !== "" &&
    (!Number.isInteger(Number(r.openings)) || Number(r.openings) < 1)
  )
    throw Error("Number of openings must be a positive integer.");

  if (kind === "candidates" && (!r.firstName?.trim() || !r.lastName?.trim()))
    throw Error("First and last name are required.");
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    throw Error("Enter a valid email address.");
  if (kind === "jobs" && !r.title?.trim())
    throw Error("Job title is required.");
  if (kind === "applications" && (!r.candidateId || !r.jobId || !r.stage))
    throw Error("Candidate, requisition, and stage are required.");
  if (
    ["interviews", "activities", "notes", "attachments"].includes(kind) &&
    !r.candidateId
  )
    throw Error("Select a candidate.");
  if (kind === "interviews" && (!r.date || !r.timezone))
    throw Error("Interview date and time zone are required.");
  if (kind === "activities" && !r.subject?.trim())
    throw Error("Activity subject is required.");
  if (
    r.experience !== undefined &&
    r.experience !== "" &&
    (Number(r.experience) < 0 || !Number.isFinite(Number(r.experience)))
  )
    throw Error("Experience must be a nonnegative number.");
  for (const key of ["linkedin", "website", "meetingLink"])
    if (r[key] && !safeURL(r[key]))
      throw Error(`${key}: use a full http or https URL.`);
  if (r.timezone)
    try {
      new Intl.DateTimeFormat("en", { timeZone: r.timezone });
    } catch {
      throw Error("Use an IANA time zone, such as America/New_York.");
    }
}
export function searchPredicate(input: string): (text: string) => boolean {
  if (!input.trim()) return () => true;
  const tokens =
    input.match(/"[^"\r\n]*"|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()"]+/g) || [];
  if ((input.match(/"/g) || []).length % 2) throw Error("Unclosed quote.");
  let p = 0;
  type Fn = (s: string) => boolean;
  const primary = (): Fn => {
    const t = tokens[p++];
    if (!t || ["AND", "OR", ")"].includes(t))
      throw Error("Expected a search term.");
    if (t === "NOT") {
      const a = primary();
      return (s) => !a(s);
    }
    if (t === "(") {
      const a = or();
      if (tokens[p++] !== ")") throw Error("Missing closing parenthesis.");
      return a;
    }
    const q = t.replace(/^"|"$/g, "").toLowerCase();
    return (s) => s.includes(q);
  };
  const and = (): Fn => {
    let a = primary();
    while (p < tokens.length && !["OR", ")"].includes(tokens[p])) {
      if (tokens[p] === "AND") p++;
      const b = primary(),
        old = a;
      a = (s) => old(s) && b(s);
    }
    return a;
  };
  const or = (): Fn => {
    let a = and();
    while (tokens[p] === "OR") {
      p++;
      const b = and(),
        old = a;
      a = (s) => old(s) || b(s);
    }
    return a;
  };
  const result = or();
  if (p !== tokens.length) throw Error("Unexpected closing parenthesis.");
  return (s) => result(s.toLowerCase());
}
export function zonedISO(value: string, zone: string) {
  const parts = value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/);
  if (!parts) throw Error("Invalid interview date.");
  const target = Date.UTC(
    ...([+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5]] as [
      number,
      number,
      number,
      number,
      number,
    ]),
  );
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const local = (t: number) => {
    const p = Object.fromEntries(
      fmt.formatToParts(t).map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  let guess = target;
  for (let i = 0; i < 3; i++) guess += target - local(guess);
  if (local(guess) !== target)
    throw Error(
      "This local time does not exist because of daylight saving time.",
    );
  return new Date(guess).toISOString();
}
export function ics(r: Row, c?: Row) {
  const esc = (v: string = "") =>
    v
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const dt = (v: string) => v.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = r.startAt || zonedISO(r.date, r.timezone);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Candidate Tracker//Offline//EN",
      "BEGIN:VEVENT",
      `UID:${r.id}@candidate-tracker.local`,
      `DTSTAMP:${dt(now())}`,
      `DTSTART:${dt(start)}`,
      `DTEND:${dt(new Date(Date.parse(start) + 3600000).toISOString())}`,
      `SUMMARY:${esc(`${r.type || "Interview"}: ${nameOf(c)}`)}`,
      `LOCATION:${esc(r.meetingLink || r.location)}`,
      `DESCRIPTION:${esc(r.nextSteps || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}
export const days = (a: string, b: string) =>
  Math.max(0, (Date.parse(b) - Date.parse(a)) / 86400000);
export function metrics(
  c: Row[],
  j: Row[],
  a: Row[],
  i: Row[],
  v: Row[],
  events: Row[],
) {
  const milestones = new Map<string, Set<string>>(),
    hireDates = new Map<string, string>();
  for (const event of events) {
    if (event.toStage) {
      if (!milestones.has(event.entityId))
        milestones.set(event.entityId, new Set());
      milestones.get(event.entityId)!.add(event.toStage);
      if (
        event.toStage === "Hired" &&
        (!hireDates.has(event.entityId) ||
          event.createdAt < hireDates.get(event.entityId)!)
      )
        hireDates.set(event.entityId, event.createdAt);
    }
  }
  const hired = a.filter((x) => x.stage === "Hired"),
    offered = a.filter(
      (x) => x.stage === "Offer" || milestones.get(x.id)?.has("Offer"),
    ),
    interviewed = a.filter(
      (x) =>
        ["Interview", "Final Interview"].includes(x.stage) ||
        ["Interview", "Final Interview"].some((s) =>
          milestones.get(x.id)?.has(s),
        ),
    );
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : null;
  const hireDate = (x: Row) => hireDates.get(x.id)!;

  return {
    total: c.length,
    active: c.filter(
      (x) =>
        !x.archived && !["Hired", "Rejected", "Withdrawn"].includes(x.status),
    ).length,
    open: j.filter((x) => x.status === "Open").length,
    submitted: a.filter((x) => x.stage === "Hiring Manager Review").length,
    interviews: i.filter(
      (x) => x.status === "Scheduled" || x.status === "Rescheduled",
    ).length,
    offers: a.filter((x) => x.stage === "Offer").length,
    hires: hired.length,
    rejected: a.filter((x) => ["Rejected", "Withdrawn"].includes(x.stage))
      .length,
    overdue: v.filter(
      (x) => !x.completed && x.due && Date.parse(x.due) < Date.now(),
    ).length,
    followups: v.filter((x) => !x.completed && x.due).length,
    acceptance: offered.length
      ? (hired.filter((x) => offered.some((o) => o.id === x.id)).length /
          offered.length) *
        100
      : null,
    conversion: interviewed.length
      ? (offered.filter((x) => interviewed.some((y) => y.id === x.id)).length /
          interviewed.length) *
        100
      : null,
    timeToHire: avg(
      hired
        .filter((x) => hireDate(x) && x.appliedAt)
        .map((x) => days(x.appliedAt, hireDate(x))),
    ),
    timeToFill: avg(
      j
        .filter((x) => x.status === "Filled" && x.filledAt && x.opened)
        .map((x) => days(x.opened, x.filledAt)),
    ),
  };
}
