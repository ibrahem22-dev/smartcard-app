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
| 3b | Exit code on a genuine in-task failure — **ANSWERED, Session 06, and it is bad** | **Exit `1` with an EMPTY stdout and no JSON error event.** Question 3 recorded "not yet observed"; it is now observed. A detached run produced zero bytes of output and exit 1 after idling ~25 minutes. Had the wrapper reported only its own status, this would have read as success. **This is the concrete case behind "exit codes are ADVISORY ONLY" (OD-15): verify by inspecting the worktree, never by trusting the code.** |
| 9 | Practical limitations for supervision | **No filesystem sandbox on Windows at all** — the only enforcement available is an "allowlist mode" (per the sandbox-unavailable error message), not tested in depth here. `--force`/`--yolo` (needed to avoid interactive approval hangs in unattended use) removes even that. **Any unattended `cursor-agent` invocation on this machine must be treated as having full-account filesystem write access**, regardless of `--workspace`. Supervisor implication: never invoke it against a directory tree you are not prepared to have modified anywhere the OS user can write — confine risk by running from a disposable/limited OS account or accept the exposure, not by trusting `--workspace`. |

### Session 06 — `cursor-agent` needs a TTY. Detached, it hangs and then lies.

Two runs of the same packet (`TASK-BATCH1-R1.md`), same model (`claude-opus-5-high`), same
workspace, same flags. The only difference was whether the process had a controlling terminal.

| Run | Launch | Result |
|---|---|---|
| 1 | foreground | **Working.** Edited `types.ts` and `cost-model.ts` within 10 min; killed by the supervisor's own timeout, not by the tool. |
| 2 | detached / background | **Hung.** ~25 min, CPU moved 0.02 total, **zero bytes written, zero files edited**, then exit 1. |

The tell was CPU, not elapsed time: two samples ten minutes apart showed `0.72 → 0.72` and
`1.95 → 1.97`. A thinking agent burns CPU; a blocked one does not. **Sample CPU twice before
concluding an executor is still working** — an empty log looks the same either way, because
`--output-format json` buffers until completion and shows nothing in the meantime.

**Operating rules that follow:**

1. **Run `cursor-agent` in the foreground.** Detached, it blocks on something that never arrives.
2. **The 10-minute foreground ceiling is real** and smaller than a substantive task needs. A packet
   that cannot finish inside it must be **split into stages that each can**, not backgrounded.
3. **Never infer progress from an empty log.** Inspect `git status` in the worktree and sample CPU.
4. When the tool cannot deliver inside the window, **the supervisor implements it** rather than
   spending the session on round-trips. Session 06 lost ~27 minutes to two failed runs before doing
   this; the implementation itself took less.

This does not change Cursor's operating tier. It bounds the *shape* of a deliverable task: several
short foreground packets, never one long detached one.

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

---

# E2 — ANTIGRAVITY CAPABILITY PROBE (Session 06)

**Date:** 2026-08-20 · **Method:** live probe in a throwaway scratch directory. Nothing installed,
no configuration changed, no production task run. The app repo and the estate were never targeted.

**Found at:** `C:\Users\ebrah\AppData\Local\Programs\Antigravity IDE\` — **Antigravity IDE 1.107.0**,
an Electron/VS Code-family IDE. CLI entry point `bin/antigravity-ide.cmd`. Not on PATH.

## The nine E0 questions

| # | Question | Answer |
|---|---|---|
| 1 | Non-interactive CLI that runs a prompt **to completion**? | **NO.** `antigravity-ide chat --mode agent <prompt>` exists, but it **dispatches to a GUI chat session and returns immediately**. Measured: exit 0 in **1 second**, no work performed. |
| 2 | Pointable at a working directory? | **YES** — the chat session opens in the current working directory; `--new-window` / `--reuse-window` control the target window. |
| 3 | Meaningful exit code? | **NO — and worse than Codex's.** Exit 0 means *"the window was told"*, not *"the task succeeded"*. It returns 0 in 1s having done nothing. An exit code here is not merely unreliable; it is measuring a different event. |
| 4 | Output capturable to a log? | **NO, not usefully.** stdout carried only a dispatch line (`Reading from stdin via: …\code-stdin-fNk`). No agent reasoning, no tool calls, no result. The work happens in the GUI. |
| 5 | Constrainable to a directory? | **NO — assume none**, exactly as for Cursor and Codex. OD-15's environment controls apply unchanged: worktree-only, OS read-only ACLs on the estate and archive, hard L0 scope check. |
| 6 | Concurrent instances on different directories? | **NOT_DETERMINED.** `--new-window` and `--user-data-dir` suggest it is possible, but concurrency was not tested because (1) fails, which makes concurrency moot for programmatic use. |
| 7 | Repo-level instructions file? | **NOT_DETERMINED.** VS Code-family convention suggests `.github/copilot-instructions.md` or an `AGENTS.md` equivalent; not probed. Treat as *assume yes* for contamination purposes — §12's authority-phrase quarantine applies before any use. |
| 8 | Models / options? | `--mode ask \| edit \| agent \| <custom>`, `--add-file` for context, `--profile`. No model list is exposed via the CLI. |
| 9 | Practical limitations | It is an **IDE, not an agent runner.** The `chat` subcommand is the stock VS Code 1.107 surface. Everything a supervisor needs from a programmatic executor — completion signalling, captured output, a trustworthy exit code — is absent. |

## The five runtime/visual questions this probe was actually for

| # | Question | Answer |
|---|---|---|
| 10 | Drive a local Expo web build and interact with a running app? | **NOT_DETERMINED.** Not reachable through the CLI; would require a human driving the GUI. The capability may exist in-product, but not on any path a supervisor session can invoke or verify. |
| 11 | Capture screenshots to a readable path? | **NOT_DETERMINED**, same reason. No CLI surface produced any artifact. |
| 12 | Machine-readable artifact manifest? | **NO.** Nothing was written to stdout or to disk by the probe beyond the dispatch line. |
| 13 | Constrainable to a worktree? | **NO** — assume not, per OD-15. |
| 14 | Context limits / packet-as-file? | **NOT_DETERMINED** for limits. The `chat` subcommand documents a stdin form (`… chat <prompt> -`), which sidesteps the ~8 KB Windows command-line ceiling that Session 05 hit with Cursor — so a large packet is deliverable in principle. |

## Evidence

```
$ antigravity-ide chat --mode agent --new-window "Create probe.txt containing AG_PROBE_OK…"
  exit=1, 0s  — cmd %* re-expansion mangled the multi-word prompt
$ echo "Create probe.txt containing AG_PROBE_OK" | antigravity-ide chat --mode agent -
  exit=0, 1s  — "Reading from stdin via: …\code-stdin-fNk"
$ antigravity-ide chat --mode agent AG_PROBE
  exit=0, 1s  — no output
after 45s: probe.txt NOT created; 13 Antigravity processes running (a window did open)
```

A window launched and the prompt was delivered; **no file was ever produced**. The session waits on
a human.

## OPERATING TIER: **TIER 2 — GUI HANDOFF ONLY**

Antigravity cannot be invoked as a subprocess that runs to completion, cannot have its output
captured, and returns an exit code that measures dispatch rather than success. It fails E0
criteria (1), (3) and (4) — the three that define Tier 1.

**This is not a defect to work around.** It is an IDE whose agent is designed for a human at the
keyboard.

## Recommended role — and the honest case for it

**Do not give it projections, schemas, gates or the adapter.** It has no advantage there and three
disadvantages: no completion signal, no captured output, no exit code. Cursor and Codex are strictly
better for that work today.

**Its comparative advantage is real but currently unreachable programmatically: runtime and visual
evidence** — a kind of evidence no exit code produces, and precisely where SmartCard's hardest
unverified claims sit:

- **RTL Hebrew/Arabic mirroring**, recorded `NOT_DETERMINED` by the forensic — nothing was ever
  checked on a device or in a browser.
- **Provenance chips actually rendering** — the four-state vocabulary is a published product
  promise, and no one has seen it drawn.
- The **cold-install → first-verdict journey**.

One point in its favour worth recording: this app's RTL is JS-level via `useAppDirection`, **not**
`I18nManager.forceRTL`, so a web-target run exercises the *same* direction logic the native app
runs — more representative here than for a typical RN app.

**Recommended first real use — as a Tier-2 handoff, not a delegation:** at P2/P3, once a screen
renders, the supervisor writes a scripted visual-check packet; the Owner runs it in the Antigravity
GUI; the supervisor inspects the resulting screenshots and the worktree. That keeps the value
(visual evidence) without pretending the automation exists.

**It does not replace device QA at P6.** A browser is not a phone.

**Recommendation on OD-22: adopt, but as a Tier-2 visual-evidence tool only, with no production
implementation role.** Revisit if a headless agent CLI ships.
