#!/usr/bin/env node
/**
 * P2 GATE RUNNER — `npm run p2:gate -- <name>`.
 *
 * Every criterion in `P2_COMPLETION_CONTRACT.md` §3–§8 declares a command and a POSITIVE sentinel.
 * Forty-four of them are `npm run p2:gate -- <name>`. This runs one and prints exactly that
 * sentinel, or fails saying why.
 *
 * THREE RULES THIS FILE EXISTS TO ENFORCE, each of them a lesson P1 paid for:
 *
 *   1. THE GATE POPULATION IS DERIVED FROM `tools/p2/gates/*.mjs`, never from a list kept here.
 *      P1's ladder carried a hand-maintained list of eighteen harnesses; a nineteenth that
 *      compiled but was not listed would never have run while the ladder printed total success.
 *
 *   2. A GATE THAT IS NOT YET WRITTEN MUST FAIL LOUDLY, NOT SILENTLY. Asking for a gate that does
 *      not exist is a hard failure naming what is missing — never "nothing to do", and never a
 *      green line. A campaign that can ask for a check it has not built and get silence is a
 *      campaign that closes over work it did not do.
 *
 *   3. A GATE MAY DECLARE ITSELF `notImplemented`. That is NOT `ok`. It is recorded, printed, and
 *      counted separately, so the difference between "this passed" and "nobody has written this
 *      yet" survives into the report instead of being flattened by a green tally.
 *
 * Usage:
 *   npm run p2:gate -- <name>      run one gate
 *   npm run p2:gate -- --list      list every gate on disk and its state
 *   npm run p2:gate -- --names     one name per line, for the pipeline's coverage check
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATES_DIR = join(HERE, 'gates');
const ROOT = join(HERE, '..', '..');

export const gateNames = () => {
  if (!existsSync(GATES_DIR)) return [];
  return readdirSync(GATES_DIR)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
    .map((f) => f.replace(/\.mjs$/, ''))
    .sort();
};

export const loadGate = async (name) => {
  const p = join(GATES_DIR, name + '.mjs');
  if (!existsSync(p)) return null;
  return import(pathToFileURL(p).href);
};

export const runGate = async (name) => {
  const mod = await loadGate(name);
  if (!mod) return { name, ok: false, unknown: true, message: 'no gate module tools/p2/gates/' + name + '.mjs' };
  if (typeof mod.run !== 'function') {
    return { name, ok: false, message: 'tools/p2/gates/' + name + '.mjs exports no run()' };
  }
  if (!mod.SENTINEL) {
    return { name, ok: false, message: 'tools/p2/gates/' + name + '.mjs declares no SENTINEL. A gate without a positive sentinel cannot be decided on printed output.' };
  }
  let r;
  try {
    r = await mod.run({ root: ROOT });
  } catch (err) {
    return { name, ok: false, message: 'threw: ' + (err && err.message ? err.message : String(err)), stack: err && err.stack };
  }
  return { name, sentinel: mod.SENTINEL, criteria: mod.CRITERIA ?? [], ...r };
};

/** The line a passing gate prints. A gate may refine it (counts, names) via `sentinel`. */
export const sentinelLine = (r) => r.sentinel ?? '(no sentinel)';

// ------------------------------------------------------------------------------- CLI
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const names = gateNames();

  if (args.includes('--names')) {
    for (const n of names) console.log(n);
    process.exit(0);
  }

  if (args.includes('--list') || args.length === 0) {
    if (args.length === 0) {
      console.log('');
      console.log('P2-GATE FAILED — no gate named.');
      console.log('  Usage: npm run p2:gate -- <name>');
      console.log('  ' + names.length + ' gate(s) on disk. --list shows them.');
      console.log('');
      process.exit(1);
    }
    console.log('');
    console.log('  P2 GATES — ' + names.length + ', derived from tools/p2/gates/*.mjs');
    for (const n of names) {
      const mod = await loadGate(n);
      const crit = (mod?.CRITERIA ?? []).join(',');
      console.log('    ' + n.padEnd(26) + String(crit).padEnd(12) + (mod?.SENTINEL ?? '(no sentinel declared)'));
    }
    console.log('');
    console.log('P2-GATE OK — ' + names.length + ' gate(s) listed');
    process.exit(0);
  }

  const name = args[0];
  if (!names.includes(name)) {
    console.log('');
    console.log('P2-GATE FAILED — unknown gate "' + name + '".');
    console.log('  There is no tools/p2/gates/' + name + '.mjs. This is a hard failure on purpose:');
    console.log('  a campaign that can ask for a check it has not built, and get silence, is a');
    console.log('  campaign that closes over work it did not do.');
    console.log('  ' + names.length + ' gate(s) exist: ' + (names.join(', ') || '(none)'));
    console.log('');
    process.exit(1);
  }

  const r = await runGate(name);
  console.log('');
  if (r.detail) for (const line of String(r.detail).split('\n')) console.log('  ' + line);
  console.log('');
  if (r.ok) {
    console.log(r.sentinelOverride ?? r.sentinel);
    process.exit(0);
  }
  if (r.notImplemented) {
    console.log('P2-GATE NOT IMPLEMENTED — ' + name + (r.message ? ': ' + r.message : ''));
    console.log('  This is not a pass and not a skip. The gate exists so the contract can name it,');
    console.log('  and it refuses to print its sentinel until the work behind it is done.');
    process.exit(1);
  }
  console.log('P2-GATE FAILED — ' + name + ': ' + (r.message ?? 'no reason given'));
  if (r.stack) console.log(String(r.stack).split('\n').slice(0, 4).map((l) => '    ' + l).join('\n'));
  process.exit(1);
}
