# Contributing

Candidate Tracker is developed by Sheheryar Ahmad and licensed under MIT.
Contributions are welcome through issues and pull requests.

## Before starting

Describe the problem or proposed change in an issue. For substantial changes,
agree on the scope before implementation. Do not upload real candidate records,
resumes, browser databases, backups, credentials, or private screenshots.
Use clearly synthetic fixtures for reproductions.

## Development

Install a current Node.js version compatible with the locked dependencies, then:

```
npm ci
npm run dev
npm test
npm run build
```

For browser tests, see DEVELOPER-GUIDE.md. Test browsers use isolated profiles;
do not run tests against a browser profile containing real recruitment data.

## Pull requests

Explain the user-facing problem, the change, and the validation performed.
Keep changes focused. Add meaningful tests for changes to storage, imports,
backup/restore, search, and metric calculations. Never invent test results or
browser/OS compatibility claims.

Preserve offline operation, local-only candidate storage, keyboard access, and
clear confirmation before destructive operations. Do not introduce telemetry,
remote assets, or mandatory external services.

By submitting a contribution, you agree to license it under this project's MIT
license. Third-party material must retain its applicable notices and licenses.
