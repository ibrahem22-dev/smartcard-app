#!/usr/bin/env node
/**
 * MDC GATE RUNNER — `npm run mdc:gate -- <name>`.
 *
 * The rules P2, P3, P4 and P5 each enforced, carried forward because they are how this project
 * keeps a green line honest:
 *
 *   1. THE GATE POPULATION IS DERIVED from tools/mdc/gates/*.mjs, never from a list kept here.
 *   2. A GATE THAT IS NOT YET WRITTEN FAILS LOUDLY. An unknown name is a hard failure: a campaign
 *      that can ask for a check it never built, and get silence, closes over work it did not do.
 *   3. A GATE MAY DECLARE ITSELF notImplemented — recorded, printed, counted separately, never ok.
 *   4. A GATE MUST DECLARE `MEASURES`, one of the five kinds, so the report can be audited for
 *      whether the right KIND of evidence was taken. P5's R3 declared a contrast check and
 *      measured zero pairings; nothing in its report could say so.
 *   5. A GATE MUST DECLARE A POSITIVE SENTINEL, and it is printed only on a real pass.
 *
 * MDC adds a sixth, from D-004: THE SENTINEL MAY NOT APPEAR IN THE GATE'S OWN FAILURE OUTPUT.
 * Two entries in the campaign's standing manifest declared sentinels that were substrings of the
 * text their tools print when they FAIL, and both reported green while failing. A gate here
 * declares FAILURE_SENTINEL and this runner refuses the pair if one contains the other, so the
 * class cannot be reintroduced one gate at a time.
 *
 * Trailing flags such as `--app` are ignored: the campaign ledger passes them so it knows which
 * repository to run in, and they are not gate names.
 *
 * Usage:
 *   npm run mdc:gate -- <name>     run one gate
 *   npm run mdc:gate -- --list     every gate on disk, and every gate the contract requires
 *
 * Exit codes are advisory in this project. Decide on printed output.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMeasurementKind, MEASUREMENT_KINDS } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATES_DIR = join(HERE, 'gates');
const REQUIRED_PATH = join(HERE, 'required-gates.json');

export const gateNames = () => {
  if (!existsSync(GATES_DIR)) return [];
  return readdirSync(GATES_DIR)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
    .map((f) => f.replace(/\.mjs$/, ''))
    .sort();
};

export const requiredGates = () => {
  if (!existsSync(REQUIRED_PATH)) {
    return { error: 'tools/mdc/required-gates.json is missing — without it this ladder can only report on the gates it happens to have, which is not what the contract asks. Regenerate with campaign-master/bin/mdc-required-gates.mjs' };
  }
  try {
    const j = JSON.parse(readFileSync(REQUIRED_PATH, 'utf8'));
    if (!Array.isArray(j.gates) || j.gates.length === 0) {
      return { error: 'required-gates.json declares no gates — a required set of nothing is not a requirement' };
    }
    return { required: j };
  } catch (err) {
    return { error: 'required-gates.json is unreadable: ' + (err?.message ?? String(err)) };
  }
};

/** The gates the contract requires RIGHT NOW: those whose owning stage is active. */
export const activeRequiredGates = () => {
  const r = requiredGates();
  if (r.error) return r;
  const active = new Set(r.required.activeStages || []);
  return {
    required: r.required,
    active: r.required.gates.filter((g) => active.has(g.stage)),
    later: r.required.gates.filter((g) => !active.has(g.stage)),
  };
};

export const loadGate = async (name) => {
  const p = join(GATES_DIR, name + '.mjs');
  if (!existsSync(p)) return null;
  return import(pathToFileURL(p).href);
};

export const runGate = async (name) => {
  const mod = await loadGate(name);
  if (!mod) return { name, ok: false, unknown: true, message: 'no gate module tools/mdc/gates/' + name + '.mjs' };
  if (typeof mod.run !== 'function') return { name, ok: false, message: 'tools/mdc/gates/' + name + '.mjs exports no run()' };
  if (!mod.SENTINEL) {
    return { name, ok: false, message: 'tools/mdc/gates/' + name + '.mjs declares no SENTINEL. A gate without a positive sentinel cannot be decided on printed output.' };
  }
  if (!mod.FAILURE_SENTINEL) {
    return { name, ok: false, message: 'tools/mdc/gates/' + name + '.mjs declares no FAILURE_SENTINEL. D-004: a sentinel that appears in its own failure text reports green while failing, and the only way to check that is to declare both.' };
  }
  if (String(mod.FAILURE_SENTINEL).includes(String(mod.SENTINEL))) {
    return {
      name, ok: false,
      message: `tools/mdc/gates/${name}.mjs: SENTINEL '${mod.SENTINEL}' appears inside FAILURE_SENTINEL '${mod.FAILURE_SENTINEL}' — this gate would print green on a failing run (D-004)`,
    };
  }
  if (!isMeasurementKind(mod.MEASURES)) {
    return {
      name, ok: false,
      message: `tools/mdc/gates/${name}.mjs declares MEASURES='${mod.MEASURES}', which is not one of ${MEASUREMENT_KINDS.join(', ')}. A criterion measured by the wrong kind is the failure this field exists to prevent.`,
    };
  }
  let res;
  try {
    res = await mod.run();
  } catch (err) {
    return { name, ok: false, measures: mod.MEASURES, message: 'gate threw: ' + (err?.stack || err?.message || String(err)) };
  }
  return {
    name,
    ok: !!res?.ok,
    measures: mod.MEASURES,
    sentinel: mod.SENTINEL,
    failureSentinel: mod.FAILURE_SENTINEL,
    population: res?.population ?? null,
    notImplemented: !!res?.notImplemented,
    notEvaluated: !!res?.notEvaluated,
    message: res?.message ?? '',
    detail: res?.detail ?? null,
  };
};

const main = async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--list');
  const flags = process.argv.slice(2).filter((a) => a.startsWith('--') && a !== '--list');
  void flags;

  if (process.argv.includes('--list')) {
    const onDisk = gateNames();
    const r = activeRequiredGates();
    process.stdout.write('\nMDC GATES\n\n');
    process.stdout.write('  on disk (' + onDisk.length + '):\n');
    for (const g of onDisk) process.stdout.write('    ' + g + '\n');
    if (r.error) { process.stdout.write('\n  REQUIRED SET UNREADABLE — ' + r.error + '\n'); process.exit(1); }
    process.stdout.write('\n  required now, stages ' + (r.required.activeStages.join(' ') || '(none)') + ' (' + r.active.length + '):\n');
    for (const g of r.active) {
      process.stdout.write('    ' + (onDisk.includes(g.gate) ? 'ok      ' : 'MISSING ') + g.gate.padEnd(22) + g.sentinel + '\n');
    }
    process.stdout.write('\n  not yet in scope (' + r.later.length + '):\n');
    for (const g of r.later) process.stdout.write('    ' + g.stage.padEnd(8) + ' ' + g.gate + '\n');
    process.stdout.write('\n');
    return;
  }

  const name = args[0];
  if (!name) {
    process.stdout.write('\nMDC-GATE FAILED — no gate named. Usage: npm run mdc:gate -- <name>\n\n');
    process.exit(1);
  }
  const res = await runGate(name);
  process.stdout.write('\n');
  if (res.unknown) {
    const r = activeRequiredGates();
    const required = !r.error && r.active.some((g) => g.gate === name);
    process.stdout.write(`MDC-GATE FAILED — ${name}: ${res.message}\n`);
    if (required) process.stdout.write(`  the contract REQUIRES this gate at the current stage. It is missing, not passing.\n`);
    process.stdout.write('\n');
    process.exit(1);
  }
  if (res.notImplemented) {
    process.stdout.write(`MDC-GATE NOT-IMPLEMENTED — ${name}: ${res.message}\n\n`);
    process.exit(1);
  }
  if (res.notEvaluated) {
    process.stdout.write(`MDC-GATE NOT-EVALUATED — ${name}: ${res.message}\n\n`);
    process.exit(1);
  }
  if (!res.ok) {
    process.stdout.write(`${res.failureSentinel || 'MDC-GATE FAILED'} — ${name}: ${res.message}\n\n`);
    process.exit(1);
  }
  process.stdout.write(`  ${name}  measures ${res.measures}  population ${res.population ?? '-'}\n`);
  process.stdout.write(`${res.sentinel} — ${res.message}\n\n`);
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
