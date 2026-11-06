import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  Columns3,
  CalendarDays,
  ListTodo,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Search,
  Plus,
  ArrowUpRight,
  Download,
  Upload,
  Moon,
  Sun,
  ShieldCheck,
  ChevronRight,
  X,
  Check,
  Trash2,
  FileText,
  Archive,
  Copy,
  Menu,
  ArrowLeft,
  ArrowRight,
  Clock,
  Database,
  SlidersHorizontal,
  Mail,
  GripVertical,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  db,
  save,
  remove,
  merge,
  attach,
  attachmentBlob,
  backup,
  restore,
  validateBackup,
  importCandidates,
  moveApplication,
} from "./db";
import {
  type Row,
  type Kind,
  type Settings,
  defaults,
  nameOf,
  now,
  duplicate,
  searchPredicate,
  metrics,
  days,
  ics,
  validate,
  safeURL,
  emailKey,
  phoneKey,
} from "./model";
import { fields } from "./fields";
import { download, readImport, candidateColumns, exportCandidates } from "./io";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Candidates", Users],
  ["Jobs", BriefcaseBusiness],
  ["Pipeline", Columns3],
  ["Interviews", CalendarDays],
  ["Activities", ListTodo],
  ["Calendar", CalendarDays],
  ["Reports", ChartNoAxesCombined],
  ["Settings", SettingsIcon],
] as const;
const empty: Row[] = [];
const localDateTime = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const dateOnly = () => localDateTime().slice(0, 10);
function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={`badge ${/Hired|Filled|Completed|Open/.test(String(children)) ? "green" : /Rejected|Cancelled|Overdue/.test(String(children)) ? "red" : /Offer|Interview/.test(String(children)) ? "purple" : ""}`}
    >
      {children}
    </span>
  );
}
function Empty({
  title = "No records yet",
  text = "Add your first record to get started.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Database size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} className={wide ? "wide" : ""} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const all = useLiveQuery(async () => {
    const data: Record<string, Row[]> = {};
    for (const k of [
      "candidates",
      "jobs",
      "applications",
      "interviews",
      "activities",
      "notes",
      "audit",
      "searches",
      "templates",
    ])
      data[k] = await db.table(k).toArray();
    return data;
  }, []);
  const savedSettings = useLiveQuery(() => db.settings.get("main"), []);
  const settings = useMemo(
    () => ({ ...defaults, ...savedSettings?.value }),
    [savedSettings],
  );
  const c = all?.candidates || empty,
    j = all?.jobs || empty,
    a = all?.applications || empty,
    i = all?.interviews || empty,
    v = all?.activities || empty,
    n = all?.notes || empty,
    e = all?.audit || empty;
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const [page, setPage] = useState("Dashboard"),
    [query, setQuery] = useState(""),
    [editor, setEditor] = useState<{ kind: Kind; row?: Partial<Row> } | null>(
      null,
    ),
    [detail, setDetail] = useState<{
      kind: "candidates" | "jobs";
      id: string;
    } | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [confirm, setConfirm] = useState<{
      text: string;
      run: () => Promise<unknown>;
    } | null>(null),
    [restoreData, setRestoreData] = useState<any>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState({
      stage: "",
      owner: "",
      source: "",
      location: "",
      min: "",
      from: "",
      to: "",
      archived: false,
      sort: "updatedAt",
    }),
    [pageIndex, setPageIndex] = useState(0),
    [jobFilter, setJobFilter] = useState(""),
    [pipelineView, setPipelineView] = useState("board"),
    [reportOwner, setReportOwner] = useState(""),
    [reportFrom, setReportFrom] = useState(""),
    [reportTo, setReportTo] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.title = settings.name;
  }, [settings]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    setPageIndex(0);
  }, [query, filters]);
  const run = async (
    fn: () => Promise<unknown>,
    message = "Saved successfully",
  ) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      return true;
    } catch (err) {
      setError(
        `${(err as Error).message}${(err as Error).name === "QuotaExceededError" ? " Storage is full. Export a backup and remove unneeded attachments." : ""}`,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const updateSettings = async (p: Partial<Settings>) => {
    await db.settings.put({ id: "main", value: { ...settings, ...p } });
  };
  const newRecord = (kind: Kind, row: Partial<Row> = {}) =>
    setEditor({
      kind,
      row: {
        ...(kind === "candidates"
          ? { status: settings.stages[0], applicationDate: dateOnly() }
          : kind === "jobs"
            ? { status: "Open", opened: dateOnly(), openings: 1 }
            : kind === "applications"
              ? { stage: settings.stages[0], appliedAt: dateOnly() }
              : kind === "interviews"
                ? {
                    status: "Scheduled",
                    timezone: settings.timezone,
                    type: "Video",
                  }
                : kind === "activities"
                  ? {
                      type: "Follow-Up",
                      completed: false,
                      date: localDateTime(),
                    }
                  : {}),
        ...row,
      },
    });
  const makeBackup = () =>
    run(async () => {
      const b = await backup();
      download(
        `candidate-tracker-backup-${dateOnly()}.json`,
        JSON.stringify(b),
        "application/json",
      );
      await updateSettings({ lastBackup: now() });
    }, "Backup download created. Keep it in a safe location.");
  const askRemove = (kind: Kind, r: Row) =>
    setConfirm({
      text: `Permanently delete ${nameOf(r)}? ${kind === "candidates" ? "Its applications, interviews, notes, activities and resumes will also be deleted." : kind === "jobs" ? "Its applications will be deleted. Other history is retained." : ""} Export a backup first.`,
      run: async () => {
        await remove(kind, r.id);
        setDetail(null);
      },
    });
  const go = (p: string) => {
    setPage(p);
    setDetail(null);
    setMobile(false);
  };
  const stats = metrics(c, j, a, i, v, e);
  let searchError = "";
  let predicate = (_: string) => true;
  try {
    predicate = searchPredicate(query);
  } catch (err) {
    searchError = (err as Error).message;
    predicate = () => false;
  }
  const searchIndex = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const candidate of c)
      map.set(
        candidate.id,
        Object.values(candidate).filter((x) => typeof x === "string"),
      );
    const jobMap = new Map(j.map((x) => [x.id, x]));
    for (const app of a) {
      const job = jobMap.get(app.jobId);
      map
        .get(app.candidateId)
        ?.push(app.jobId, job?.requisitionId || "", job?.title || "");
    }
    for (const note of n) map.get(note.candidateId)?.push(note.text || "");
    return new Map([...map].map(([id, parts]) => [id, parts.join(" ")]));
  }, [c, j, a, n]);
  const stagesByCandidate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const app of a) {
      if (!map.has(app.candidateId)) map.set(app.candidateId, new Set());
      map.get(app.candidateId)!.add(app.stage);
    }
    return map;
  }, [a]);
  const filtered = c
    .filter(
      (r) =>
        predicate(searchIndex.get(r.id) || "") &&
        (filters.archived || !r.archived) &&
        (!filters.stage ||
          r.status === filters.stage ||
          stagesByCandidate.get(r.id)?.has(filters.stage)) &&
        (!filters.owner || r.owner === filters.owner) &&
        (!filters.source || r.source === filters.source) &&
        (!filters.location ||
          [r.city, r.state, r.country]
            .join(" ")
            .toLowerCase()
            .includes(filters.location.toLowerCase())) &&
        (!filters.min ||
          (r.experience !== "" &&
            r.experience != null &&
            Number(r.experience) >= Number(filters.min))) &&
        (!filters.from || r.applicationDate >= filters.from) &&
        (!filters.to || r.applicationDate <= filters.to),
    )
    .sort((x, y) =>
      filters.sort === "name"
        ? nameOf(x).localeCompare(nameOf(y))
        : filters.sort === "status"
          ? (x.status || "").localeCompare(y.status || "")
          : String(y[filters.sort] || "").localeCompare(
              String(x[filters.sort] || ""),
            ),
    );

  const fmt = (d?: string) => {
    if (!d) return "—";
    const x = new Date(d.length === 10 ? d + "T12:00:00" : d);
    if (isNaN(+x)) return "—";
    return settings.dateFormat === "iso"
      ? d.slice(0, 10)
      : x.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  };
  const time = (d: string) =>
    new Date(d).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: settings.timeFormat === "12",
    });
  const selected = detail
    ? (detail.kind === "candidates" ? c : j).find((r) => r.id === detail.id)
    : undefined;
  const visibleApps = a.filter((x) => !jobFilter || x.jobId === jobFilter);
  const profile = (r: Row, kind: "candidates" | "jobs" = "candidates") =>
    setDetail({ kind, id: r.id });
  const saveSearch = () => {
    const name = prompt("Name this search");
    if (name) run(() => save("searches", { title: name, query, filters }));
  };
  const reportC = c.filter(
    (x) =>
      (!reportOwner || x.owner === reportOwner) &&
      (!reportFrom || x.createdAt.slice(0, 10) >= reportFrom) &&
      (!reportTo || x.createdAt.slice(0, 10) <= reportTo),
  );
  const reportIds = new Set(reportC.map((x) => x.id));
  const reportA = a.filter(
    (x) =>
      reportIds.has(x.candidateId) && (!jobFilter || x.jobId === jobFilter),
  );
  const reportJ = j.filter((x) => !jobFilter || x.id === jobFilter);
  const reportI = i.filter(
    (x) =>
      reportIds.has(x.candidateId) && (!jobFilter || x.jobId === jobFilter),
  );
  const reportV = v.filter(
    (x) =>
      reportIds.has(x.candidateId) && (!jobFilter || x.jobId === jobFilter),
  );
  const reportStats = metrics(reportC, reportJ, reportA, reportI, reportV, e);
  function chart(
    title: string,
    data: { name: string; value: number }[],
    area = false,
  ) {
    return (
      <section className="panel chart-panel">
        <div className="panel-heading">
          <h3>{title}</h3>
          <span className="muted">Live data</span>
        </div>
        {data.some((x) => x.value > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            {area ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#36846c"
                  fill="#cce7dd"
                />
              </AreaChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  fontSize={10}
                  interval={0}
                  angle={-15}
                  height={55}
                />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#418974" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <Empty
            title="No data available"
            text="Your recruiting activity will appear here."
          />
        )}
      </section>
    );
  }
  function candidateTable(rows: Row[]) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Role & company</th>
              <th>Status</th>
              <th>Source</th>
              <th>Recruiter</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <button className="person" onClick={() => profile(r)}>
                    <span className="avatar">
                      {r.firstName?.[0]}
                      {r.lastName?.[0]}
                    </span>
                    <span>
                      <strong>{nameOf(r)}</strong>
                      <small>{r.email || r.id.slice(0, 8)}</small>
                    </span>
                  </button>
                </td>
                <td>
                  {r.title || "—"}
                  <small>{r.employer || ""}</small>
                </td>
                <td>
                  <Badge>
                    {r.archived ? "Archived" : r.status || "Unassigned"}
                  </Badge>
                </td>
                <td>{r.source || "—"}</td>
                <td>{r.owner || "Unassigned"}</td>
                <td>{fmt(r.updatedAt)}</td>
                <td>
                  <button
                    className="icon"
                    aria-label={`Edit ${nameOf(r)}`}
                    onClick={() => setEditor({ kind: "candidates", row: r })}
                  >
                    <SlidersHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No candidates found"
        text={
          c.length
            ? "Try adjusting your search or filters."
            : "Build your talent network. Add a candidate or import your existing list."
        }
        action={
          <button className="primary" onClick={() => newRecord("candidates")}>
            <Plus size={16} /> Add candidate
          </button>
        }
      />
    );
  }
  function activityList(rows: Row[]) {
    return rows.length ? (
      <div className="activity-list">
        {rows.map((r) => (
          <div className="activity-row" key={r.id}>
            <button
              className={`check-button ${r.completed ? "checked" : ""}`}
              aria-label={r.completed ? "Mark incomplete" : "Mark complete"}
              onClick={() =>
                run(() => save("activities", { ...r, completed: !r.completed }))
              }
            >
              {r.completed && <Check size={14} />}
            </button>
            <button
              className="grow text-left"
              onClick={() => setEditor({ kind: "activities", row: r })}
            >
              <strong>{r.subject}</strong>
              <small>
                {nameOf(c.find((x) => x.id === r.candidateId))} · {r.type}{" "}
                {r.due ? `· Due ${fmt(r.due)}` : ""}
              </small>
            </button>
            {!r.completed && r.due && Date.parse(r.due) < Date.now() && (
              <Badge>Overdue</Badge>
            )}
            <button
              className="icon"
              aria-label="Delete activity"
              onClick={() => askRemove("activities", r)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <Empty
        title="You're all caught up"
        text="Follow-ups and recruiting tasks will appear here."
      />
    );
  }
  const counts = [
    ["Total candidates", stats.total, Users],
    ["Active candidates", stats.active, Users],
    ["Open requisitions", stats.open, BriefcaseBusiness],
    ["Interviews scheduled", stats.interviews, CalendarDays],
  ] as const;
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar show" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <Users size={21} />
          </div>
          <div>
            {settings.name}
            <small>YOUR RECRUITING WORKSPACE</small>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              aria-label={label}
              className={page === label ? "nav-item active" : "nav-item"}
              onClick={() => go(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Candidates" && c.length > 0 && <em>{c.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <ShieldCheck size={19} />
            <div>
              Private by design<small>Local storage · No cloud sync</small>
            </div>
          </div>
          <button
            className="backup-button"
            onClick={makeBackup}
            disabled={busy}
          >
            <Download size={17} /> Backup Data
          </button>
          <div className="workspace-user">
            <div className="avatar">L</div>
            <div>
              Local workspace<small>Offline edition · v1.0</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="global-search">
            <Search size={18} />
            <input
              aria-label="Global search"
              placeholder="Search candidates, skills, or keywords…"
              value={query}
              onChange={(ev) => {
                setQuery(ev.target.value);
                go("Candidates");
              }}
            />
            <kbd>Local</kbd>
          </div>
          <div className="top-actions">
            <details className="quick-menu">
              <summary>Quick actions</summary>
              <div>
                <button
                  onClick={() => {
                    setImportOpen(true);
                    document
                      .querySelector("details[open]")
                      ?.removeAttribute("open");
                  }}
                >
                  Import candidates
                </button>
                <button
                  onClick={() => {
                    newRecord("activities");
                    document
                      .querySelector("details[open]")
                      ?.removeAttribute("open");
                  }}
                >
                  Log activity
                </button>
                <button
                  onClick={() => {
                    newRecord("interviews");
                    document
                      .querySelector("details[open]")
                      ?.removeAttribute("open");
                  }}
                >
                  Record interview
                </button>
              </div>
            </details>
            <button
              className="icon"
              aria-label="Toggle theme"
              onClick={() =>
                run(
                  () =>
                    updateSettings({
                      theme: settings.theme === "dark" ? "light" : "dark",
                    }),
                  "Theme updated",
                )
              }
            >
              {settings.theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
            <button className="secondary" onClick={() => newRecord("jobs")}>
              <Plus size={16} /> Add job
            </button>
            <button className="primary" onClick={() => newRecord("candidates")}>
              <Plus size={16} /> Add candidate
            </button>
          </div>
        </header>
        <main>
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {settings.backupReminder &&
            (!settings.lastBackup || days(settings.lastBackup, now()) > 7) && (
              <div className="backup-notice">
                <ShieldCheck size={16} />
                <span>
                  Your data stays in this browser. Back it up before clearing
                  browser data or switching devices.
                </span>
                <button onClick={makeBackup}>
                  Create backup <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                WORKSPACE <ChevronRight size={12} /> {page.toUpperCase()}
              </div>
              <h1>
                {detail
                  ? nameOf(selected)
                  : page === "Dashboard"
                    ? "Your recruiting overview"
                    : page}
              </h1>
              <p>
                {detail
                  ? "Record details, relationships, and recruiting history."
                  : page === "Dashboard"
                    ? "A clear view of your talent pipeline. Every next step, in one place."
                    : page === "Candidates"
                      ? "Build relationships. Find the right fit. Keep your talent organized."
                      : page === "Jobs"
                        ? "Manage your open roles and the people moving them forward."
                        : page === "Pipeline"
                          ? "Move every application forward, one meaningful step at a time."
                          : page === "Reports"
                            ? "Understand your recruiting activity with real, local data."
                            : page === "Settings"
                              ? "Make this workspace your own. Your data stays in your control."
                              : "Keep your hiring process moving with every conversation and next step."}
              </p>
            </div>
            <div className="heading-actions">
              {detail ? (
                <button onClick={() => setDetail(null)}>
                  <ArrowLeft size={16} /> Back to {detail.kind}
                </button>
              ) : (
                <span className="today">
                  <CalendarDays size={16} />
                  {new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
          {!all ? (
            <Empty
              title="Opening local workspace…"
              text="Loading your stored records."
            />
          ) : detail && selected ? (
            <div className="detail-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h3>Profile</h3>
                  <button
                    onClick={() =>
                      setEditor({ kind: detail.kind, row: selected })
                    }
                  >
                    Edit profile <SlidersHorizontal size={15} />
                  </button>
                </div>
                <div className="profile-fields">
                  <div>
                    <small>Unique ID</small>
                    <p className="mono">{selected.id}</p>
                  </div>
                  {fields(detail.kind, settings).map((f) => (
                    <div key={f.key}>
                      <small>{f.label}</small>
                      <p className="pre-wrap">
                        {String(selected[f.key] ?? "—")}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="button-row">
                  <button onClick={() => window.print()}>
                    <FileText size={16} />
                    Print profile
                  </button>
                  {detail.kind === "candidates" && (
                    <>
                      <button
                        onClick={() =>
                          run(() =>
                            save(
                              "candidates",
                              { ...selected, archived: !selected.archived },
                              { allowDuplicate: true },
                            ),
                          )
                        }
                      >
                        <Archive size={16} />
                        {selected.archived ? "Unarchive" : "Archive"}
                      </button>
                      {selected.email && (
                        <a
                          className="button"
                          href={`mailto:${encodeURIComponent(selected.email)}`}
                        >
                          Open email client
                        </a>
                      )}
                    </>
                  )}
                  <button
                    className="danger"
                    onClick={() => askRemove(detail.kind, selected)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </section>
              <div className="detail-side">
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Applications</h3>
                    <button
                      onClick={() =>
                        newRecord("applications", {
                          [detail.kind === "candidates"
                            ? "candidateId"
                            : "jobId"]: selected.id,
                        })
                      }
                    >
                      <Plus size={15} />
                      Link application
                    </button>
                  </div>
                  {a
                    .filter(
                      (x) =>
                        x[
                          detail.kind === "candidates" ? "candidateId" : "jobId"
                        ] === selected.id,
                    )
                    .map((x) => (
                      <div className="list-row" key={x.id}>
                        <button
                          onClick={() =>
                            setEditor({ kind: "applications", row: x })
                          }
                        >
                          <strong>
                            {detail.kind === "candidates"
                              ? nameOf(j.find((z) => z.id === x.jobId))
                              : nameOf(c.find((z) => z.id === x.candidateId))}
                          </strong>
                          <small>
                            Applied {fmt(x.appliedAt || x.createdAt)}
                          </small>
                        </button>
                        <select
                          aria-label="Application stage"
                          value={x.stage}
                          onChange={(ev) => {
                            const stage = ev.target.value;
                            const reason =
                              stage === "Rejected"
                                ? prompt("Optional rejection reason") || ""
                                : "";
                            run(() => moveApplication(x, stage, reason));
                          }}
                        >
                          {settings.stages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <button
                          className="icon"
                          aria-label="Delete application"
                          onClick={() => askRemove("applications", x)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                </section>
                {detail.kind === "candidates" && (
                  <>
                    <Attachments
                      candidate={selected}
                      run={run}
                      askRemove={askRemove}
                    />
                    <section className="panel">
                      <div className="panel-heading">
                        <h3>Notes & feedback</h3>
                      </div>
                      <form
                        className="note-form"
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          const form = ev.currentTarget;
                          const text = String(
                            new FormData(form).get("note") || "",
                          ).trim();
                          if (text)
                            run(async () => {
                              await save("notes", {
                                candidateId: selected.id,
                                text,
                              });
                              form.reset();
                            });
                        }}
                      >
                        <textarea
                          name="note"
                          required
                          placeholder="Add a note or interview feedback…"
                        />
                        <button className="primary" type="submit">
                          Add timestamped note
                        </button>
                      </form>
                      {n
                        .filter((x) => x.candidateId === selected.id)
                        .map((x) => (
                          <div className="note" key={x.id}>
                            <p className="pre-wrap">{x.text}</p>
                            <small>
                              {fmt(x.createdAt)} · {time(x.createdAt)}
                            </small>
                            <button
                              className="icon"
                              aria-label="Delete note"
                              onClick={() => askRemove("notes", x)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                    </section>
                    {c
                      .filter(
                        (x) => x.id !== selected.id && duplicate(x, selected),
                      )
                      .map((other) => (
                        <section className="panel duplicate" key={other.id}>
                          <h3>Potential duplicate: {nameOf(other)}</h3>
                          <p>
                            Keep this profile. Related records move here; the
                            other profile and conflicting applications are saved
                            as note snapshots.
                          </p>
                          <button
                            onClick={() =>
                              setConfirm({
                                text: `Merge ${nameOf(other)} into ${nameOf(selected)}? The primary profile values will be kept.`,
                                run: () => merge(selected.id, other.id),
                              })
                            }
                          >
                            Review complete — merge
                          </button>
                        </section>
                      ))}
                  </>
                )}
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Interviews & follow-ups</h3>
                  </div>
                  {detail.kind === "candidates" && (
                    <div className="button-row">
                      <button
                        onClick={() =>
                          newRecord("interviews", { candidateId: selected.id })
                        }
                      >
                        Record interview
                      </button>
                      <button
                        onClick={() =>
                          newRecord("activities", { candidateId: selected.id })
                        }
                      >
                        Log activity
                      </button>
                    </div>
                  )}
                  {i
                    .filter(
                      (x) =>
                        x[
                          detail.kind === "candidates" ? "candidateId" : "jobId"
                        ] === selected.id,
                    )
                    .map((x) => (
                      <button
                        className="list-row full"
                        key={x.id}
                        onClick={() =>
                          setEditor({ kind: "interviews", row: x })
                        }
                      >
                        {x.type} · {fmt(x.startAt)}
                        <Badge>{x.status}</Badge>
                      </button>
                    ))}
                  {activityList(
                    v.filter(
                      (x) =>
                        x[
                          detail.kind === "candidates" ? "candidateId" : "jobId"
                        ] === selected.id,
                    ),
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Activity timeline</h3>
                  </div>
                  <div className="timeline">
                    {e
                      .filter(
                        (x) =>
                          x[
                            detail.kind === "candidates"
                              ? "candidateId"
                              : "jobId"
                          ] === selected.id,
                      )
                      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
                      .slice(0, 100)
                      .map((x) => (
                        <div key={x.id}>
                          <span className="timeline-dot" />
                          <strong>
                            {x.action}
                            {x.toStage ? ` → ${x.toStage}` : ""}
                          </strong>
                          <small>
                            {fmt(x.createdAt)} · {time(x.createdAt)}
                          </small>
                          {x.detail && <p>{x.detail}</p>}
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            </div>
          ) : page === "Dashboard" ? (
            <>
              <div className="stats-grid">
                {counts.map(([label, value, Icon]) => (
                  <section className="stat-card" key={label}>
                    <div>
                      <span>{label}</span>
                      <Icon size={19} />
                    </div>
                    <strong>{value.toLocaleString()}</strong>
                    <small>
                      {label === "Total candidates"
                        ? "Your complete talent network"
                        : label === "Active candidates"
                          ? "Excludes archived and closed profiles"
                          : label === "Open requisitions"
                            ? "Roles currently accepting candidates"
                            : "Scheduled or rescheduled interviews"}
                    </small>
                  </section>
                ))}
              </div>
              <div className="dashboard-grid">
                {chart(
                  "Pipeline at a glance",
                  settings.stages
                    .filter(
                      (s) => !["Rejected", "Withdrawn", "On Hold"].includes(s),
                    )
                    .map((s) => ({
                      name: s,
                      value: a.filter((x) => x.stage === s).length,
                    })),
                )}
                <section className="panel next-panel">
                  <div className="panel-heading">
                    <h3>Your next steps</h3>
                    <button onClick={() => go("Activities")}>
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="next-stats">
                    <div>
                      <strong>{stats.followups}</strong>
                      <small>Open follow-ups</small>
                    </div>
                    <div>
                      <strong className="amber">{stats.overdue}</strong>
                      <small>Overdue tasks</small>
                    </div>
                  </div>
                  {activityList(
                    v
                      .filter((x) => !x.completed && x.due)
                      .sort((x, y) => x.due.localeCompare(y.due))
                      .slice(0, 4),
                  )}
                </section>
              </div>
              <div className="mini-stats">
                {[
                  ["Submitted for review", stats.submitted],
                  ["Offers extended", stats.offers],
                  ["Hires completed", stats.hires],
                  ["Rejected / withdrawn", stats.rejected],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recently updated candidates</h3>
                    <p>Stay close to the people in your pipeline.</p>
                  </div>
                  <button onClick={() => go("Candidates")}>
                    View all candidates <ArrowUpRight size={16} />
                  </button>
                </div>
                {candidateTable(
                  [...c]
                    .filter((x) => !x.archived)
                    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
                    .slice(0, 5),
                )}
              </section>
              <div className="quick-strip">
                <div>
                  <ShieldCheck size={23} />
                  <div>
                    <strong>Your workspace. Your data.</strong>
                    <p>
                      Everything is stored locally in this browser. A backup
                      keeps it portable.
                    </p>
                  </div>
                </div>
                <button onClick={() => setImportOpen(true)}>
                  <Upload size={16} />
                  Import candidates
                </button>
              </div>
            </>
          ) : page === "Candidates" ? (
            <>
              <section className="panel">
                <div className="toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      aria-label="Boolean candidate search"
                      placeholder='Search skills AND ("job title" OR employer)'
                      value={query}
                      onChange={(ev) => setQuery(ev.target.value)}
                    />
                  </div>
                  <button onClick={saveSearch}>Save search</button>
                  <select
                    aria-label="Saved searches"
                    value=""
                    onChange={(ev) => {
                      const r = all.searches.find(
                        (x) => x.id === ev.target.value,
                      );
                      if (r) {
                        setQuery(r.query);
                        setFilters({ ...filters, ...r.filters });
                      }
                    }}
                  >
                    <option value="">Saved searches</option>
                    {all.searches.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setImportOpen(true)}>
                    <Upload size={16} /> Import
                  </button>
                  <select
                    aria-label="Export candidates"
                    value=""
                    onChange={(ev) => {
                      const format = ev.target.value;
                      if (format === "json")
                        download(
                          "candidates.json",
                          JSON.stringify(filtered, null, 2),
                          "application/json",
                        );
                      else
                        run(
                          () =>
                            exportCandidates(
                              filtered,
                              format as "csv" | "xlsx",
                            ),
                          "Export created",
                        );
                    }}
                  >
                    <option value="">Export results</option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">XLSX</option>
                    <option value="json">JSON records</option>
                  </select>
                </div>
                <div className="filters">
                  {(["stage", "owner", "source"] as const).map((key) => (
                    <select
                      aria-label={`Filter ${key}`}
                      key={key}
                      value={filters[key]}
                      onChange={(ev) =>
                        setFilters({ ...filters, [key]: ev.target.value })
                      }
                    >
                      <option value="">
                        All{" "}
                        {key === "stage"
                          ? "stages"
                          : key === "owner"
                            ? "recruiters"
                            : "sources"}
                      </option>
                      {(key === "stage"
                        ? settings.stages
                        : key === "owner"
                          ? settings.recruiters
                          : settings.sources
                      ).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  ))}
                  <input
                    aria-label="Filter location"
                    placeholder="Location"
                    value={filters.location}
                    onChange={(ev) =>
                      setFilters({ ...filters, location: ev.target.value })
                    }
                  />
                  <input
                    aria-label="Minimum experience"
                    type="number"
                    min="0"
                    placeholder="Min. years"
                    value={filters.min}
                    onChange={(ev) =>
                      setFilters({ ...filters, min: ev.target.value })
                    }
                  />
                  <label>
                    Applied from
                    <input
                      aria-label="Application from"
                      type="date"
                      value={filters.from}
                      onChange={(ev) =>
                        setFilters({ ...filters, from: ev.target.value })
                      }
                    />
                  </label>
                  <label>
                    to
                    <input
                      aria-label="Application to"
                      type="date"
                      value={filters.to}
                      onChange={(ev) =>
                        setFilters({ ...filters, to: ev.target.value })
                      }
                    />
                  </label>
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilters({
                        stage: "",
                        owner: "",
                        source: "",
                        location: "",
                        min: "",
                        from: "",
                        to: "",
                        archived: false,
                        sort: "updatedAt",
                      });
                    }}
                  >
                    Clear filters
                  </button>
                </div>
                {searchError && <p className="error-text">{searchError}</p>}
                <div className="table-meta">
                  <span>
                    {filtered.length.toLocaleString()} candidates{" "}
                    <span className="muted">
                      · NOT → AND → OR; adjacent terms imply AND
                    </span>
                  </span>
                  <label>
                    <input
                      type="checkbox"
                      checked={filters.archived}
                      onChange={(ev) =>
                        setFilters({ ...filters, archived: ev.target.checked })
                      }
                    />
                    Include archived
                  </label>
                  <select
                    aria-label="Sort candidates"
                    value={filters.sort}
                    onChange={(ev) =>
                      setFilters({ ...filters, sort: ev.target.value })
                    }
                  >
                    <option value="updatedAt">Latest activity</option>
                    <option value="createdAt">Date added</option>
                    <option value="name">Name</option>
                    <option value="status">Status</option>
                  </select>
                </div>
                {candidateTable(
                  filtered.slice(pageIndex * 50, pageIndex * 50 + 50),
                )}
                <div className="pagination">
                  <span>
                    Page {pageIndex + 1} of{" "}
                    {Math.max(1, Math.ceil(filtered.length / 50))} · 50 per page
                  </span>
                  <button
                    disabled={!pageIndex}
                    onClick={() => setPageIndex((x) => x - 1)}
                  >
                    <ArrowLeft size={15} />
                    Previous
                  </button>
                  <button
                    disabled={(pageIndex + 1) * 50 >= filtered.length}
                    onClick={() => setPageIndex((x) => x + 1)}
                  >
                    Next
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            </>
          ) : page === "Jobs" ? (
            <>
              <div className="section-actions">
                <span className="muted">{j.length} requisitions</span>
                <button className="primary" onClick={() => newRecord("jobs")}>
                  <Plus size={16} />
                  Create requisition
                </button>
              </div>
              {j.length ? (
                <div className="jobs-grid">
                  {j.map((r) => (
                    <section className="panel job-card" key={r.id}>
                      <div className="job-top">
                        <div className="job-icon">
                          <BriefcaseBusiness size={23} />
                        </div>
                        <Badge>{r.archived ? "Archived" : r.status}</Badge>
                      </div>
                      <button
                        className="job-title"
                        onClick={() => profile(r, "jobs")}
                      >
                        {r.title}
                        <ArrowUpRight size={18} />
                      </button>
                      <p>
                        {r.department || "No department"} ·{" "}
                        {r.location ||
                          r.workPreference ||
                          "Location not specified"}
                      </p>
                      <div className="job-details">
                        <span>{r.requisitionId || r.id.slice(0, 8)}</span>
                        <span>{r.employmentType || "Type not specified"}</span>
                      </div>
                      <div className="job-footer">
                        <span>
                          <Users size={16} />{" "}
                          {a.filter((x) => x.jobId === r.id).length}{" "}
                          applications
                        </span>
                        <button
                          onClick={() => {
                            setJobFilter(r.id);
                            go("Pipeline");
                          }}
                        >
                          View pipeline <ChevronRight size={15} />
                        </button>
                        <button
                          className="icon"
                          aria-label="Archive job"
                          onClick={() =>
                            run(() =>
                              save("jobs", { ...r, archived: !r.archived }),
                            )
                          }
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    title="Your next great hire starts here"
                    text="Create a requisition to organize applications and track hiring progress."
                    action={
                      <button
                        className="primary"
                        onClick={() => newRecord("jobs")}
                      >
                        Create your first job
                      </button>
                    }
                  />
                </section>
              )}
            </>
          ) : page === "Pipeline" ? (
            <>
              <div className="section-actions">
                <select
                  aria-label="Pipeline requisition"
                  value={jobFilter}
                  onChange={(ev) => setJobFilter(ev.target.value)}
                >
                  <option value="">All requisitions</option>
                  {j.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </select>
                <div className="button-row">
                  <button
                    onClick={() =>
                      setPipelineView(
                        pipelineView === "board" ? "table" : "board",
                      )
                    }
                  >
                    {pipelineView === "board" ? "Table view" : "Board view"}
                  </button>
                  <button
                    className="primary"
                    onClick={() =>
                      newRecord("applications", { jobId: jobFilter })
                    }
                  >
                    <Plus size={16} />
                    Add application
                  </button>
                </div>
              </div>
              {pipelineView === "board" ? (
                <div className="kanban">
                  {settings.stages.map((stage) => (
                    <section
                      className="kanban-column"
                      key={stage}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={(ev) => {
                        ev.preventDefault();
                        const r = a.find(
                          (x) => x.id === ev.dataTransfer.getData("text/plain"),
                        );
                        if (r) {
                          const reason =
                            stage === "Rejected"
                              ? prompt("Optional rejection reason") || ""
                              : "";
                          run(() => moveApplication(r, stage, reason));
                        }
                      }}
                    >
                      <div className="kanban-title">
                        <span className="stage-dot" />
                        {stage}
                        <span>
                          {visibleApps.filter((x) => x.stage === stage).length}
                        </span>
                      </div>
                      {visibleApps
                        .filter((x) => x.stage === stage)
                        .map((r) => (
                          <article
                            className="kanban-card"
                            key={r.id}
                            draggable
                            onDragStart={(ev) =>
                              ev.dataTransfer.setData("text/plain", r.id)
                            }
                          >
                            <button
                              className="person"
                              onClick={() => {
                                const candidate = c.find(
                                  (x) => x.id === r.candidateId,
                                );
                                if (candidate) profile(candidate);
                              }}
                            >
                              <div className="avatar">
                                {nameOf(
                                  c.find((x) => x.id === r.candidateId),
                                ).slice(0, 1)}
                              </div>
                              <strong>
                                {nameOf(c.find((x) => x.id === r.candidateId))}
                              </strong>
                            </button>
                            <p>{nameOf(j.find((x) => x.id === r.jobId))}</p>
                            <small>
                              <Clock size={12} />{" "}
                              {Math.floor(
                                days(r.stageSince || r.createdAt, now()),
                              )}{" "}
                              days in stage
                            </small>
                            <select
                              aria-label={`Move ${nameOf(c.find((x) => x.id === r.candidateId))}`}
                              value={r.stage}
                              onChange={(ev) => {
                                const next = ev.target.value;
                                run(() =>
                                  moveApplication(
                                    r,
                                    next,
                                    next === "Rejected"
                                      ? prompt("Optional rejection reason") ||
                                          ""
                                      : "",
                                  ),
                                );
                              }}
                            >
                              {settings.stages.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </article>
                        ))}
                      {!visibleApps.some((x) => x.stage === stage) && (
                        <p className="drop-hint">Drop an application here</p>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Requisition</th>
                        <th>Stage</th>
                        <th>Days in stage</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleApps.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {nameOf(c.find((x) => x.id === r.candidateId))}
                          </td>
                          <td>{nameOf(j.find((x) => x.id === r.jobId))}</td>
                          <td>
                            <select
                              aria-label="Move application"
                              value={r.stage}
                              onChange={(ev) =>
                                run(() => moveApplication(r, ev.target.value))
                              }
                            >
                              {settings.stages.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {Math.floor(
                              days(r.stageSince || r.createdAt, now()),
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                setEditor({ kind: "applications", row: r })
                              }
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          ) : page === "Interviews" ? (
            <>
              <div className="section-actions">
                <p className="muted">
                  Local records only. Export an .ics file to add an interview to
                  your calendar.
                </p>
                <button
                  className="primary"
                  onClick={() => newRecord("interviews")}
                >
                  <Plus size={16} />
                  Record interview
                </button>
              </div>
              <section className="panel">
                {i.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Candidate / requisition</th>
                          <th>Interview</th>
                          <th>Date & time</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...i]
                          .sort((x, y) =>
                            (x.startAt || "").localeCompare(y.startAt || ""),
                          )
                          .map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>
                                  {nameOf(
                                    c.find((x) => x.id === r.candidateId),
                                  )}
                                </strong>
                                <small>
                                  {r.jobId
                                    ? nameOf(j.find((x) => x.id === r.jobId))
                                    : "No requisition"}
                                </small>
                              </td>
                              <td>
                                {r.type}
                                <small>{r.interviewers}</small>
                              </td>
                              <td>
                                {r.date?.replace("T", " ")}
                                <small>{r.timezone}</small>
                              </td>
                              <td>
                                <Badge>{r.status}</Badge>
                              </td>
                              <td>
                                <div className="button-row">
                                  <button
                                    onClick={() =>
                                      setEditor({ kind: "interviews", row: r })
                                    }
                                  >
                                    Edit / feedback
                                  </button>
                                  <button
                                    onClick={() =>
                                      download(
                                        "interview.ics",
                                        ics(
                                          r,
                                          c.find((x) => x.id === r.candidateId),
                                        ),
                                        "text/calendar",
                                      )
                                    }
                                  >
                                    .ics
                                  </button>
                                  {safeURL(r.meetingLink) && (
                                    <a
                                      className="button"
                                      href={safeURL(r.meetingLink)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Meeting link
                                    </a>
                                  )}
                                  <button
                                    className="icon"
                                    aria-label="Delete interview"
                                    onClick={() => askRemove("interviews", r)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Make room for great conversations"
                    text="Record interviews, capture feedback, and export calendar invitations."
                  />
                )}
              </section>
            </>
          ) : page === "Activities" ? (
            <>
              <div className="section-actions">
                <span>
                  {stats.followups} follow-ups · {stats.overdue} overdue
                </span>
                <button
                  className="primary"
                  onClick={() => newRecord("activities")}
                >
                  <Plus size={16} />
                  Log activity
                </button>
              </div>
              <section className="panel">
                {activityList(
                  [...v].sort(
                    (x, y) =>
                      Number(x.completed) - Number(y.completed) ||
                      (x.due || "9999").localeCompare(y.due || "9999"),
                  ),
                )}
              </section>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h3>Outreach templates</h3>
                  <button onClick={() => newRecord("templates")}>
                    <Plus size={16} />
                    New template
                  </button>
                </div>
                <p className="inset muted">
                  Templates are copied or opened in your email client. No
                  messages are sent by this application.
                </p>
                {all.templates.map((r) => (
                  <div className="template-row" key={r.id}>
                    <div>
                      <strong>{r.title}</strong>
                      <small>
                        {r.type} · {r.subject}
                      </small>
                      <p className="pre-wrap">{r.body}</p>
                    </div>
                    <div className="button-row">
                      <button
                        onClick={() =>
                          run(
                            () => navigator.clipboard.writeText(r.body || ""),
                            "Copied to clipboard",
                          )
                        }
                      >
                        <Copy size={15} />
                        Copy
                      </button>
                      <a
                        className="button"
                        href={`mailto:?subject=${encodeURIComponent(r.subject || "")}&body=${encodeURIComponent(r.body || "")}`}
                      >
                        <Mail size={15} />
                        Email client
                      </a>
                      <button
                        onClick={() => setEditor({ kind: "templates", row: r })}
                      >
                        Edit
                      </button>
                      <button
                        className="icon"
                        aria-label="Delete template"
                        onClick={() => askRemove("templates", r)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : page === "Calendar" ? (
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  {calendarMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <div className="button-row">
                  <button
                    aria-label="Previous month"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          new Date().getFullYear(),
                          new Date().getMonth(),
                          1,
                        ),
                      )
                    }
                  >
                    Today
                  </button>
                  <button
                    aria-label="Next month"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              <p className="inset muted">
                Calendar uses this device's time zone:{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              </p>
              <div className="calendar">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
                  <div className="weekday" key={x}>
                    {x}
                  </div>
                ))}
                {Array.from({ length: 42 }, (_, index) => {
                  const d = new Date(
                    calendarMonth.getFullYear(),
                    calendarMonth.getMonth(),
                    1 - calendarMonth.getDay() + index,
                  );
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  const same = (date: string) => {
                    const x = new Date(date);
                    return x.toDateString() === d.toDateString();
                  };
                  return (
                    <div
                      className={`calendar-cell ${d.getMonth() !== calendarMonth.getMonth() ? "muted-day" : ""} ${d.toDateString() === new Date().toDateString() ? "is-today" : ""}`}
                      key={key}
                    >
                      <span>{d.getDate()}</span>
                      {i
                        .filter((x) => x.startAt && same(x.startAt))
                        .map((x) => (
                          <button
                            key={x.id}
                            onClick={() =>
                              setEditor({ kind: "interviews", row: x })
                            }
                          >
                            {time(x.startAt)}{" "}
                            {nameOf(c.find((z) => z.id === x.candidateId))} ·{" "}
                            {x.status}
                          </button>
                        ))}
                      {v
                        .filter((x) => x.due && same(x.due) && !x.completed)
                        .map((x) => (
                          <button
                            className="task-event"
                            key={x.id}
                            onClick={() =>
                              setEditor({ kind: "activities", row: x })
                            }
                          >
                            {x.subject}
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : page === "Reports" ? (
            <>
              <div className="section-actions">
                <div className="button-row">
                  <select
                    aria-label="Report recruiter"
                    value={reportOwner}
                    onChange={(ev) => setReportOwner(ev.target.value)}
                  >
                    <option value="">All recruiters</option>
                    {settings.recruiters.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Report job"
                    value={jobFilter}
                    onChange={(ev) => setJobFilter(ev.target.value)}
                  >
                    <option value="">All requisitions</option>
                    {j.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                  <label>
                    Candidate added from
                    <input
                      type="date"
                      value={reportFrom}
                      onChange={(ev) => setReportFrom(ev.target.value)}
                    />
                  </label>
                  <label>
                    to
                    <input
                      type="date"
                      value={reportTo}
                      onChange={(ev) => setReportTo(ev.target.value)}
                    />
                  </label>
                </div>
                <button onClick={() => window.print()}>
                  <FileText size={16} />
                  Print report
                </button>
              </div>
              <div className="stats-grid">
                {[
                  ["Interview → offer", reportStats.conversion, "%"],
                  ["Offer acceptance", reportStats.acceptance, "%"],
                  ["Time to hire", reportStats.timeToHire, " days"],
                  ["Time to fill", reportStats.timeToFill, " days"],
                ].map(([label, value, unit]) => (
                  <section className="stat-card" key={String(label)}>
                    <span>{label}</span>
                    <strong>
                      {value === null
                        ? "—"
                        : `${Number(value).toFixed(1)}${unit}`}
                    </strong>
                    <small>
                      {value === null
                        ? "No data available"
                        : "Based on recorded milestones"}
                    </small>
                  </section>
                ))}
              </div>
              <div className="report-grid">
                {chart(
                  "Application pipeline",
                  settings.stages.map((s) => ({
                    name: s,
                    value: reportA.filter((x) => x.stage === s).length,
                  })),
                )}
                {chart(
                  "Candidates by requisition",
                  reportJ.map((x) => ({
                    name: x.title,
                    value: reportA.filter((z) => z.jobId === x.id).length,
                  })),
                )}
                {chart(
                  "Candidate sources",
                  [
                    ...new Set(reportC.map((x) => x.source || "Unspecified")),
                  ].map((s) => ({
                    name: s,
                    value: reportC.filter(
                      (x) => (x.source || "Unspecified") === s,
                    ).length,
                  })),
                )}
                {chart(
                  "Requisition status",
                  settings.jobStatuses.map((s) => ({
                    name: s,
                    value: reportJ.filter((x) => x.status === s).length,
                  })),
                )}
                {chart(
                  "Weekly recruiting activity",
                  Array.from({ length: 8 }, (_, idx) => {
                    const end = new Date();
                    end.setDate(end.getDate() - (7 - idx) * 7);
                    const start = new Date(+end - 7 * 86400000);
                    return {
                      name: fmt(start.toISOString()).replace(/, \d{4}/, ""),
                      value: reportV.filter(
                        (x) =>
                          Date.parse(x.date || x.createdAt) >= +start &&
                          Date.parse(x.date || x.createdAt) < +end,
                      ).length,
                    };
                  }),
                  true,
                )}
                {chart(
                  "Monthly recruiting activity",
                  Array.from({ length: 6 }, (_, idx) => {
                    const start = new Date(
                        new Date().getFullYear(),
                        new Date().getMonth() - 5 + idx,
                        1,
                      ),
                      end = new Date(
                        start.getFullYear(),
                        start.getMonth() + 1,
                        1,
                      );
                    return {
                      name: start.toLocaleDateString(undefined, {
                        month: "short",
                      }),
                      value: reportV.filter(
                        (x) =>
                          Date.parse(x.date || x.createdAt) >= +start &&
                          Date.parse(x.date || x.createdAt) < +end,
                      ).length,
                    };
                  }),
                  true,
                )}
                {chart(
                  "Interview activity",
                  [
                    "Scheduled",
                    "Completed",
                    "Rescheduled",
                    "Cancelled",
                    "No Show",
                  ].map((s) => ({
                    name: s,
                    value: reportI.filter((x) => x.status === s).length,
                  })),
                )}
                {chart(
                  "Recruiter activity",
                  [...new Set(reportV.map((x) => x.owner || "Unassigned"))].map(
                    (s) => ({
                      name: s,
                      value: reportV.filter(
                        (x) => (x.owner || "Unassigned") === s,
                      ).length,
                    }),
                  ),
                )}
              </div>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h3>Source effectiveness</h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Candidates</th>
                        <th>Applications</th>
                        <th>Hires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...new Set(
                          reportC.map((x) => x.source || "Unspecified"),
                        ),
                      ].map((s) => {
                        const ids = new Set(
                          reportC
                            .filter((x) => (x.source || "Unspecified") === s)
                            .map((x) => x.id),
                        );
                        return (
                          <tr key={s}>
                            <td>{s}</td>
                            <td>{ids.size}</td>
                            <td>
                              {
                                reportA.filter((x) => ids.has(x.candidateId))
                                  .length
                              }
                            </td>
                            <td>
                              {
                                reportA.filter(
                                  (x) =>
                                    ids.has(x.candidateId) &&
                                    x.stage === "Hired",
                                ).length
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h3>Stage conversion & aging</h3>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Currently in stage</th>
                        <th>Recorded entries</th>
                        <th>Advanced to next stage</th>
                        <th>Mean current age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.stages.map((s, index) => {
                        const rows = reportA.filter((x) => x.stage === s),
                          entered = reportA.filter((x) =>
                            e.some(
                              (z) => z.entityId === x.id && z.toStage === s,
                            ),
                          ),
                          next = settings.stages[index + 1],
                          advanced = entered.filter((x) => {
                            const entry = e
                              .filter(
                                (z) => z.entityId === x.id && z.toStage === s,
                              )
                              .sort((a, b) =>
                                a.createdAt.localeCompare(b.createdAt),
                              )[0];
                            return e.some(
                              (z) =>
                                z.entityId === x.id &&
                                z.toStage === next &&
                                z.createdAt > entry.createdAt,
                            );
                          });
                        return (
                          <tr key={s}>
                            <td>{s}</td>
                            <td>{rows.length}</td>
                            <td>{entered.length}</td>
                            <td>
                              {entered.length && next
                                ? `${((advanced.length / entered.length) * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                            <td>
                              {rows.length
                                ? `${(rows.reduce((sum, x) => sum + days(x.stageSince || x.createdAt, now()), 0) / rows.length).toFixed(1)} days`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h3>Overdue recruiting tasks</h3>
                </div>
                {activityList(
                  reportV.filter(
                    (x) =>
                      !x.completed && x.due && Date.parse(x.due) < Date.now(),
                  ),
                )}
              </section>
              <section className="panel definitions">
                <h3>How these reports are calculated</h3>
                <p>
                  Candidate date filters select a cohort by record creation
                  date; recruiter filters use candidate owner. Requisition
                  filters apply to applications, interviews and activities.
                  Requisition status and time-to-fill use the selected jobs
                  independently of the candidate cohort.
                </p>
                <p>
                  Interview → offer = applications with an interview milestone
                  and an offer/hire milestone ÷ applications with an interview
                  milestone. Offer acceptance = currently hired applications
                  with a recorded offer ÷ applications with an offer milestone.
                  Milestones require the exact current stage or a recorded
                  transition. A hire alone does not establish an earlier
                  interview or offer.
                </p>
                <p>
                  Time-to-hire averages application date to first recorded Hired
                  transition. Time-to-fill averages job open date to its
                  recorded Filled transition. Missing dates are excluded. Stage
                  conversion requires a recorded entry and a later recorded
                  entry into the next configured stage. Activity charts count
                  communication log entries by their activity date, not audit
                  events.
                </p>
              </section>
            </>
          ) : page === "Settings" ? (
            <SettingsPanel
              settings={settings}
              update={updateSettings}
              run={run}
              backup={makeBackup}
              restore={() => restoreRef.current?.click()}
              importOpen={() => setImportOpen(true)}
              confirm={setConfirm}
              candidates={c}
              applications={a}
              jobs={j}
              searches={all.searches}
            />
          ) : null}
          <footer>
            <span>
              <ShieldCheck size={13} /> Local-first. Private by design.
            </span>
            <span className="footer-credit">
              Candidate Tracker · Offline edition · Developed by Sheheryar Ahmad
            </span>
          </footer>
        </main>
      </div>
      <input
        hidden
        ref={restoreRef}
        type="file"
        accept=".json"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file)
            run(async () => {
              if (file.size > 500 * 1024 * 1024)
                throw Error("Backup exceeds the 500 MB restore limit.");
              const b = JSON.parse(await file.text());
              validateBackup(b);
              setRestoreData(b);
            }, "Backup validated. Review before restoring.");
          ev.target.value = "";
        }}
      />
      {restoreData && (
        <Modal
          title="Restore validated backup"
          onClose={() => setRestoreData(null)}
        >
          <div className="modal-body">
            <p>
              This backup contains {restoreData.data.candidates.length}{" "}
              candidates, {restoreData.data.jobs.length} jobs, and{" "}
              {restoreData.data.attachments.length} attachments.
            </p>
            <p>
              <strong>Restoring replaces all current workspace data.</strong>{" "}
              Create a backup of the current workspace first.
            </p>
            <div className="button-row">
              <button onClick={makeBackup}>Back up current data</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    text: "Replace all current data with this backup? This is an atomic replacement, not a merge.",
                    run: async () => {
                      await restore(restoreData);
                      setRestoreData(null);
                    },
                  })
                }
              >
                Replace workspace
              </button>
            </div>
          </div>
        </Modal>
      )}
      {editor && (
        <Editor
          kind={editor.kind}
          row={editor.row || {}}
          settings={settings}
          candidates={c}
          jobs={j}
          close={() => setEditor(null)}
          onSave={async (values, allow) => {
            try {
              await save(editor.kind, values, { allowDuplicate: allow });
              setEditor(null);
              setNotice("Saved successfully");
              return true;
            } catch (err) {
              return (err as Error).message;
            }
          }}
        />
      )}
      {confirm && (
        <Modal title="Confirm action" onClose={() => setConfirm(null)}>
          <div className="modal-body">
            <p>{confirm.text}</p>
            <div className="modal-actions">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  if (await run(confirm.run, "Action completed"))
                    setConfirm(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
      {importOpen && (
        <ImportModal
          candidates={c}
          settings={settings}
          close={() => setImportOpen(false)}
          run={run}
        />
      )}
    </div>
  );
}
function Editor({
  kind,
  row,
  settings,
  candidates,
  jobs,
  close,
  onSave,
}: {
  kind: Kind;
  row: Partial<Row>;
  settings: Settings;
  candidates: Row[];
  jobs: Row[];
  close: () => void;
  onSave: (r: Partial<Row>, allow: boolean) => Promise<boolean | string>;
}) {
  const [values, setValues] = useState(row),
    [allow, setAllow] = useState(false),
    [saving, setSaving] = useState(false),
    [localError, setLocalError] = useState("");
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setLocalError("");
    try {
      validate(kind, values);
      const result = await onSave(values, allow);
      if (typeof result === "string") setLocalError(result);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`${row.id ? "Edit" : "Add"} ${kind === "candidates" ? "candidate" : kind === "jobs" ? "requisition" : kind.replace(/s$/, "")}`}
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            {fields(kind, settings).map((f) => (
              <label
                key={f.key}
                className={f.type === "textarea" ? "span-two" : ""}
              >
                {f.label}
                {f.required && <span className="required"> *</span>}
                {["select", "candidate", "job"].includes(f.type || "") ? (
                  <select
                    required={f.required}
                    value={values[f.key] || ""}
                    onChange={(ev) =>
                      setValues({ ...values, [f.key]: ev.target.value })
                    }
                  >
                    <option value="">Select {f.label.toLowerCase()}</option>
                    {f.type === "candidate"
                      ? candidates.map((x) => (
                          <option key={x.id} value={x.id}>
                            {nameOf(x)} · {x.email || x.id.slice(0, 8)}
                          </option>
                        ))
                      : f.type === "job"
                        ? jobs.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.title} · {x.requisitionId || x.id.slice(0, 8)}
                            </option>
                          ))
                        : [
                            ...new Set([
                              ...(f.options || []),
                              ...(values[f.key] ? [values[f.key]] : []),
                            ]),
                          ].map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    value={values[f.key] || ""}
                    onChange={(ev) =>
                      setValues({ ...values, [f.key]: ev.target.value })
                    }
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.key])}
                    onChange={(ev) =>
                      setValues({ ...values, [f.key]: ev.target.checked })
                    }
                  />
                ) : (
                  <input
                    type={f.type}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.type === "number" ? "any" : undefined}
                    required={f.required}
                    value={values[f.key] ?? ""}
                    onChange={(ev) =>
                      setValues({ ...values, [f.key]: ev.target.value })
                    }
                  />
                )}
              </label>
            ))}
          </div>
          {kind === "candidates" && (
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={allow}
                onChange={(ev) => setAllow(ev.target.checked)}
              />
              I reviewed duplicate matches and intentionally want a separate
              record.
            </label>
          )}
          {kind === "interviews" && (
            <p className="muted">
              This creates a local interview record. It does not contact the
              candidate or update an external calendar. During the repeated
              daylight-saving hour, use the exported UTC time to verify the
              intended occurrence.
            </p>
          )}
          {localError && (
            <p role="alert" className="error-text">
              {localError}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Attachments({
  candidate,
  run,
  askRemove,
}: {
  candidate: Row;
  run: any;
  askRemove: (kind: Kind, r: Row) => void;
}) {
  const rows =
    useLiveQuery(
      () => db.attachments.where("candidateId").equals(candidate.id).toArray(),
      [candidate.id],
    ) || [];
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Resumes</h3>
        <label className="button">
          <Upload size={15} />
          Upload resume
          <input
            hidden
            type="file"
            accept=".pdf,.docx"
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (file) run(() => attach(candidate.id, file));
              ev.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="inset muted">
        PDF or DOCX · 10 MB per file ·{" "}
        {(rows.reduce((s, r) => s + r.size, 0) / 1024 / 1024).toFixed(2)} MB
        stored
      </p>
      {rows.map((r) => (
        <div className="list-row" key={r.id}>
          <FileText size={18} />
          <span className="grow">
            {r.name}
            <small>{(r.size / 1024).toFixed(0)} KB</small>
          </span>
          <button onClick={() => download(r.name, attachmentBlob(r))}>
            Download
          </button>
          <button
            className="icon"
            aria-label="Delete resume"
            onClick={() => askRemove("attachments", r)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </section>
  );
}
function ImportModal({
  candidates,
  settings,
  close,
  run,
}: {
  candidates: Row[];
  settings: Settings;
  close: () => void;
  run: any;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [skip, setSkip] = useState(true),
    [filename, setFilename] = useState(""),
    [error, setError] = useState("");
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const mapped: Partial<Row>[] = rows.map((r) =>
    Object.fromEntries(
      Object.entries(mapping)
        .filter(([, source]) => source)
        .map(([dest, source]) => [dest, r[source] || ""]),
    ),
  );
  const emails = new Set(
      candidates.map((x) => emailKey(x.email)).filter(Boolean),
    ),
    phones = new Set(candidates.map((x) => phoneKey(x.phone)).filter(Boolean));
  const preview = mapped.map((r, index) => {
    let issue = "";
    try {
      validate("candidates", r);
    } catch (err) {
      issue = (err as Error).message;
    }
    const email = emailKey(r.email),
      phone = phoneKey(r.phone);
    if ((email && emails.has(email)) || (phone && phones.has(phone)))
      issue = issue || "Duplicate email or phone";
    if (r.status && !settings.stages.includes(r.status))
      issue = issue || "Unknown candidate status";
    if (!issue) {
      if (email) emails.add(email);
      if (phone) phones.add(phone);
    }
    return {
      row: { status: settings.stages[0], ...r } as Partial<Row>,
      issue,
      index,
    };
  });
  const valid = preview.filter((x) => !x.issue);
  return (
    <Modal title="Import candidates" onClose={close} wide>
      <div className="modal-body">
        <p>
          Import CSV or XLSX into new candidate records. Existing records are
          never overwritten.
        </p>
        <label className="upload-zone">
          <Upload size={26} />
          <strong>{filename || "Choose a CSV or XLSX file"}</strong>
          <span>Maximum 20 MB · first worksheet · header row required</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={async (ev) => {
              const file = ev.target.files?.[0];
              if (!file) return;
              setError("");
              try {
                const data = await readImport(file);
                if (!data.length) throw Error("File has no data rows.");
                if (data.length > 20000)
                  throw Error("Import at most 20,000 rows at once.");
                setRows(data);
                setFilename(file.name);
                const headers = Object.keys(data[0]);
                setMapping(
                  Object.fromEntries(
                    candidateColumns.map((k) => [
                      k,
                      headers.find(
                        (h) =>
                          h.replace(/[\s_-]/g, "").toLowerCase() ===
                          k.toLowerCase(),
                      ) || "",
                    ]),
                  ),
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        {rows.length > 0 && (
          <>
            <h3>Map your columns</h3>
            <div className="mapping-grid">
              {candidateColumns.map((k) => (
                <label key={k}>
                  {k}
                  {["firstName", "lastName"].includes(k) ? " *" : ""}
                  <select
                    value={mapping[k] || ""}
                    onChange={(ev) =>
                      setMapping({ ...mapping, [k]: ev.target.value })
                    }
                  >
                    <option value="">Do not import</option>
                    {columns.map((col) => (
                      <option key={col}>{col}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <h3>
              Preview · {rows.length} rows · {valid.length} valid ·{" "}
              {rows.length - valid.length} issues
            </h3>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={skip}
                onChange={(ev) => setSkip(ev.target.checked)}
              />
              Skip invalid and duplicate rows (all other rows import atomically)
            </label>
            <div className="table-wrap preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 100).map((x) => (
                    <tr key={x.index}>
                      <td>{x.index + 2}</td>
                      <td>{nameOf(x.row as Row)}</td>
                      <td>{x.row.email}</td>
                      <td>{x.issue || "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Preview shows the first 100 rows. All rows are validated.
            </p>
            <button
              onClick={() =>
                download(
                  "import-validation-errors.csv",
                  "row,error\n" +
                    preview
                      .filter((x) => x.issue)
                      .map((x) => `${x.index + 2},${JSON.stringify(x.issue)}`)
                      .join("\n"),
                  "text/csv",
                )
              }
            >
              Download error report
            </button>
          </>
        )}
      </div>
      <div className="modal-actions">
        <button onClick={close}>Cancel</button>
        <button
          className="primary"
          disabled={!valid.length || (!skip && valid.length !== rows.length)}
          onClick={() =>
            run(async () => {
              await importCandidates(valid.map((x) => x.row));
              close();
            }, `Imported ${valid.length} candidates`)
          }
        >
          Import {valid.length} new candidates
        </button>
      </div>
    </Modal>
  );
}
function SettingsPanel({
  settings,
  update,
  run,
  backup,
  restore,
  importOpen,
  confirm,
  candidates,
  applications,
  jobs,
  searches,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => Promise<void>;
  run: any;
  backup: () => unknown;
  restore: () => void;
  importOpen: () => void;
  confirm: (v: { text: string; run: () => Promise<unknown> }) => void;
  candidates: Row[];
  applications: Row[];
  jobs: Row[];
  searches: Row[];
}) {
  const [draft, setDraft] = useState(settings),
    [storage, setStorage] = useState<{ usage?: number; quota?: number }>({});
  useEffect(() => {
    navigator.storage
      ?.estimate()
      .then(setStorage)
      .catch(() => {});
  }, []);
  useEffect(() => setDraft(settings), [settings]);
  const store = () =>
    run(async () => {
      if (!draft.name.trim()) throw Error("Application name is required.");
      new Intl.DateTimeFormat("en", { timeZone: draft.timezone });
      for (const key of [
        "stages",
        "sources",
        "recruiters",
        "customFields",
        "jobStatuses",
      ] as const) {
        if (
          new Set(draft[key]).size !== draft[key].length ||
          draft[key].some((x) => !x.trim())
        )
          throw Error(`Duplicate ${key}.`);
      }
      if (!draft.stages.length || !draft.jobStatuses.length)
        throw Error("At least one stage and requisition status is required.");
      const usedStages = new Set(
        [
          ...applications.map((x) => x.stage),
          ...candidates.map((x) => x.status),
        ].filter(Boolean),
      );
      if ([...usedStages].some((s) => !draft.stages.includes(s)))
        throw Error(
          "Move existing records out of a stage before removing or renaming it.",
        );
      if (jobs.some((x) => x.status && !draft.jobStatuses.includes(x.status)))
        throw Error("Update jobs before removing their status.");
      await update(draft);
    });
  return (
    <div className="settings-grid">
      <div>
        <section className="panel settings-panel">
          <h3>About</h3>
          <p>{settings.name} · Offline edition · v1.0</p>
          <p>Developed by Sheheryar Ahmad</p>
        </section>
        <section className="panel settings-panel">
          <h3>Workspace preferences</h3>
          <div className="form-grid">
            <label>
              Application name
              <input
                value={draft.name}
                onChange={(ev) => setDraft({ ...draft, name: ev.target.value })}
              />
            </label>
            <label>
              Theme
              <select
                value={draft.theme}
                onChange={(ev) =>
                  setDraft({ ...draft, theme: ev.target.value })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              Default IANA time zone
              <input
                value={draft.timezone}
                onChange={(ev) =>
                  setDraft({ ...draft, timezone: ev.target.value })
                }
              />
            </label>
            <label>
              Date format
              <select
                value={draft.dateFormat}
                onChange={(ev) =>
                  setDraft({ ...draft, dateFormat: ev.target.value })
                }
              >
                <option value="locale">Browser locale</option>
                <option value="iso">YYYY-MM-DD</option>
              </select>
            </label>
            <label>
              Time format
              <select
                value={draft.timeFormat}
                onChange={(ev) =>
                  setDraft({ ...draft, timeFormat: ev.target.value })
                }
              >
                <option value="24">24 hour</option>
                <option value="12">12 hour</option>
              </select>
            </label>
            <label>
              Retention review age (days)
              <input
                type="number"
                min="1"
                value={draft.retentionDays}
                onChange={(ev) =>
                  setDraft({
                    ...draft,
                    retentionDays: Math.max(1, Number(ev.target.value)),
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={draft.backupReminder}
              onChange={(ev) =>
                setDraft({ ...draft, backupReminder: ev.target.checked })
              }
            />
            Remind me to back up after 7 days
          </label>
          <button className="primary" onClick={store}>
            Save settings
          </button>
        </section>
        <section className="panel settings-panel">
          <h3>Pipeline stages</h3>
          <p className="muted">
            Reorder stages with the arrows. Names used by existing records
            cannot be removed. Standard milestone names power offer and hiring
            reports.
          </p>
          {draft.stages.map((s, index) => (
            <div className="stage-setting" key={index}>
              <GripVertical size={16} />
              <input
                aria-label={`Stage ${index + 1}`}
                value={s}
                onChange={(ev) =>
                  setDraft({
                    ...draft,
                    stages: draft.stages.map((x, k) =>
                      k === index ? ev.target.value : x,
                    ),
                  })
                }
              />
              <button
                aria-label={`Move ${s} up`}
                disabled={!index}
                onClick={() => {
                  const stages = [...draft.stages];
                  [stages[index - 1], stages[index]] = [
                    stages[index],
                    stages[index - 1],
                  ];
                  setDraft({ ...draft, stages });
                }}
              >
                ↑
              </button>
              <button
                aria-label={`Move ${s} down`}
                disabled={index === draft.stages.length - 1}
                onClick={() => {
                  const stages = [...draft.stages];
                  [stages[index + 1], stages[index]] = [
                    stages[index],
                    stages[index + 1],
                  ];
                  setDraft({ ...draft, stages });
                }}
              >
                ↓
              </button>
              <button
                aria-label={`Remove ${s}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    stages: draft.stages.filter((_, k) => k !== index),
                  })
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <div className="button-row">
            <button
              onClick={() =>
                setDraft({ ...draft, stages: [...draft.stages, "New stage"] })
              }
            >
              Add stage
            </button>
            <button className="primary" onClick={store}>
              Save stages
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <h3>Lists & custom fields</h3>
          <div className="form-grid">
            {(
              ["sources", "recruiters", "customFields", "jobStatuses"] as const
            ).map((key) => (
              <label key={key}>
                {key === "customFields"
                  ? "Custom candidate fields"
                  : key === "jobStatuses"
                    ? "Requisition statuses"
                    : key === "sources"
                      ? "Candidate sources"
                      : "Recruiter names"}{" "}
                (one per line)
                <textarea
                  defaultValue={settings[key].join("\n")}
                  key={key + settings[key].join("|")}
                  onBlur={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      [key]: ev.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <button className="primary" onClick={store}>
            Save lists
          </button>
        </section>
      </div>
      <div>
        <section className="panel settings-panel">
          <h3>Backup & recovery</h3>
          <p>
            Browser data is local and is not encrypted by this app. Clearing
            site data, using private browsing, or switching profiles can remove
            access to your records.
          </p>
          <p>
            Backups contain confidential candidate information and attachments.
            Store them securely.
          </p>
          <div className="button-row">
            <button className="primary" onClick={backup}>
              <Download size={16} />
              Backup Data
            </button>
            <button onClick={restore}>
              <Upload size={16} />
              Restore backup
            </button>
          </div>
          <small>
            Last backup download:{" "}
            {settings.lastBackup
              ? new Date(settings.lastBackup).toLocaleString()
              : "Never"}
          </small>
        </section>
        <section className="panel settings-panel">
          <h3>Storage & portability</h3>
          <p>
            {((storage.usage || 0) / 1024 / 1024).toFixed(1)} MB used{" "}
            {storage.quota
              ? `of approximately ${(storage.quota / 1024 / 1024 / 1024).toFixed(1)} GB browser quota`
              : ""}
            .
          </p>
          <button
            onClick={() =>
              run(async () => {
                const ok = await navigator.storage?.persist();
                if (!ok)
                  throw Error(
                    "Persistent storage was not granted. Keep regular backups.",
                  );
              }, "Persistent storage granted. Backups are still recommended.")
            }
          >
            Request persistent storage
          </button>
          <div className="button-row spaced">
            <button onClick={importOpen}>Import CSV / XLSX</button>
            <button
              onClick={() =>
                run(
                  () => exportCandidates(candidates, "xlsx"),
                  "Export created",
                )
              }
            >
              Export XLSX
            </button>
          </div>
        </section>
        <section className="panel settings-panel">
          <h3>Saved searches</h3>
          {searches.map((r) => (
            <div className="list-row" key={r.id}>
              <span>{r.title}</span>
              <button
                aria-label={`Delete search ${r.title}`}
                onClick={() =>
                  confirm({
                    text: `Delete saved search ${r.title}?`,
                    run: () => remove("searches", r.id),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!searches.length && (
            <p className="muted">Save searches from the Candidates page.</p>
          )}
        </section>
        <section className="panel settings-panel danger-zone">
          <h3>Data retention</h3>
          <p>
            {
              candidates.filter(
                (x) => days(x.updatedAt, now()) >= draft.retentionDays,
              ).length
            }{" "}
            candidates have not been updated in {draft.retentionDays} days.
            Retention never deletes data automatically.
          </p>
          <button
            onClick={() =>
              confirm({
                text: `Archive candidates not updated in ${draft.retentionDays} days? No records will be deleted.`,
                run: async () => {
                  await db.transaction("rw", db.tables, async () => {
                    for (const r of candidates.filter(
                      (x) =>
                        !x.archived &&
                        days(x.updatedAt, now()) >= draft.retentionDays,
                    ))
                      await save(
                        "candidates",
                        { ...r, archived: true },
                        { allowDuplicate: true },
                      );
                  });
                },
              })
            }
          >
            Archive stale candidates
          </button>
          <hr />
          <h3>Clear workspace</h3>
          <p>
            Permanently delete all records, resumes, history, and settings.
            Export a backup first.
          </p>
          <button
            className="danger"
            onClick={() => {
              const typed = prompt(
                "Type DELETE ALL to confirm clearing the entire workspace.",
              );
              if (typed === "DELETE ALL")
                confirm({
                  text: "Final confirmation: delete all application data in this browser?",
                  run: () =>
                    db.transaction("rw", db.tables, async () => {
                      for (const t of db.tables) await t.clear();
                    }),
                });
            }}
          >
            Clear all application data
          </button>
        </section>
      </div>
    </div>
  );
}
