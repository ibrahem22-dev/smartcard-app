# DIAGNOSTIC CHANGES LOG

Any temporary change made to the app repo or the canonical data estate in order to run a
diagnostic, and its rollback. Append-only.

## Session 01 — 2026-08-19 (P-1, P0-A, E0, T4)

**None.** No temporary change was made to `app\SmartCard` or to the canonical data estate in order
to run `tsc`/`eslint`/`jest`; they ran unmodified from the committed state (commit `5c22411`).

The E0 executor probe (T3) created and destroyed throwaway test files (`probe.txt`,
`a.txt`/`b.txt`, `c.txt`/`d.txt`, and one deliberate sandbox-escape test file) — all of them
**entirely inside this session's scratchpad**
(`AppData\Local\Temp\claude\...\scratchpad\executor_probe\`), never inside `app\SmartCard`, never
inside the data estate. Nothing there is part of this project and nothing was rolled back because
nothing project-relevant was touched. See
`_orchestration\EXECUTOR_CAPABILITIES.md` for what the probe found.
