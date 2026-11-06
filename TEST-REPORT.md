# Validation record

Build and automated validation were performed on macOS Apple Silicon in this workspace. This is an implementation and portable distribution with the following verified scope; it is not a claim of native testing on every supported operating system.

## Automated checks

- TypeScript production build passes; all scripts, icons, styles, charts and spreadsheet libraries are locally bundled.
- 31 unit/integration tests exercise candidate create/edit/archive/delete, duplicate normalization and prevention, concurrent-edit rejection, per-job applications, stage history, cascading behavior, atomic import rollback, merge preservation, PDF/DOCX attachments, versioned backup round trips, malformed backup rejection, restore index repair, schema migration, Boolean precedence, time-zone conversion, ICS, overdue follow-ups, real-data metric calculations, and XLSX literal strings, Unicode, leading zeroes, dates, empty rows and malformed inputs.
- Browser suite: 13 executed tests across Playwright Chromium, Firefox and WebKit. Four functional workflows run in each engine; the 10,000-record exercise runs only in Chromium. The two other performance instances are intentionally skipped. See `artifacts/browser-tests.json` in the source workspace for exact run results.
- Functional workflows cover candidate/job creation, application movement, interviews and ICS download, resume upload and base64 backup, timestamped notes, refresh persistence, theme persistence, CSV/XLSX preview/duplicate handling/export, archive/delete, restore, external-request blocking, settings, follow-ups, templates, calendar, reports, and drag-and-drop.
- Synthetic records exist only in isolated test browser contexts. The shipped application has no seeded candidate records or invented metrics.

The first WebKit attachment test exposed a Blob storage error. Attachments now store ArrayBuffers, construct Blobs only for downloads/backup conversion, and pass the same workflow in WebKit. Existing Blob-backed records are still readable for compatibility.

## Scale exercise

The Chromium test writes 10,000 synthetic candidate fixtures to an isolated IndexedDB, reloads the application, verifies exactly 50 rendered table rows and 200 pages, then searches for a unique skill and verifies the single correct result. An earlier run on this test host observed 176 ms for reload/table readiness and 24 ms for search plus assertion. Timing observations are attached to the JSON test report. This is a functional scale exercise, not a universal performance guarantee or a complete benchmark of 10,000 attachments/applications. No test data is bundled with the application.

## Portable runtime and launch validation

Official Node.js v22.23.4 runtimes are bundled for Windows x64/ARM64 and macOS x64/ARM64, verified against the official SHA-256 manifest. The source includes repeatable packaging and launch inspection scripts. `artifacts/launcher-check.json` records the actual packaged macOS ARM64 launch, HTTP security checks, and responsive screenshot inspection after that script completes.

Windows testing is reported completed by the owner; it was not independently repeated in this workspace, and individual Windows versions/architectures were not specified. macOS Intel, Edge, and Apple's shipping Safari application were not available for direct testing. Playwright WebKit provides engine coverage but is not a substitute for testing the shipping Safari app. macOS downloaded-file quarantine / Gatekeeper and enterprise endpoint policies require validation on recipient devices. This project does not sign or notarize launchers.

## Dependency audit

On November 5, 2026, both `npm audit --json` and `npm audit --omit=dev --json` reported **zero vulnerabilities**. ExcelJS and its transitive UUID dependency were removed, including ExcelJS's prebuilt browser bundle. XLSX support now uses read-excel-file 9.3.14 and write-excel-file 4.1.1 via their universal entry points, without workers or external requests. The lockfile contains neither ExcelJS nor UUID. CSV/XLSX imports and exports pass in Chromium, Firefox and WebKit. Audit results are a point-in-time registry check, not a guarantee against undiscovered vulnerabilities.

## Intentional limitations / release checks

- Browser-local storage is not encrypted by this app; backups are required for recovery and device transfer.
- End-user data is tied to the same browser/profile and `http://127.0.0.1:47831`. It is not written to the application folder.
- Candidate tables use pagination rather than virtualization; metadata stays in memory for Boolean search. Attachments load only when requested.
- JSON candidate export is not a full backup. Full restores replace the entire workspace and have a 500 MB input limit.
- Standard stage names identify reporting milestones. Custom stage names are supported, but do not automatically acquire interview/offer/hire semantics.
- ICS events currently have a fixed one-hour duration. Repeated daylight-saving hours need human verification of the UTC occurrence.
- PDF/DOCX signature/container checks are not antivirus scanning. Documents are downloaded, not executed or embedded.
- Messages and calendar invitations are never sent automatically; there are no external integrations.

Before broad distribution: run the Mac launcher on Intel macOS and a quarantined fresh download, verify browser profile recovery using a real protected backup, and periodically rerun dependency audits.
