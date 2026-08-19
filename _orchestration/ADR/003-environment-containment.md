# ADR-003 — Environment-Level Executor Containment (OD-15)

**Status:** Accepted and implemented
**Date:** 2026-08-19

## Context

E0 (session 01) found that neither Cursor nor Codex has working filesystem containment on this
Windows machine: Cursor has no OS-level sandbox on Windows at all, and Codex's `workspace-write`
sandbox fails with a `CryptUnprotectData` error and falls back to unconstrained
`danger-full-access`. An executor invoked non-interactively therefore has, in practice, full
write access anywhere the `ebrah` account can write — including the canonical data estate and the
donor archive, neither of which can be regenerated if damaged.

## Decision — OD-15 status note

This session's brief states OD-15 is Owner-approved (2026-08-19). At the time this ADR was
written, `SMARTCARD_OWNER_DECISIONS.md` itself still listed OD-15 as **"OPEN — recommended."**
Per this session's direct instruction from the Owner, OD-15 was treated as approved and acted on
— the same posture session 01 took toward OD-12 before its register entry was formally closed.
This ADR does **not** edit the Owner-only, append-only `SMARTCARD_OWNER_DECISIONS.md` register;
that document lag is flagged for the Owner in the session report.

**Decision: delegate, with containment moved from the tool to the environment**, per the three
controls below.

## Control 1 — OS-level read-only ACL on the irreplaceable

Applied via `icacls`, denying the `ebrah` account (the only account executors run as on this
machine) the specific write/delete rights, recursively, on both:
- `C:\Users\ebrah\All application data\smartcard-canonical-v1\`
- `C:\Users\ebrah\All application data\_app_archive\`

**A mistake was made and corrected while implementing this, worth recording so it isn't repeated.**
The first attempt used icacls's `M` ("Modify") permission alias:

```
icacls "<path>" /deny "ebrah:(OI)(CI)M" /T /C /Q
```

`M` is a composite that includes **Read** (Modify = Read & Execute + Write + Delete). Denying it
denied reads too — verified: `icacls` itself could no longer query a nested file's ACL, and
`Get-Content`/`Add-Content` both failed with "Access is denied" where only the latter should have.
This would have broken every future read-only census/adapter task, not just writes. **Corrected**
by removing the deny and reapplying with the specific right tokens instead of the alias:

```powershell
# remove the bad deny first
icacls "<path>" /remove:d "ebrah" /T /C /Q
# reapply, write/delete rights only — WD=write data, AD=append/create, WA=write attributes,
# WEA=write extended attributes, DE=delete self, DC=delete child (within a container)
icacls "<path>" /deny "ebrah:(OI)(CI)(WD,AD,WA,WEA,DE,DC)" /T /C /Q
```

**Verified empirically, both paths, both directions:**
- Read (`Get-Content`), list (`Get-ChildItem`): succeed.
- Create (`Out-File` to a new path), append to an existing file (`Add-Content`), delete
  (`Remove-Item`): all fail with Access Denied. The file targeted by the delete test
  (`DATASET_ID`) was confirmed still present afterward.

5,422 objects (estate) and 8,632 objects (archive) processed with 0 failures on the corrected
pass.

**To reverse, if a future session needs to write into either tree again** (e.g. a deliberate,
Owner-approved re-freeze):
```
icacls "<path>" /remove:d "ebrah" /T /C /Q
```

## Control 2 — worktree-only execution

The E1 delegation (T4) runs inside a dedicated `git worktree` (`../wt-E1`, branch
`task/E1-boundary-lint`), never the main `app\SmartCard` tree, never a path whose parent contains
the canonical estate or the archive (both of which are outside `SmartCard-Agent` entirely, at
`All application data\`, so this is true by construction as long as the worktree stays under
`SmartCard-Agent`).

## Control 3 — L0 scope check as a hard gate

After the executor exits, `git status --porcelain` is checked in **every** repository that
exists on this machine at the time — the app repo, the E1 worktree, and the workspace root — not
only the task's own worktree. Documented results are in `_orchestration/validation/E1.md`.

## Control 4 — exit codes are advisory only

Independent of containment. Per E0's finding (Codex's exit code does not reliably signal task
success) and the Execution Model §16.3: the executor's exit status is never treated as a pass/fail
signal. Every acceptance command (tsc, eslint, jest, boundary-lint check) is re-run by the
supervisor directly against the actual worktree contents after the executor exits, and the diff is
read in full (L9).

## Consequences

- Any future session that needs to write into the canonical estate or the archive (a deliberate
  re-freeze, a correction) must first run the reversal command above, do the write, then reapply
  the deny — never work around the ACL by running as a different account or elevating.
- The ACL is per-machine, per-account state, not tracked by git or by `INPUT_MANIFEST.json`. If
  this project ever moves to a new machine or account, this control must be reapplied there; it is
  not portable. Noted in `STATE.json` so a future session doesn't assume it travels with the repo.
- `icacls`'s `M` alias is now known to be unsafe for "read-only" intent on this project. Any future
  ACL work here should use explicit right tokens, not aliases, and should always be verified with
  paired read-succeeds / write-fails tests before being trusted — exactly as this ADR did the
  second time.
