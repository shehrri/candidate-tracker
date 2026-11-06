# User guide

## Start with your own records

The application starts empty. Add a job, then add candidates and link applications to jobs. Use Settings to enter recruiter names, candidate sources, and custom fields. Required candidate fields are first and last name. Email and phone are optional, but supplied email addresses must be valid.

Candidate status describes the overall profile. Each application has a separate recruiting stage. Moving an application does not change another application or silently overwrite the overall profile status. Dashboard and report pipeline counts use applications; candidate totals use unique profiles.

## Candidates and jobs

Use Add candidate and Add job in the top bar. Click a candidate name or job title to open details. Edit profile changes its fields. Candidate IDs are generated automatically; job requisition references are optional user-entered identifiers.

Candidate details provide application linking, timestamped notes, activity history, attachments, interview records, follow-ups, archive/unarchive, print, and confirmed deletion. A job detail has its own linked candidates, activities, interviews, and history. Jobs can also be archived from their cards; archived jobs remain visible with a badge for review.

Resume uploads accept PDF or DOCX, up to 10 MB per file, with extension and signature checks. DOCX uploads must contain the expected Word document entries. Files are stored as browser-local binary buffers and downloaded using the original filename. Uploaded content is never embedded as executable HTML. View a downloaded resume in your trusted document viewer.

Potential duplicates match a trimmed, case-insensitive email or a digits-only phone. Country-code differences are not inferred. Creation blocks matches unless you explicitly check the separate-record override. Duplicate warnings in a candidate profile let you merge after confirmation. The current profile's values stay intact, related records move over, and the other profile and conflicting applications are retained as timestamped note snapshots. Duplicate application stages are not silently combined.

## Pipeline

Each candidate can have one application per requisition and can apply to many requisitions. Add an application from Pipeline or either record's detail view. Drag a card into a stage, or use its stage selector for keyboard and touch access. Table view provides the same movement operation. Rejected moves offer an optional reason; application editing also exposes this field.

Settings allows stage creation, removal, and reordering. Move all profiles/applications out of a stage before renaming or removing it. Standard names Interview, Final Interview, Offer, Hired, Rejected, Withdrawn, and Hiring Manager Review define report milestones; renaming these changes their reporting semantics. There is no automatic substitution of missing milestones.

## Search

Candidate search includes names, titles, employer, skills, candidate IDs, requisition IDs/references/titles, tags, profile notes, and timestamped notes. Operators are uppercase: NOT, AND, OR. Precedence is **NOT, then AND, then OR**. Adjacent terms imply AND. Parentheses override precedence. Double quotes match a contiguous phrase. Matching is case-insensitive substring matching. Examples:

- `React AND TypeScript`
- `(Python OR Java) AND NOT Junior`
- `"project manager" AND remote`

An invalid expression shows an error rather than silently returning misleading matches. Combine stage, recruiter, source, location, minimum experience, and application-date filters. A stage filter matches either overall candidate status or any linked application's stage. Save searches for later. Sort by name, status, date added, or latest activity. Results are paginated in groups of 50.

## Interviews and calendar

Record interview date/time in the named IANA time zone, such as America/New_York or Europe/London. The app converts this to a UTC instant; daylight-saving gaps are rejected. Repeated fall-back hours can be ambiguous, so verify the exported UTC occurrence. Interview edit supports feedback, decision, next steps, status, and meeting link.

The Calendar displays interviews and incomplete follow-ups in the device's time zone, stated above the calendar. Export .ics downloads a one-hour event in UTC. Import it into your calendar yourself. The app does not send invitations, schedule with candidates, or synchronize Google/Outlook calendars.

## Activities and outreach

Log an email, call, LinkedIn message, text, interview, follow-up, or note. You are recording an activity, not sending a message. Add a next action and due date to create an in-app reminder. Overdue indicators refresh every minute while the app is open. Check tasks complete or reopen them. Follow-up dates use the device's local time.

Outreach templates support copying their body or opening the default email client with subject and body. The recipient is chosen in that client. No message is automatically sent.

## Import and export

Import CSV or XLSX through Candidates or Settings. The first row contains headers; XLSX uses the first worksheet. Map columns, then review validation and duplicate errors. Preview displays 100 rows but validates all rows. Download the error report for correction. Up to 20,000 rows / 20 MB per file are supported. Valid rows can be imported while explicitly skipping invalid/duplicate rows. Imports create records only and never overwrite existing candidates. The accepted set is committed in one transaction; a write failure rolls everything back.

CSV and XLSX export include filtered candidate results and standard profile fields. Potential spreadsheet formula prefixes are escaped. JSON records export is a candidate-only export, **not a restorable backup**. Use Backup Data for all custom fields, relationships, settings, history, and attachments.

## Reports

Dashboard shows unique candidate counts and application-based hiring counts. Reports can select candidate creation-date cohorts, candidate owners, and requisitions. Read the formula panel on Reports before interpreting conversion metrics. No denominator means no data, displayed as an em dash. Charts remain empty until real records exist.

Time-to-hire requires an application date and a recorded Hired transition. Time-to-fill requires a job opened date and a Filled transition. A manually entered Hired application does not imply an unrecorded offer/interview. Stage aging measures elapsed time since the last stage change. Print reports and profiles using the browser's print dialog or Save as PDF.

## Retention and privacy

Settings can archive candidates not updated within a chosen number of days, after confirmation. Retention never automatically deletes records. Clear workspace requires typing DELETE ALL and then a second confirmation. Deleting a candidate cascades to its applications, activities, interviews, notes, and attachments; audit events remain until the entire workspace is cleared. Deleting a job deletes its applications and unlinks its interviews/activities. Back up before deletion.

The local workspace has no authentication or encryption. Use an OS-protected account and disk encryption where appropriate. Anyone with access to the unlocked browser profile may access the records. This release intentionally does not provide a cosmetic password lock.
