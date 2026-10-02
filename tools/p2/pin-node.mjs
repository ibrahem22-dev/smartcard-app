#!/usr/bin/env node
/**
 * PIN-NODE (app side) — make `node` inside an npm script resolve to the pinned runtime.
 *
 * THE DEFECT THIS EXISTS FOR, and it is a fact about this machine rather than about this project:
 *
 *   A system-wide Node 24 lives at `C:\Program Files\nodejs`, on the MACHINE PATH. Windows
 *   composes PATH as machine-entries-then-user-entries, and this account is NOT an administrator,
 *   so nothing a session can add to the user PATH will ever precede it. npm 7 removed
 *   `scripts-prepend-node-path`, so every npm script inherits that raw PATH.
 *
 *   The pipeline repository was running its entire gate ladder on Node 24 while `.nvmrc` and
 *   `engines.node` both pinned 20, and nothing anywhere said so. A gate ladder green on the wrong
 *   runtime proves nothing about the pinned one.
 *
 * THE FIX. npm DOES prepend `node_modules/.bin` to the PATH of every script it runs. That is the
 * one directory a non-administrator can put something into that wins. This writes `node` shims
 * there, pointing at the fnm-managed pinned runtime.
 *
 *   node tools/p2/pin-node.mjs            # write the shims (idempotent)
 *   node tools/p2/pin-node.mjs --check    # verify only; never repairs
 *
 * Wired to `postinstall`, so it survives `npm ci` wiping node_modules. `p2:preflight` VERIFIES the
 * invariant this establishes and never repairs it: a gate that silently fixes what it measures can
 * never be observed to fail.
 *
 * This is a workaround for a machine the campaign does not control. The permanent fix is an
 * administrator removing `C:\Program Files\nodejs` from the machine PATH. Until then this holds.
 * See the pipeline's authority/TOOLCHAIN.md §4 and authority/ENVIRONMENT_FACTS.md §3.
 *
 * ------------------------------------------------------------------------------------------------
 * IT IS WINDOWS-ONLY, AND THE FIRST CI RUN PROVED WHY THAT HAS TO BE EXPLICIT.
 *
 * This script is wired to `postinstall`. Its first version searched `%APPDATA%/fnm/node-versions`
 * unconditionally, so on Linux `process.env.APPDATA` was undefined, the search found nothing, and
 * it exited 1 — **failing `npm ci` itself**. The very first GitHub Actions run of this repository
 * died at `npm ci` with every later step skipped.
 *
 * The consequence was not a broken CI job. It was that **the app could not be installed on any
 * machine that is not this one** — which is precisely what E7 ("a machine that has never built this
 * app") and F4 (CI at the pushed sha) exist to require. A toolchain pin that makes the project
 * uninstallable everywhere else defeats the criterion it was written to serve.
 *
 * So the defect is named for what it is: a fact about ONE Windows machine. Elsewhere, `node` is
 * whatever the environment installed, the CI workflow asserts that version against `.nvmrc`
 * directly, and this script says out loud that it did nothing and why.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = join(ROOT, 'node_modules', '.bin');
const CHECK = process.argv.includes('--check');

/**
 * THE NON-WINDOWS BRANCH USED TO LIVE HERE, AND IT COULD NOT FAIL.
 *
 * It printed `PIN-NODE OK — not needed on linux …` and exited 0, unconditionally, before `.nvmrc`
 * had even been read. Its own comment said *"NOT A SILENT NO-OP"* on the grounds that it names the
 * platform — but naming yourself is not the same as checking anything, and **it returned OK for a
 * runtime three major versions off the pin.** Watched doing exactly that: forced to Node 18 against
 * a `.nvmrc` of 20.20.2, it still exited 0.
 *
 * It also justified itself with *"CI asserts it against .nvmrc directly"*, which was true of a CI
 * job that had never once reached that step.
 *
 * The branch now runs AFTER `.nvmrc` is read, further down, and asserts the runtime — so the
 * invariant holds on every platform and only the mechanism differs.
 */
const nvmrcPath = join(ROOT, '.nvmrc');
if (!existsSync(nvmrcPath)) {
  console.log('PIN-NODE FAILED — no .nvmrc. The pinned runtime has to be stated somewhere a');
  console.log('  human and a script can both read, or "pinned" means whatever happened to be first.');
  process.exit(1);
}
const pinned = readFileSync(nvmrcPath, 'utf8').trim().replace(/^v/, '');

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * OFF WINDOWS THERE IS NOTHING TO SHIM — AND THIS SCRIPT USED TO FAIL THE INSTALL THERE.
 *
 * Everything below is a workaround for one Windows fact: the machine PATH carries a system-wide
 * Node that a non-administrator cannot get in front of. **That fact does not exist on Linux or
 * macOS**, where npm runs scripts with the node that invoked npm.
 *
 * This script is wired to `postinstall`, so on a non-Windows machine it looked for
 * `%APPDATA%/fnm/node-versions/**\/node.exe`, found nothing, and exited 1 — **which fails `npm ci`
 * itself.** The pipeline's identical copy did exactly that in GitHub Actions run #57, and this one
 * would have failed the next step for the same reason.
 *
 * THIS IS NOT A NO-OP. The invariant is *"npm scripts run on the pinned runtime"*, and that is
 * checkable everywhere — only the MECHANISM is Windows-specific. Off Windows the runtime is asserted
 * against `.nvmrc` directly and this **exits 1 on a major mismatch**, which is the same failure the
 * shims exist to prevent, caught the way this platform allows.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
if (process.platform !== 'win32') {
  const running = process.version.replace(/^v/, '');
  const major = (v) => v.split('.')[0];

  if (major(running) !== major(pinned)) {
    console.error(
      'PIN-NODE FAILED: this runtime is Node ' + running + ' and .nvmrc pins ' + pinned + '.\n' +
        '  A major-version mismatch is never accepted. On ' + process.platform + ' npm scripts run\n' +
        '  on the node that invoked npm, so there is nothing to shim — fix the runtime instead:\n' +
        '    CI     actions/setup-node with node-version-file: .nvmrc\n' +
        '    local  fnm use ' + pinned + '   (or nvm use ' + pinned + ')',
    );
    process.exit(1);
  }

  console.log(
    'PIN-NODE OK — ' + process.platform + ': npm scripts run on the invoking runtime, nothing to shim.\n' +
      '  pinned  ' + pinned + ' (.nvmrc)\n' +
      '  running ' + running + (running === pinned ? '' : '  (same major, accepted)') + '\n' +
      '  The shims below exist only for Windows, where the machine PATH carries a Node this\n' +
      '  account cannot get in front of. That problem does not exist here.',
  );
  process.exit(0);
}

/** fnm keeps every installed runtime here, plus an aliases/default symlink to the current one. */
const FNM_VERSIONS = join(process.env.APPDATA ?? '', 'fnm', 'node-versions');

const locate = () => {
  const exact = join(FNM_VERSIONS, 'v' + pinned, 'installation', 'node.exe');
  if (existsSync(exact)) return exact;
  const alias = join(process.env.APPDATA ?? '', 'fnm', 'aliases', 'default', 'node.exe');
  if (existsSync(alias)) return alias;
  return null;
};

const target = locate();
if (!target) {
  console.log('PIN-NODE FAILED — no Node ' + pinned + ' found under ' + FNM_VERSIONS);
  console.log('  Install it with: fnm install ' + pinned);
  process.exit(1);
}

/**
 * Three shims, because three different launchers read three different things:
 *   node       — POSIX shell, used by Git Bash
 *   node.cmd   — cmd.exe, which is what npm uses on Windows
 *   node.ps1   — PowerShell
 * Missing any one of them means the pin holds in some shells and silently does not in others,
 * which is worse than not pinning at all.
 */
const shims = {
  node: '#!/bin/sh\nexec "' + target.replace(/\\/g, '/') + '" "$@"\n',
  'node.cmd': '@ECHO OFF\r\n"' + target + '" %*\r\n',
  'node.ps1': '#!/usr/bin/env pwsh\n& "' + target + '" $args\nexit $LASTEXITCODE\n',
};

if (CHECK) {
  const problems = [];
  for (const [name, body] of Object.entries(shims)) {
    const p = join(BIN, name);
    if (!existsSync(p)) { problems.push('missing shim: node_modules/.bin/' + name); continue; }
    if (readFileSync(p, 'utf8') !== body) problems.push('stale shim: node_modules/.bin/' + name);
  }
  if (problems.length) {
    console.log('PIN-NODE FAILED — ' + problems.length + ' problem(s):');
    for (const p of problems) console.log('    ' + p);
    console.log('  Repair with: node tools/p2/pin-node.mjs   (or npm ci, which runs it)');
    process.exit(1);
  }
  console.log('PIN-NODE OK — npm scripts resolve node to ' + target);
  process.exit(0);
}

mkdirSync(BIN, { recursive: true });
for (const [name, body] of Object.entries(shims)) writeFileSync(join(BIN, name), body);
console.log('PIN-NODE OK — wrote ' + Object.keys(shims).length + ' shims pointing at ' + target);
