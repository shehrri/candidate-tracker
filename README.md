# Candidate Tracker — Offline Edition

Developed by Sheheryar Ahmad

A local recruitment workspace with candidates, requisitions, independent applications, interviews, follow-ups, search, reports, and full backups. No account, subscription, cloud database, or installation is required for normal use.

## Launch the portable application

Use the **CandidateTracker** distribution folder, not the source directory.

1. Extract the entire folder to a location you can write to, such as Documents. Do not launch from inside a ZIP archive.
2. **Windows 10/11, x64 or ARM64:** double-click `launch-windows.cmd`.
3. **macOS, Apple Silicon or Intel:** double-click `launch-macos.command`.
4. Keep the terminal window open while using the application. A browser opens at **http://127.0.0.1:47831**. If it does not open, enter that exact address yourself.
5. Use the same browser and browser profile every time. Bookmark the address. To stop, close the server terminal or press Ctrl+C.

The folder includes official Node.js runtime binaries for all four architectures. They run directly without installing Node or requiring administrator privileges. Windows uses an included `node.exe` as a portable runtime; there is no installer. The macOS launcher selects the appropriate bundled runtime automatically.

On macOS, downloaded unsigned launcher scripts may be blocked by Gatekeeper or lose their executable permission during transfer. Use Finder's Open action and the operating system's normal security review if offered. If execution permission is missing, run `chmod +x launch-macos.command` from the extracted folder. Do not disable Gatekeeper globally. Organizational policies can prevent scripts or portable runtimes from running; the application cannot override those policies. macOS may therefore require a first-launch approval rather than a literal one-click first launch.

If the browser opens another profile, select the profile that holds your data. If port 47831 is occupied by another program, the launcher stops with an error. It never silently chooses another port. Launching it twice reuses a verified existing Candidate Tracker server.

## Where data lives

Records and attachments live in IndexedDB in the selected browser profile, under the fixed application origin. **They do not live inside the portable folder.** Moving the folder alone does not move your candidate records. Use **Backup Data**, then restore the JSON backup on the new browser or device.

Clearing browsing/site data, deleting a browser profile, or private browsing can remove records. The app does not encrypt browser storage or backups. Keep backups in an appropriately protected location. No candidate data is uploaded. External links and mailto actions run only when clicked.

## Included files

- `app/`: production HTML, JavaScript, styles, and locally bundled dependencies
- `runtime/`: checksum-verified official Windows and macOS runtimes, with licenses
- `server.cjs`: read-only HTTP server bound to the local loopback interface
- `launch-windows.cmd`, `launch-macos.command`: launchers
- `USER-GUIDE.md`, `BACKUP-GUIDE.md`: operating and recovery instructions
- `templates/candidates-import.csv`: header-only import template (no fabricated candidate data)
- `BUILD-INFO.json`, `RUNTIME-CHECKSUMS.txt`: runtime and release provenance

See `DEVELOPER-GUIDE.md` in the source workspace for build and test instructions, and `TEST-REPORT.md` for tested environments and remaining release validation.

## License

Candidate Tracker's project source is available under the [MIT License](LICENSE).
Copyright (c) 2026 Sheheryar Ahmad. Bundled third-party libraries and runtimes
retain their own licenses; see `THIRD-PARTY-NOTICES.txt` and `runtime/` in the distribution.

## Support development

Candidate Tracker is free to use. Financial support is optional and is never
required to use any feature.

[Support Sheheryar Ahmad on GitHub Sponsors](https://github.com/sponsors/shehrri)

You can also support the project by reporting bugs, improving the documentation,
and contributing fixes.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development contributions and
[SECURITY.md](SECURITY.md) for reporting security concerns.
