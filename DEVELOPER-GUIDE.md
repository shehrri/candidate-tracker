# Developer guide

## Architecture

React + TypeScript + Vite; Tailwind's local build integration and semantic CSS; Lucide icons; Recharts; Dexie IndexedDB; Papa Parse CSV; lazy-loaded read-excel-file/write-excel-file XLSX and JSZip DOCX validation. No production external requests, fonts, service workers, or cloud APIs. React escapes text. Links accept http/https only; mailto is built with encoded fields. Uploaded documents are download-only. CSV/XLSX exports escape formula-like prefixes.

`src/model.ts`: validation, IDs, duplicate normalization, recursive-descent Boolean parser, zone conversion, ICS, metric formulas.
`src/db.ts`: Dexie schema and migrations, atomic domain mutations, cascading delete, merge, attachments, backup and restore.
`src/io.ts`: candidate tabular import/export.
`src/fields.ts`: form metadata.
`src/App.tsx`: reactive workspaces, forms, charts, filters, and settings.
`server.cjs`: loopback-only read-only file server; host checking, path isolation, CSP, no cross-origin API, no mutation endpoints.
`scripts/package.mjs`: build distribution, download official runtimes, verify SHA-256, bundle launchers and docs.

## Build and test

Developers require Node.js and npm. End users do not.

```
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium firefox webkit
mkdir -p app
cp -R dist/. app/
npm run test:e2e
npm run package
```

The packaging command requires internet only during development to retrieve runtime archives. Runtime archives are cached in `.runtime-cache`. The package includes macOS ARM64/x64 and Windows ARM64/x64; 32-bit Windows is not supported. Build output is in `dist`; the full portable distribution is `CandidateTracker`. The root `app` directory is a test copy of the build. Do not run test contexts against personal candidate data: each browser test uses an isolated browser context.

## Reliability

All domain mutations and their audit records share a transaction. Candidate/job relationships are checked on save. Applications use a unique compound candidate/job index. Imports reject duplicates again inside the transaction. Restore validates before opening its atomic replacement transaction. Candidate updates carry timestamps for stale-edit detection. Resume binary buffers are not loaded by the global workspace query, only the selected profile or explicit backup.

The database moves from schema 1 to schema 2 by making application pairs unique. Version 1 was an internal pre-release schema; it did not permit duplicate pairs through domain writes. Externally corrupted version-1 databases with duplicate pairs require recovery before upgrading. The migration test verifies intact version-1 records survive.

Candidate search text and relationship stage lookups are memoized, avoiding per-row scans of all related data during queries. Tables render at most 50 candidates. Full candidate metadata is kept in memory for flexible Boolean search and client-side reports; this is pagination rather than row virtualization. Large attachments remain binary buffers in IndexedDB to avoid WebKit Blob storage failures. No 10,000-record performance claim should be made without running the benchmark/test described in TEST-REPORT.md on the intended hardware.

## Security and portability tradeoffs

The server binds only to 127.0.0.1:47831, rejects foreign Host headers and mutation verbs, and provides no filesystem writes or record API. CSP blocks remote scripts, images, network connections, frames, and form submissions. UI link opening and mailto are user-initiated. The runtime does not receive candidate records. Runtime binaries are official downloads verified against official SHA-256 manifests; this is integrity checking, not independent signing by this project.

The app intentionally does not use file:// because IndexedDB origins and module loading vary across browsers. A fixed loopback HTTP origin provides consistent browser storage and supports localhost secure-context APIs without certificates. Browser eviction, private browsing, clearing site data, and profile changes remain limitations. Storage.persist is optional and not guaranteed. No encryption or local password-lock claims are made.

macOS Gatekeeper, endpoint protection, or enterprise policies can block downloaded scripts/runtimes. Distribution is not code-signed or notarized by this project. Windows and Intel/ARM64 launch scripts and binary presence can be inspected on macOS, and native Windows testing was reported completed by the owner (not independently repeated here).

## Dependencies

See package-lock.json for pinned resolved dependencies. Build dependencies are not shipped to users. ExcelJS and its transitive UUID dependency were removed in favor of focused XLSX reader/writer libraries. Current audit results are recorded in TEST-REPORT.md. Do not blindly downgrade or override incompatible transitive dependencies to hide advisories.
