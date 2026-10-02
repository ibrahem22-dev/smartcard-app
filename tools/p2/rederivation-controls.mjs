#!/usr/bin/env node
/**
 * NEGATIVE CONTROLS FOR THE EIGHT D4 CHECKS — one per interface, each watched to fire.
 *
 * D4 asks for *"one static check per interface, each named"*. Eight checks that have never caught
 * anything are eight claims, and this app currently re-derives none of the eight — so without these
 * the gate would print `8 of 8` having proven only that it can count.
 *
 * Each control writes a file that GENUINELY RE-DERIVES its interface, in the way the handoff's own
 * "Re-deriving it means" column describes, runs the real check, requires it to fire, then deletes
 * the file and asserts the path is absent again. No control touches a file the app ships.
 *
 *     node tools/p2/rederivation-controls.mjs
 *
 * THE CONTROLS ARE WRITTEN FROM THE HANDOFF'S WORDS, not from the regexes. That ordering matters: a
 * control derived from the implementation proves the implementation matches itself. Each entry below
 * quotes the consequence the handoff names, and the injected code is an attempt to commit exactly
 * that act — so a check that passes a control has been shown to catch the thing the authority was
 * worried about, not the thing the author happened to write a pattern for.
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const gate = await import('./gates/no-rederivation.mjs');
const mirror = JSON.parse(readFileSync(join(HERE, 'interfaces.json'), 'utf8'));

/**
 * The injections. Keyed by interface id; each quotes the handoff consequence it commits.
 * `code` is written to `file`, which must not already exist.
 */
const INJECTIONS = {
  'IF-1': {
    commits: 'performing, in a second place and with a second rounding rule, a conversion the pipeline deliberately does not perform',
    file: 'src/utils/__negctl_if1.ts',
    code: 'export function convertQuoteUnit(nativeValue: number, quoteUnit: number): number {\n'
      + '  return Math.round((nativeValue * quoteUnit) * 100) / 100;\n'
      + '}\n',
  },
  'IF-2': {
    commits: "a second grading vocabulary that disagrees with the packs' own",
    file: 'src/utils/__negctl_if2.ts',
    code: "export type ConsumabilityVerdict = 'exact' | 'approximate' | 'unusable';\n"
      + "export const gradeIt = (): ConsumabilityVerdict => 'exact';\n",
  },
  'IF-3': {
    commits: 'classifying a conflict axis without the estate, which is the evidence that decides it',
    file: 'src/utils/__negctl_if3.ts',
    code: 'export function computeRankability(lo: number, hi: number): string {\n'
      + "  return hi > lo ? 'rankable' : 'unrankable';\n"
      + '}\n',
  },
  'IF-4': {
    commits: 'inventing a winner where the pipeline refused to name one',
    file: 'src/utils/__negctl_if4.ts',
    code: 'export function pickConflictWinner(a: number, b: number): number {\n'
      + '  return a >= b ? a : b;\n'
      + '}\n',
  },
  'IF-5': {
    commits: 'an object computing its own shipping predicate — the exact defect S15 closed for stacking',
    file: 'src/utils/__negctl_if5.ts',
    code: 'export function isShipped(row: { flag?: boolean }): boolean {\n'
      + '  return row.flag === true;\n'
      + '}\n',
  },
  'IF-6': {
    commits: 'a reference the build does not check, found later by a harness instead of by the build that created it',
    file: 'src/utils/__negctl_if6.ts',
    code: "export const compositionMap: Record<string, string[]> = { core: ['a', 'b'] };\n",
  },
  'IF-7': {
    commits: 'a load-time check replaced by prose nobody enforces',
    file: 'src/utils/__negctl_if7.ts',
    code: 'export const COMPATIBILITY_MATRIX: Record<string, string[]> = { v1: [] };\n',
  },
  'IF-8': {
    commits: 'a check a pack can influence, which is not a check',
    file: 'src/utils/__negctl_if8.ts',
    code: 'declare const pack: { meta: { datasetId: string } };\n'
      + 'export const EXPECTED_DATASET_ID = pack.meta.datasetId;\n',
  },
};

const controls = [];

for (const iface of mirror.interfaces) {
  const inj = INJECTIONS[iface.id];
  if (!inj) {
    console.log('  NO CONTROL for ' + iface.id + ' — ' + iface.name);
    controls.push({ id: iface.id, name: iface.name, fired: false, restored: true, error: 'no injection defined' });
    continue;
  }
  const abs = join(ROOT, inj.file);
  if (existsSync(abs)) {
    console.log('  SKIPPED ' + iface.id + ' — control path already exists: ' + inj.file);
    controls.push({ id: iface.id, name: iface.name, fired: false, restored: true, error: 'control path already exists' });
    continue;
  }

  let result;
  try {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, inj.code);
    result = await gate.run({ root: ROOT });
  } finally {
    if (existsSync(abs)) rmSync(abs);
  }

  const restored = !existsSync(abs);
  const detail = String(result?.detail ?? result?.message ?? '');
  const output = String(result?.output ?? '');
  const mentions = (detail + '\n' + output).split('\n').filter((l) => l.includes(inj.file));
  const fired = mentions.length > 0;

  controls.push({
    id: iface.id,
    name: iface.name,
    commits: inj.commits,
    injected: inj.file,
    fired,
    restored,
    sawExactly: mentions.slice(0, 2).map((l) => l.trim()),
  });
  console.log((fired ? '  FIRED  ' : '  DID NOT FIRE  ') + iface.id + '  ' + iface.name);
  if (fired) console.log('           ' + mentions[0].trim().slice(0, 120));
  if (!restored) console.log('           *** TREE NOT RESTORED ***');
}

const gitSha = (() => {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout).trim() : null;
})();

const allFired = controls.every((c) => c.fired);
const allRestored = controls.every((c) => c.restored);

writeFileSync(join(HERE, 'rederivation-controls.json'), JSON.stringify({
  $comment: [
    'NEGATIVE-CONTROL RECORD for the eight D4 checks. Regenerate with:',
    '  node tools/p2/rederivation-controls.mjs',
    'tools/p2/gates/no-rederivation.mjs READS this file and refuses to pass if any interface has no',
    'control that fired. Eight checks that have never caught anything are eight claims.',
    'Each control writes a file that genuinely re-derives its interface — in the way the handoff’s',
    'own "Re-deriving it means" column describes, quoted per entry as `commits` — runs the real',
    'check, requires it to fire, deletes the file and asserts the path is absent again.',
  ],
  recordedAt: new Date().toISOString(),
  sha: gitSha,
  source: mirror.source,
  count: controls.length,
  allFired,
  allRestored,
  controls,
}, null, 2) + '\n');

console.log('');
console.log(allFired && allRestored
  ? 'REDERIVATION-CONTROLS OK — ' + controls.length + ' of ' + controls.length + ' checks watched to fire, tree restored'
  : 'REDERIVATION-CONTROLS FAILED — ' + controls.filter((c) => c.fired).length + ' of ' + controls.length
    + ' fired · restored=' + allRestored);
process.exit(allFired && allRestored ? 0 : 1);
