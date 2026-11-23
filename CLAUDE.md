<!-- archimedes:begin -->
## Project context (kept by Archimedes)

Duck Buster — A fun hunting app to track duck hunting progress - gamify the Duck hunting season

- Master Directive: @_arc/Master_directive_duck_buster.md
- Tech stack: @_arc/stack.md
- What the user keeps about this project in Archimedes — status, rank, priority, tags, groups, dates, reminders and checklists: @_arc/project.md
- The user's notes on this project: @_arc/notes.md
- This project's URLs (live site, staging, backend, dashboards…): @_arc/links.md — keep it current: when you create, deploy, find or change one of this project's URLs, add or update its line there, and remove ones that are gone. The user sees and edits the same list in Archimedes.
- These files are kept current while you work; re-read them when the user refers to their checklists, reminders, notes or the project's status.
- Secrets: never ask the user to paste a password, token or key. Use the vault tools: `vault_list` shows what exists; `vault_run` runs a command with chosen secrets in its environment (the user approves each run, and values are blanked out of the output).

<!-- archimedes:end -->

## Crash reporting

- Self-hosted portal `https://crash.apsinthion.llc`, project **duckbuster-android (id 15)**. Never point the SDK at sentry.io or use Sentry's wizard, Gradle plugin or upload tooling.
- SDK: `@sentry/react-native` 8.28.1, set up in `mobile/src/crash/crash.ts` (crashes only, no PII, no replay/profiling). No Expo config plugin. Metro: plain `getSentryExpoConfig` (don't stub `@sentry/feedback` — it crashes the app at start).
- Release builds: `mobile/scripts/release-android.sh` through the vault (secret `CRASH_UPLOAD_DUCKBUSTER_ANDROID`). It bakes the R8 mapping id and uploads mapping, Hermes source map and native symbols with `crash-upload`. The 128 MB mapping upload sometimes fails with HTTP 499; rerun the upload.
- Test build: `EXPO_PUBLIC_CRASH_TEST=1` adds crash buttons on More and reports as `staging`. Never set it for store builds.
- Guide: `C:\Dev\DevTools\framework_crash_reporter\integrate.md`.
