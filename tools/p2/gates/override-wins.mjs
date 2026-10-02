/**
 * GATE: override-wins — criterion B4.  →  `OVERRIDE-WINS OK — user value survived pack update`
 *
 *   > **B4.** *"**The override layer is merged at read and always wins.** A regression test writes
 *   > an override, imports a newer `catalog.pack` carrying a different value, and asserts the user's
 *   > value survives and reads back as `USER`."*
 *
 *   > `P1_DEFERRED.md` §2.2, which the campaign plan calls **the single most damaging deferral in
 *   > the register**: *"a pack update silently clobbers a user's own corrections … nothing in P1 can
 *   > enforce that for P2."*
 *
 *   > And the plan's instruction: *"It is not optional and **it is not a unit test of the merge
 *   > function** — it imports a real newer pack."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS GATE RUNS THE REGRESSION TEST AND READS ITS OUTPUT
 *
 * Not "does a file named like a regression test exist" — a gate that checked for a filename would
 * pass over a suite somebody had skipped. It executes the suite and requires the named case to have
 * run and passed, then checks the SHAPE of the implementation for the two things that would make it
 * pass for the wrong reason:
 *
 *   1. **Merged at READ.** The alternative is merge-at-write — apply the override into the pack
 *      table when it is set. Simpler, faster, and exactly how a correction gets destroyed: the next
 *      import replaces that table and takes the merged value with it. Silently. Merging at read
 *      makes the failure impossible rather than unlikely, because THE OVERRIDE IS NEVER IN THE PACK
 *      STORE for an update to overwrite.
 *   2. **Precedence from the contract, not an `if`.** A resolver that wrote `if (override) return
 *      override` would be correct today and re-implemented, differently, at the second call site.
 *      Data Contract §2.2's warning about two enums applies exactly as well to two precedence rules.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE TEST'S FAKE DRIVER DOES NOT WEAKEN THE CLAIM
 *
 * `expo-sqlite` is native. The test substitutes the DRIVER — a real in-memory table with real
 * INSERT/DELETE/SELECT — and not the store, not the adapter, and not the merge. The import path
 * runs its actual transaction and its actual DELETE-then-INSERT.
 *
 * What that leaves unproven is that SQLCipher encrypted the file, which is criterion B2 on a device.
 * It has nothing to do with whether the override survives: the override was never in that database.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B4'];
export const SENTINEL = 'OVERRIDE-WINS OK — user value survived pack update';

const TEST = 'src/store/__tests__/overrideSurvivesPackUpdate.test.ts';
const ADAPTER = 'src/store/storeAdapter.ts';
const PACK_STORE = 'src/store/packStore.ts';

/** The case B4 names. Its exact title, so a rename is a visible change rather than a silent skip. */
const REQUIRED_CASE = 'SURVIVES A PACK UPDATE that carries a different value for the same key';

/** Escape the title so it can be built into a RegExp without its punctuation meaning anything. */
const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + "$&");

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  for (const rel of [TEST, ADAPTER, PACK_STORE]) {
    if (!existsSync(join(root, rel))) {
      return fail(rel + ' does not exist. B4 names a regression test, and a gate that passed without '
        + 'one would be asserting the most damaging deferral in the register had been closed');
    }
  }

  // ── 1. run it, and read the printed output ───────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest at node_modules/jest/bin/jest.js — the suite cannot be run');

  const r = spawnSync(process.execPath, [jest, TEST, '--verbose', '--ci'], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');

  // Decided on printed output, never an exit code — exit codes are advisory in this project.
  const ran = out.includes(REQUIRED_CASE);
  const passed = new RegExp('[\u221a\u2713]\\s*' + escapeForRegExp(REQUIRED_CASE)).test(out);
  // Jest writes a skip as `○ skipped <title>` — the WORD "skipped" sits between the marker and
  // the title, and the first version of this regex looked for the marker immediately before the
  // title. The gate still failed, for the right reason, with the WRONG DIAGNOSIS: it called a
  // skip a failure. A gate that misnames what went wrong sends somebody to fix the wrong thing.
  const skipped = new RegExp('skipped\\s+' + escapeForRegExp(REQUIRED_CASE)).test(out);
  const summary = (out.match(/Tests:\s+.*/) ?? ['(no summary printed)'])[0].trim();

  if (!ran) {
    problems.push('the case B4 names did not run: "' + REQUIRED_CASE + '". A gate that only checked '
      + 'the file existed would have passed over a suite somebody had skipped');
  } else if (skipped) {
    problems.push('the case B4 names was SKIPPED. A skipped regression test is the deferral back');
  } else if (!passed) {
    problems.push('the case B4 names ran and did not pass: "' + REQUIRED_CASE + '"');
  }
  if (/Tests:\s+.*failed/.test(out)) {
    problems.push('the suite reports failures — ' + summary);
  }
  lines.push('regression      ' + TEST);
  lines.push('                ' + summary);
  lines.push('named case      ' + (passed ? 'ran and passed' : ran ? (skipped ? 'SKIPPED' : 'FAILED') : 'DID NOT RUN'));

  // ── 2. merged at READ, not at write ──────────────────────────────────────────────
  const adapter = stripComments(readFileSync(join(root, ADAPTER), 'utf8'));
  const packStore = stripComments(readFileSync(join(root, PACK_STORE), 'utf8'));

  if (!/function resolveValue/.test(adapter)) {
    problems.push(ADAPTER + ' has no read-time resolver. B4 says merged AT READ');
  }
  // The override must not be written into the pack store by anything.
  if (/readOverride[\s\S]{0,200}?(putPackRow|replacePackSet)/.test(adapter)) {
    problems.push(ADAPTER + ' writes an override into the pack store. That is merge-at-write, and '
      + 'the next import replaces that table and takes the user’s value with it — silently, which '
      + 'is the failure P1_DEFERRED.md §2.2 calls the most damaging deferral in the register');
  }
  if (/from '.*keyVault'|from '.*react-native-mmkv'/.test(packStore)) {
    problems.push(PACK_STORE + ' can reach the vault. The override survives a pack update BECAUSE '
      + 'the pack store cannot reach it; a path between them makes the guarantee an intention');
  }
  lines.push('merged at       read — resolveValue(vault, packSet, key), override never written to the pack store');

  // ── 3. precedence from the contract ──────────────────────────────────────────────
  if (!/CHIP_PRECEDENCE|outranks/.test(adapter)) {
    problems.push(ADAPTER + ' does not use the contract’s precedence. A hardcoded preference for '
      + 'the vault is correct today and re-implemented, differently, at the second call site');
  }
  const assertsOrdering = /CHIP_PRECEDENCE\.USER/.test(readFileSync(join(root, TEST), 'utf8'));
  if (!assertsOrdering) {
    problems.push(TEST + ' does not assert the ORDERING. "The vault wins" passes even when the '
      + 'reason is wrong; asserting USER outranks ties the behaviour to Data Contract §2.2');
  }
  lines.push('precedence      Data Contract §2.2 ordering, asserted by the test as well as used');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
