#!/usr/bin/env node
/**
 * P3 GATE RUNNER — `npm run p3:gate -- <name>`.
 *
 * The same three rules the P2 runner enforces, carried because they are how this project keeps a
 * green line honest:
 *
 *   1. THE GATE POPULATION IS DERIVED FROM tools/p3/gates/*.mjs, never from a list kept here.
 *   2. A GATE THAT IS NOT YET WRITTEN FAILS LOUDLY, NOT SILENTLY.
 *   3. A GATE MAY DECLARE ITSELF notImplemented — recorded, printed, counted separately, never ok.
 *
 * Usage:
 *   npm run p3:gate -- <name>      run one gate
 *   npm run p3:gate -- --list      list every gate on disk and its state
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
  if (!mod) return { name, ok: false, unknown: true, message: 'no gate module tools/p3/gates/' + name + '.mjs' };
  if (typeof mod.run !== 'function') {
    return { name, ok: false, message: 'tools/p3/gates/' + name + '.mjs exports no run()' };
  }
  if (!mod.SENTINEL) {
    return { name, ok: false, message: 'tools/p3/gates/' + name + '.mjs declares no SENTINEL. A gate without a positive sentinel cannot be decided on printed output.' };
  }
  let r;
  try {
    r = await mod.run({ root: ROOT });
  } catch (err) {
    return { name, ok: false, message: 'threw: ' + (err && err.message ? err.message : String(err)), stack: err && err.stack };
  }
  return { name, sentinel: mod.SENTINEL, criteria: mod.CRITERIA ?? [], ...r };
};

// ------------------------------------------------------------------------------- CLI
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const names = gateNames();

  if (args.includes('--list') || args.length === 0) {
    console.log('');
    console.log('  P3 GATES — ' + names.length + ', derived from tools/p3/gates/*.mjs');
    for (const n of names) {
      const mod = await loadGate(n);
      const crit = (mod?.CRITERIA ?? []).join(',');
      console.log('    ' + n.padEnd(26) + String(crit).padEnd(12) + (mod?.SENTINEL ?? '(no sentinel declared)'));
    }
    console.log('');
    console.log('P3-GATE OK — ' + names.length + ' gate(s) listed');
    process.exit(0);
  }

  const name = args[0];
  if (!names.includes(name)) {
    console.log('');
    console.log('P3-GATE FAILED — unknown gate "' + name + '".');
    console.log('  There is no tools/p3/gates/' + name + '.mjs. This is a hard failure on purpose:');
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
    console.log('P3-GATE NOT IMPLEMENTED — ' + name + (r.message ? ': ' + r.message : ''));
    console.log('  This is not a pass and not a skip. The gate exists so the contract can name it,');
    console.log('  and it refuses to print its sentinel until the work behind it is done.');
    process.exit(1);
  }
  console.log('P3-GATE FAILED — ' + name + ': ' + (r.message ?? 'no reason given'));
  if (r.stack) console.log(String(r.stack).split('\n').slice(0, 4).map((l) => '    ' + l).join('\n'));
  process.exit(1);
}
