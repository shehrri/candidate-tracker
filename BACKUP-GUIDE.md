# Backup and recovery

1. Click **Backup Data** in the sidebar. Save the downloaded JSON file somewhere protected and separate from the browser profile.
2. Verify that the download completed. The last-backup indicator records a download being created, not confirmation that the file was safely retained.
3. Back up before imports, merges, deletions, browser maintenance, and device changes. Optional reminders appear after seven days.
4. To move devices, copy the application folder and a backup. Launch the application, then use Settings → Restore backup.
5. Choose the JSON file. Validation happens before any data is changed. Review record and attachment counts.
6. Back up the current workspace if it contains anything you need, then choose Replace workspace and confirm. Restore replaces, rather than merges, all application tables atomically.
7. Open several profiles, inspect applications/history, and download a resume to verify recovery.

## Format

The JSON envelope uses `format: "candidate-tracker"`, `version: 1`, an ISO `createdAt`, and a `data` object containing arrays for candidates, jobs, applications, interviews, activities, notes, attachments, audit, searches, templates, and settings. Database schema version is independent (currently 2). Attachments carry their metadata and base64 bytes instead of Blob objects. Backup preserves IDs, custom profile fields, timestamps, and application links.

Validation checks format/version, required tables, IDs, required fields, timestamps, foreign keys, unique candidate/job application pairs, settings lists, and attachment byte sizes/signatures. Restore rejects unsupported versions, missing relationships, malformed attachment encodings, and invalid required fields. If writing fails, the transaction rolls back to the previous workspace. Restore is limited to 500 MB JSON; base64 increases attachment size by about one third. Very large collections should be backed up frequently and tested for restore within browser memory limits.

## Recovery limits

If browser site data was cleared and no backup exists, this application cannot recover it. Copying the portable folder does not copy IndexedDB data. A different browser, profile, hostname, or port is a different storage location. Always use `http://127.0.0.1:47831`, not localhost or a file URL.

Backups are not encrypted and include confidential PII, including notes and resumes. Protect them using your organization's storage controls. No password recovery service or cloud copy exists.
