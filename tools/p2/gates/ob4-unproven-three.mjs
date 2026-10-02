/**
 * GATE: ob4-unproven-three — criterion C3.
 *   →  `OB-4-RESIDUAL OK — lock + disk-full proven, power-loss characterised`
 *
 *   > **C3.** *"The three things P1 could not prove are addressed: an **importer concurrency lock**
 *   > exists and is tested; a **disk-full rename failure** is handled and injected in a test;
 *   > **power-loss** behaviour is characterised."*
 *
 *   > **OB-4.** *"Three things P1 did NOT prove, and P2 must not assume: a real power-loss crash
 *   > (the interruptions are injected exceptions); concurrent importers (one at a time is assumed);
 *   > and a rename failing for lack of disk space."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TWO OF THE THREE ARE CLOSED. THE THIRD IS NOT, AND THE SENTINEL SAYS SO.
 *
 * The contract's own sentinel is *"lock + disk-full **proven**, power-loss **characterised**"* —
 * three clauses and two verbs, and the difference between them is the whole point of this gate.
 *
 * A lock can be tested: start an import, start another, watch the second be refused. A disk-full
 * rename can be injected: make the store throw `ENOSPC` at the promote and watch the device end on
 * the set it started with.
 *
 * **A power loss cannot be simulated in this repository.** An injected exception unwinds a stack;
 * a power cut unwinds nothing, and every `finally` that runs on the injected path does not run on a
 * real one. So C3 asks for the gap to be CHARACTERISED, and this gate checks that the
 * characterisation exists, is specific, and says what it does not prove — because a document that
 * only listed what was covered would read as a closure.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PARAGRAPH IS READ FROM THE HANDOFF
 *
 * `tools/p2/ob4-refusals.json` carries the sentence naming the three gaps, parsed from the handoff
 * and compared back by the pipeline. A gate that hardcoded "lock, disk-full, power loss" would
 * survive the handoff being rewritten to name a fourth.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C3'];
export const SENTINEL = 'OB-4-RESIDUAL OK — lock + disk-full proven, power-loss characterised';

const REFUSALS = join('tools', 'p2', 'ob4-refusals.json');
const SUITE = 'src/data/adapter/import/__tests__/ob4Refusals.test.ts';
const POWER_LOSS = join('src', 'data', 'adapter', 'import', 'POWER_LOSS.md');

/** The three gaps, each with the test that closes it — or, for the third, the document that names it. */
const CLAUSES = [
  {
    gap: 'concurrent importers',
    /** The handoff's own words, so a rewrite of the paragraph is a failure rather than a silence. */
    inHandoff: /concurrent importers/i,
    verb: 'PROVEN',
    cases: [
      'an importer concurrency lock exists, and is released on every path',
      'a second import while one is running is REFUSED, not queued',
    ],
  },
  {
    gap: 'a rename failing for lack of disk space',
    inHandoff: /rename failing for lack of disk space/i,
    verb: 'PROVEN',
    cases: ['a rename that fails for lack of disk space leaves the prior state recoverable'],
  },
  {
    gap: 'a real power-loss crash',
    inHandoff: /power-loss crash/i,
    verb: 'CHARACTERISED',
    cases: ['a power loss is CHARACTERISED, not claimed closed'],
  },
];

/** What the characterisation must actually contain to be one. */
const MUST_SAY = [
  [/what this does NOT prove/i, 'a section saying what it does not prove — a document listing only what is covered reads as a closure'],
  [/injected exception/i, 'that these interruptions are injected exceptions'],
  [/unwind/i, 'that a throw unwinds a stack and a power cut does not'],
  [/fsync|flush/i, 'the flush-ordering gap: a write that returned success can still be absent'],
  [/C2\b/, 'which criterion actually closes it'],
];

const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── the three gaps, as the handoff names them ────────────────────────────────────
  if (!existsSync(join(root, REFUSALS))) {
    return fail(REFUSALS + ' does not exist — the three gaps are read from the handoff through it, '
      + 'and a gate that hardcoded them would survive the handoff naming a fourth');
  }
  const parsed = JSON.parse(readFileSync(join(root, REFUSALS), 'utf8'));
  const sentence = String(parsed.p1DidNotProve ?? '');
  if (sentence.length === 0) {
    return fail(REFUSALS + ' carries no "three things P1 did not prove" sentence');
  }
  for (const clause of CLAUSES) {
    if (!clause.inHandoff.test(sentence)) {
      problems.push('the handoff no longer names "' + clause.gap + '" among the things P1 did not '
        + 'prove. Either it was closed and the sentence should say so, or this gate is now checking '
        + 'a gap nobody claims exists');
    }
  }

  // ── run the suite and read what happened ─────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, SUITE))) return fail(SUITE + ' does not exist');
  if (!existsSync(jest)) return fail('no jest binary — none of this can be proven by running it');

  const r = spawnSync(process.execPath, [jest, SUITE, '--verbose', '--ci'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  const passed = (t) => new RegExp('[√✓]\\s*' + escapeForRegExp(t)).test(out);
  const skipped = (t) => new RegExp('(○|skipped)\\s+' + escapeForRegExp(t)).test(out);

  for (const clause of CLAUSES) {
    for (const c of clause.cases) {
      if (skipped(c)) problems.push('SKIPPED (' + clause.gap + '): "' + c + '"');
      else if (!passed(c)) problems.push('did not pass (' + clause.gap + '): "' + c + '"');
    }
  }

  // Every step interrupted, not only the interesting one. A recovery proven at the promote and
  // nowhere else is a recovery proven for the case somebody thought of.
  const interruptions = (out.match(/interrupted at [A-Z_]+/g) ?? []);
  const distinct = [...new Set(interruptions)];
  if (distinct.length < 8) {
    problems.push('only ' + distinct.length + ' import step(s) were interrupted. There are eight, '
      + 'and a recovery proven at the promote alone is a recovery proven for the case somebody '
      + 'thought of');
  }

  // ── the characterisation, and whether it is one ──────────────────────────────────
  if (!existsSync(join(root, POWER_LOSS))) {
    problems.push(POWER_LOSS + ' does not exist. C3 asks for power loss to be CHARACTERISED, and a '
      + 'characterisation nobody wrote down is a claim');
  } else {
    const doc = readFileSync(join(root, POWER_LOSS), 'utf8');
    for (const [re, what] of MUST_SAY) {
      if (!re.test(doc)) problems.push(POWER_LOSS + ' does not state ' + what);
    }
  }

  const summary = (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim();
  lines.push('the three gaps  read from ' + parsed.source);
  for (const clause of CLAUSES) {
    lines.push('  ' + clause.verb.padEnd(15) + clause.gap);
    for (const c of clause.cases) lines.push('      ' + (passed(c) ? 'ok ' : 'NO ') + c);
  }
  lines.push('');
  lines.push('interruptions   ' + distinct.length + ' of 8 import steps interrupted and recovered from');
  lines.push('characterised   ' + POWER_LOSS.replace(/\\/g, '/'));
  lines.push('suite           ' + summary);
  lines.push('');
  lines.push('TWO VERBS, DELIBERATELY. A lock and a disk-full rename are PROVEN — they can be made to');
  lines.push('  happen here. A power loss is CHARACTERISED, because an injected exception unwinds a');
  lines.push('  stack and a power cut unwinds nothing. C2 closes it, on a device, in Phase 11.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
