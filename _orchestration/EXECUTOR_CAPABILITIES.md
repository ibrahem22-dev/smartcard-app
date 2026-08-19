# EXECUTOR CAPABILITIES — E0 PROBE RESULTS

**Date:** 2026-08-19 · **Machine:** this Windows 11 workstation only — not portable to other machines
without re-probing. **Method:** live, empirical invocation against throwaway directories under
the session scratchpad. Nothing in the app repo or the data estate was touched by this probe.

---

## CURSOR (`cursor-agent`)

Binary: `C:\Users\ebrah\AppData\Local\cursor-agent\cursor-agent.cmd` (also `cursor-agent.ps1`).
**Not on default PATH** — the containing directory is absent from `$PATH` even though
`AppData\Local\cursor-agent` exists; PowerShell's `Get-Command` still resolves it via its command
cache, but a plain subprocess spawn needs the full path or PATH to be extended first.
Version: `2026.08.04-aaa8809`.

| # | Question | Answer |
|---|---|---|
| 1 | Non-interactive CLI, exact invocation | **YES.** `cursor-agent --print --output-format json --workspace <DIR> --force "<prompt>"`. Verified live: created a file with exact requested content, ran to completion unattended in ~14–18s. |
| 2 | Pointed at a specific working directory | **YES.** `--workspace <path-or-name>`. Verified: two concurrent runs against different directories each wrote only into their own directory. |
| 3 | Meaningful exit code | **YES.** `0` on success (verified). `1` on a structural error — verified via a sandbox-unavailable error (see §5). Not yet observed: exit code on a genuine in-task failure (the one failure case triggered was an environment/config error, not a failed edit). |
| 4 | Output capturable to a log file | **YES.** `--output-format json` prints one JSON result object per line to stdout; ordinary `> file 2>&1` redirection captured it cleanly in every run. |
| 5 | Constrained to not touch files outside its working directory | **NO — empirically disproven on this machine.** `--sandbox enabled` errors immediately: `"Sandbox mode is enabled but not available on this system. Sandbox requires macOS or Linux."` Windows has no OS-level sandbox for this tool. In the default/`--force` mode required for unattended runs, a direct test — "create a file at this absolute path outside your workspace" — **succeeded**: the file was written outside `--workspace` without any block or prompt. `--workspace` is a working-directory default, not a security boundary, on Windows, today. |
| 6 | Multiple concurrent instances on different directories | **YES.** Verified: two `cursor-agent --print --force` processes launched together against `concurrent_a/` and `concurrent_b/` both completed (exit 0/0) with correct, non-cross-contaminated output. |
| 7 | Respects a repo-level instructions file | **`.cursor/rules/*.mdc`** — confirmed present and in active use in this real project (`SmartCard-Agent\.cursor\rules\{cursor-mobile-debug-rules,non-codex-fallback,smartcard-governance}.mdc`). Whether `cursor-agent --print` actually ingests these automatically was not independently verified in this probe (no dedicated test run against a directory containing rules); treat as well-established convention, not confirmed behavior. |
| 8 | Models/options available today | **Very large catalog** — `--list-models` returned ~190 entries spanning Claude (Sonnet/Opus/Fable 4.5–5, various effort tiers), GPT-5.1–5.6 family, Gemini 3.x, Grok 4.5/4.6, Kimi K2.7/K3, GLM 5.2, Composer 2.5, and more. Default is `auto`. Select with `--model <id>`. |
| 9 | Practical limitations for supervision | **No filesystem sandbox on Windows at all** — the only enforcement available is an "allowlist mode" (per the sandbox-unavailable error message), not tested in depth here. `--force`/`--yolo` (needed to avoid interactive approval hangs in unattended use) removes even that. **Any unattended `cursor-agent` invocation on this machine must be treated as having full-account filesystem write access**, regardless of `--workspace`. Supervisor implication: never invoke it against a directory tree you are not prepared to have modified anywhere the OS user can write — confine risk by running from a disposable/limited OS account or accept the exposure, not by trusting `--workspace`. |

---

## CODEX (`codex.exe`, OpenAI)

Binary: `C:\Users\ebrah\AppData\Local\OpenAI\Codex\bin\39633208fb6e0c47\codex.exe` — **not on PATH**,
not in a stable-looking directory (hash-named subfolder under an app-managed `bin\`, alongside a
sibling hash directory that is presumably a prior version; this path may change on update and
should be re-resolved rather than hardcoded long-term). This is the CLI belonging to a full desktop
app (`OpenAI.Codex` MSIX package) that is actively running/updating on this machine (log/session
files touched within the hour). Version: `codex-cli 0.148.0-alpha.15` — **alpha**. Already
authenticated (`~/.codex/auth.json` present); no login was performed by this probe.

| # | Question | Answer |
|---|---|---|
| 1 | Non-interactive CLI, exact invocation | **YES.** `codex exec -C <DIR> -s <sandbox-mode> --skip-git-repo-check --json -o <last-message-file> "<prompt>"`. Verified live, ran to completion unattended in ~5–20s depending on sandbox mode. |
| 2 | Pointed at a specific working directory | **YES.** `-C, --cd <DIR>` sets the agent's working root; `--add-dir <DIR>` adds further writable roots. Verified. |
| 3 | Meaningful exit code | **PARTIAL — important caveat.** `0` on successful completion (verified) **and also `0` when the agent's underlying task itself failed** (verified: a write that failed inside the sandbox still exited 0, with the failure only visible in the JSON event stream / last-message text, not the process exit code). Genuine CLI usage errors (bad flag) do exit non-zero (`2`, verified). **Exit code alone cannot be used to infer task success — the output/worktree must be inspected.** |
| 4 | Output capturable to a log file | **YES.** `--json` streams JSONL events to stdout (captured cleanly via redirection); `-o/--output-last-message <FILE>` writes just the agent's final message to a separate file — useful for a supervisor that wants a one-line verdict without parsing the full event stream. |
| 5 | Constrained to not touch files outside its working directory | **Present in design, broken in practice on this machine.** Three sandbox modes exist: `read-only`, `workspace-write`, `danger-full-access`. **`workspace-write` failed outright** on this Windows install: `apply_patch` failed on a hunk-header edge case, and the shell-command fallback then failed with `windows sandbox: CryptUnprotectData failed: 2148073483` (a Windows DPAPI failure inside Codex's Windows sandbox implementation) — the requested file was never created, though the process still exited `0`. Switching to `-s danger-full-access` (i.e., **no** filesystem sandboxing) made the same prompt succeed immediately. **On this machine today, `codex exec` only reliably works with sandboxing disabled.** |
| 6 | Multiple concurrent instances on different directories | **YES.** Verified: two `codex exec -s danger-full-access` processes launched together against `concurrent_c/` and `concurrent_d/` both completed (exit 0/0) with correct, non-cross-contaminated output. |
| 7 | Respects a repo-level instructions file | **`AGENTS.md`** is the well-known Codex convention and is present at this project's workspace root (`SmartCard-Agent\AGENTS.md`, 1437 bytes — itself marked HISTORICAL/not-authoritative by the current baseline, but its presence confirms the mechanism). Not independently verified in this probe that `codex exec` actually loads it (no dedicated test); the CLI does expose a **separate** `--ignore-rules` flag for "user or project execpolicy `.rules` files," which is a distinct approval-policy mechanism, not to be confused with `AGENTS.md` context loading. |
| 8 | Models/options available today | No dedicated `--list-models`; default read from `~/.codex/config.toml`: **`model = "gpt-5.6-terra"`, `model_reasoning_effort = "high"`**. Overridable per-run with `-m/--model` or `-c model=...`. `--oss` / `--local-provider` exist for local model use (lmstudio/ollama), not tested. |
| 9 | Practical limitations for supervision | **The safe sandbox mode is currently non-functional on this machine** (Windows DPAPI/CryptUnprotectData bug in this alpha build), so any real work today runs with `danger-full-access` — full-account filesystem access, same exposure as Cursor. **Exit code 0 does not mean success** — always check `-o` last-message content and/or the actual worktree. This is an **alpha build** (`0.148.0-alpha.15`) of a tool tied to an actively-updating desktop app; behavior may change on the next auto-update without notice. |

---

## OPERATING TIER

**TIER 1 — PROGRAMMATIC.** Both tools satisfy the gating criteria: (1) non-interactive CLI with a
verified exact invocation, (4) output capturable to a log file, (6) verified concurrent instances
on different directories. Both can be invoked as subprocesses by a supervisor session.

**This is a qualified TIER 1, not an unqualified one.** The gate as defined by this task doesn't
include filesystem containment (5) or exit-code reliability (3), and both tools are weak on both of
those on this machine today:

- Neither tool has a working filesystem sandbox on Windows right now (Cursor: none exists for the
  OS at all; Codex: exists but is broken in this alpha build). Any unattended invocation has
  full-account write access regardless of the working-directory flag.
- Codex's exit code does not reliably signal task success; Cursor's has only been observed to
  signal structural/environment failure, not yet a genuine in-task failure.

**Practical consequence for this project, unchanged from the brief's own philosophy:** invoking
either tool programmatically saves the copy-paste step of Tier 2, but does **not** reduce how much
independent verification the supervisor must do afterward. Treat every subprocess invocation as
"ran to completion" at best, never as "did what was asked" — inspect the actual worktree diff, not
the tool's own success claim, exactly as the brief already mandates for GUI handoffs. Given the
sandbox weaknesses above, a first real (non-probe) delegation should target a directory that is
disposable or already under git version control with a clean tree, so any unintended out-of-scope
write is trivially visible via `git status` / `git diff` afterward.

## Nothing installed, no config changed

No `login`, no `sandbox disable`/`enable` persisted, no `config.toml` edits, no plugin/MCP
installs. The one probe that hit a hard error (`--sandbox enabled` on Cursor) was a read of an
existing constraint, not a configuration change. All test artifacts were created under this
session's scratchpad only; the app repo and the data estate were never targeted.
