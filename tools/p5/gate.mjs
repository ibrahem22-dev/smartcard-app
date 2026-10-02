#!/usr/bin/env node
/**
 * P5 GATE RUNNER — `npm run p5:gate -- <name>`.
 *
 * The three rules the P2, P3 and P4 runners enforce, carried because they are how this project keeps
 * a green line honest:
 *
 *   1. THE GATE POPULATION IS DERIVED FROM tools/p5/gates/*.mjs, never from a list kept here.
 *   2. A GATE THAT IS NOT YET WRITTEN FAILS LOUDLY, NOT SILENTLY. An unknown gate name is a hard
 *      failure: a campaign that can ask for a check it has not built, and get silence, is a
 *      campaign that closes over work it did not do.
 *   3. A GATE MAY DECLARE ITSELF notImplemented — recorded, printed, counted separately, never ok.
 *
 * P4 added a fourth: a gate declares `MEASURES`, recorded in the report, so a criterion about a
 * screen can be audited for whether the thing that checked it ever rendered anything. P5 keeps that
 * and widens the vocabulary by one — `'agreement'` — because contract §2 rule 10 makes "these two
 * surfaces agree" a distinct kind of claim from "this surface renders correctly", and the two are
 * indistinguishable in a report that cannot tell them apart.
 *
 * Trailing flags such as `--app` are ignored: the campaign ledger passes them so it knows which
 * repository to run in, and they are not gate names.
 *
 * Usage:
 *   npm run p5:gate -- <name>      run one gate
 *   npm run p5:gate -- --list      list every gate on disk, and every gate the contract requires
 *
 * Exit codes are advisory in this project. Decide on printed output.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MEASUREMENT_KINDS } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATES_DIR = join(HERE, 'gates');
const ROOT = join(HERE, '..', '..');
const REQUIRED_PATH = join(HERE, 'required-gates.json');

export const gateNames = () => {
  if (!existsSync(GATES_DIR)) return [];
  return readdirSync(GATES_DIR)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
    .map((f) => f.replace(/\.mjs$/, ''))
    .sort();
};

export const requiredGates = () => {
  if (!existsSync(REQUIRED_PATH)) return { error: 'tools/p5/required-gates.json is missing — without it this ladder can only report on the gates it happens to have, which is not what the contract asks' };
  try {
    const j = JSON.parse(readFileSync(REQUIRED_PATH, 'utf8'));
    if (!Array.isArray(j.gates) || j.gates.length === 0) return { error: 'required-gates.json declares no gates — a required set of nothing is not a requirement' };
    return { required: j };
  } catch (err) {
    return { error: 'required-gates.json is unreadable: ' + (err?.message ?? String(err)) };
  }
};

export const loadGate = async (name) => {
  const p = join(GATES_DIR, name + '.mjs');
  if (!existsSync(p)) return null;
  return import(pathToFileURL(p).href);
};

export const runGate = async (name) => {
  const mod = await loadGate(name);
  if (!mod) return { name, ok: false, unknown: true, message: 'no gate module tools/p5/gates/' + name + '.mjs' };
  if (typeof mod.run !== 'function') {
    return { name, ok: false, message: 'tools/p5/gates/' + name + '.mjs exports no run()' };
  }
  if (!mod.SENTINEL) {
    return { name, ok: false, message: 'tools/p5/gates/' + name + '.mjs declares no SENTINEL. A gate without a positive sentinel cannot be decided on printed output.' };
  }
  /**
   * MEASURES IS REQUIRED IN P5, AND IT MUST BE ONE OF THE FOUR KINDS.
   *
   * P4 made it optional. P5's validation plan §0 is built on the distinction — *"a criterion
   * measured by the wrong kind is the failure this plan exists to prevent"* — and an optional field
   * that is usually absent cannot support an audit. An undeclared or misspelled kind is a gate that
   * cannot be audited for whether it measured the right thing, so it is refused here rather than
   * recorded as null and read as "source" by whoever looks later.
   */
  if (!mod.MEASURES || !MEASUREMENT_KINDS.includes(mod.MEASURES)) {
    return {
      name, ok: false,
      message: 'tools/p5/gates/' + name + '.mjs declares MEASURES ' + JSON.stringify(mod.MEASURES ?? null)
        + '; it must be one of ' + MEASUREMENT_KINDS.join(', ') + ' (P5_VALIDATION_PLAN.md §0)',
    };
  }
  let r;
  try {
    r = await mod.run({ root: ROOT });
  } catch (err) {
    return { name, ok: false, message: 'threw: ' + (err && err.message ? err.message : String(err)), stack: err && err.stack };
  }
  /**
   * A gate that returns ok must have said WHAT it printed. A truthy object with no sentinel is the
   * shape a half-written gate has, and it would otherwise read as a pass.
   */
  if (r && r.ok && !r.sentinel && !r.sentinelOverride && !mod.SENTINEL) {
    return { name, ok: false, message: 'gate returned ok with no sentinel to print' };
  }
  return { name, sentinel: mod.SENTINEL, criteria: mod.CRITERIA ?? [], measures: mod.MEASURES, ...r };
};

// ------------------------------------------------------------------------------- CLI
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a !== '--' && a !== '--app');
  const names = gateNames();

  if (args.includes('--list') || args.length === 0) {
    const { required, error } = requiredGates();
    const requiredNames = required ? required.gates.map((g) => g.gate).sort() : [];
    const missing = requiredNames.filter((n) => !names.includes(n));
    const extra = names.filter((n) => !requiredNames.includes(n));

    console.log('');
    console.log('  P5 GATES — ' + names.length + ' on disk, derived from tools/p5/gates/*.mjs');
    for (const n of names) {
      const mod = await loadGate(n);
      const crit = (mod?.CRITERIA ?? []).join(',');
      console.log('    ' + n.padEnd(28) + String(crit).padEnd(12) + String(mod?.MEASURES ?? '(no MEASURES)').padEnd(11) + (mod?.SENTINEL ?? '(no sentinel declared)'));
    }
    console.log('');
    if (error) {
      console.log('  ' + error);
    } else {
      console.log('  REQUIRED BY THE CONTRACT — ' + requiredNames.length + ', mirrored from '
        + required.generatedBy + ' at v' + required.contractVersion);
      console.log('    present ' + (requiredNames.length - missing.length) + '  ·  MISSING ' + missing.length
        + (extra.length ? '  ·  on disk but not required ' + extra.length : ''));
      if (missing.length) {
        console.log('');
        console.log('    still to be written, with the criteria that need them:');
        for (const n of missing) {
          const g = required.gates.find((x) => x.gate === n);
          console.log('      ' + n.padEnd(28) + (g?.criteria ?? []).join(',').padEnd(10) + (g?.sentinel ?? ''));
        }
      }
    }
    console.log('');
    console.log('P5-GATE OK — ' + names.length + ' gate(s) listed');
    process.exit(0);
  }

  const name = args[0];
  if (!names.includes(name)) {
    const { required } = requiredGates();
    const g = required?.gates.find((x) => x.gate === name);
    console.log('');
    console.log('P5-GATE FAILED — unknown gate "' + name + '".');
    console.log('  There is no tools/p5/gates/' + name + '.mjs. This is a hard failure on purpose:');
    console.log('  a campaign that can ask for a check it has not built, and get silence, is a');
    console.log('  campaign that closes over work it did not do.');
    if (g) {
      console.log('  The contract DOES require it: criteria ' + g.criteria.join(',') + ', sentinel "' + g.sentinel + '".');
      console.log('  It has not been written yet. That is a work package, not a gate failure.');
    }
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
    console.log('P5-GATE NOT IMPLEMENTED — ' + name + (r.message ? ': ' + r.message : ''));
    console.log('  This is not a pass and not a skip. The gate exists so the contract can name it,');
    console.log('  and it refuses to print its sentinel until the work behind it is done.');
    process.exit(1);
  }
  console.log('P5-GATE FAILED — ' + name + ': ' + (r.message ?? 'no reason given'));
  if (r.stack) console.log(String(r.stack).split('\n').slice(0, 4).map((l) => '    ' + l).join('\n'));
  process.exit(1);
}
