/**
 * GATE: boi-offline — criterion A7.  →  `BOI-OFFLINE OK`
 *
 *   > *"Offline with no cache degrades to COMPARISON_INCOMPLETE and never to a number."*
 *
 * Offline-first is a locked product tenet. The end of the chain is an honest incompleteness — not
 * zero, not the nearest currency, not the last value the app happened to see. This gate requires
 * the degradation to have been WATCHED for a currency no lane can answer, and scans src/data/fx/**
 * for the fallbacks that would quietly defeat it (a `?? 0`, a hardcoded rate, a default currency).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A7'];
export const SENTINEL = 'BOI-OFFLINE OK';

const DIR = 'src/data/fx';
const SUITE = 'src/data/fx/__tests__/lane.test.ts';

const REQUIRED_CASES = [
  'a currency outside every lane yields COMPARISON_INCOMPLETE, not zero',
  'an empty cache behaves like no cache — the cold start still resolves via BUNDLED',
];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.ts$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

export const run = async ({ root }) => {
  const dir = join(root, DIR);
  const files = walk(dir);
  if (files.length === 0) {
    return fail(DIR + '/** holds no modules — there is no lane to be offline WITH');
  }

  // A module that names COMPARISON_INCOMPLETE nowhere cannot be carrying it as its failure answer.
  // (The client refuses; the LANE degrades. At least the lane and its tests must name the state.)
  let anyNamesIt = false;
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (code.includes('COMPARISON_INCOMPLETE')) anyNamesIt = true;
    // The quiet zero: the classic way an offline device produces a confident wrong number.
    for (const m of code.matchAll(/\b(rateIlsPerQuoteUnit|rateIlsPerUnit)\b\s*(\?\?|\|\|)\s*0\b/g)) {
      return fail(rel + ':' + code.slice(0, m.index).split('\n').length + ' falls back to zero '
        + '("' + m[0].trim() + '"). OD-23b: a missing rate is a missing answer, not a free '
        + 'conversion');
    }
    // A hardcoded rate literal in the lane is an invented rate with no date.
    for (const m of code.matchAll(/=\s*\d+\.\d+\s*(;|,)/g)) {
      return fail(rel + ':' + code.slice(0, m.index).split('\n').length + ' assigns a decimal '
        + 'literal ("' + m[0].trim() + '") in the FX lane — a hardcoded rate is an invented one');
    }
  }
  if (!anyNamesIt) {
    return fail('no module under ' + DIR + '/** names COMPARISON_INCOMPLETE. The chain\'s end is '
      + 'an honest incompleteness, and a lane that never says so has hidden it');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    files.length + ' module(s) scanned: no zero-fallback, no hardcoded rate in the lane',
    'offline degradation watched: unknown currency → COMPARISON_INCOMPLETE; empty cache → BUNDLED cold start',
    summary,
  ].join('\n'));
};
