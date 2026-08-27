/**
 * GATE: surfaces-pure — criterion B1.  →  `SURFACES-PURE OK`
 *
 *   > **B1.** *"No P4 surface holds recommendation logic in either direction: every number a
 *   > surface shows came from an engine call, and no media asset or artwork reference appears
 *   > in any engine input or output, enforced at build time."*
 *
 * THE POPULATION IS DERIVED. Surface files are everything under `src/screens` and
 * `src/components` that is `.ts`/`.tsx`, minus tests. Engine files are everything under
 * `src/engines` that is `.ts`, minus tests. A hand-kept list of "the screens we have"
 * would be complete the day it was written and silent the day the next one landed.
 *
 * A SEARCH THAT FINDS NOTHING MUST NEVER READ AS A PASS. Both populations are asserted
 * non-empty first. The seam file is asserted to exist and to contain exactly one call to
 * `evaluatePurchaseVerdict`.
 *
 * WHAT THIS GATE DOES NOT DO. It does not grep Check Input for `> 0` — that is C1's
 * amount-required clause, input validation, not a recommendation. It looks for load
 * ratios, threshold literals, and a second call to the verdict engine from a surface.
 *
 * NEGATIVE CONTROL (contract §5 B1): compute a threshold comparison inside a screen
 * component and watch this gate fail.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['B1'];
export const SENTINEL = 'SURFACES-PURE OK';
export const MEASURES = 'source';

const SEAM = 'src/check/runPurchaseCheck.ts';
const SURFACE_ROOTS = ['src/screens', 'src/components'];
const ENGINE_ROOT = 'src/engines';

const SKIP_DIR = new Set(['__tests__', 'node_modules']);

const RECOMMENDATION_IN_SURFACE = [
  /\bsafeRatio\b/,
  /\bhardRatio\b/,
  /\bprojectedLoad\b/,
  /\bthresholdMath\b/,
  /\bloadAfter\b/,
  /[><]=?\s*0\.35\b/,
  /[><]=?\s*0\.50?\b/,
  /\/\s*(monthlyIncome|income)\b/,
];

const ENGINE_CALL_FROM_SURFACE = /import\s+(?!type\b)[^;]*\bevaluatePurchaseVerdict\b/;
const MEDIA_IN_ENGINE = /\b(artworkUrl|imageUrl|logoUrl|mediaAsset|sourceUrl)\b/;

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name) || entry.name.startsWith('.')) continue;
    const next = join(abs, entry.name);
    if (entry.isDirectory()) walk(next, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(next);
  }
  return acc;
};

const rel = (root, abs) => abs.slice(root.length + 1).replace(/\\/g, '/');

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const run = async ({ root }) => {
  const seamAbs = join(root, SEAM);
  if (!existsSync(seamAbs)) {
    return fail(SEAM + ' does not exist — there is no engine-call seam, so every number a screen shows would have to be computed there or invented');
  }

  const seamSrc = stripComments(readFileSync(seamAbs, 'utf8'));
  const seamCalls = seamSrc.match(/\bevaluatePurchaseVerdict\s*\(/g) ?? [];
  if (seamCalls.length !== 1) {
    return fail(
      SEAM + ' must contain exactly one evaluatePurchaseVerdict( call (found ' + seamCalls.length
        + '). Two calls are two computations; zero is a seam that does not call the engine.',
    );
  }

  const surfaces = SURFACE_ROOTS.flatMap((d) => walk(join(root, d)));
  if (surfaces.length === 0) {
    return fail('no surface files under ' + SURFACE_ROOTS.join(', ') + ' — a purity check over zero files is not a check (§2 rule 5)');
  }

  const engines = walk(join(root, ENGINE_ROOT)).filter((p) => !p.replace(/\\/g, '/').includes('/__tests__/'));
  if (engines.length === 0) {
    return fail('no engine files under ' + ENGINE_ROOT + ' — the other half of B1 has nothing to measure');
  }

  const problems = [];

  for (const file of surfaces) {
    const path = rel(root, file);
    if (path === SEAM) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    if (ENGINE_CALL_FROM_SURFACE.test(src)) {
      problems.push(path + ' imports evaluatePurchaseVerdict — surfaces call the seam, the seam calls the engine');
    }
    for (const re of RECOMMENDATION_IN_SURFACE) {
      if (re.test(src)) {
        problems.push(path + ' holds recommendation logic matching ' + re);
      }
    }
  }

  for (const file of engines) {
    const path = rel(root, file);
    const src = stripComments(readFileSync(file, 'utf8'));
    if (MEDIA_IN_ENGINE.test(src)) {
      problems.push(path + ' names a media/artwork field — engines must not carry assets (B1 other direction)');
    }
  }

  if (problems.length) {
    return fail('B1 broken:\n    ' + problems.join('\n    '));
  }

  return ok(SENTINEL, [
    'seam           ' + SEAM + ' · one evaluatePurchaseVerdict( call',
    'surfaces       ' + surfaces.length + ' file(s) under ' + SURFACE_ROOTS.join(', ') + ' — no engine call, no threshold arithmetic',
    'engines        ' + engines.length + ' file(s) under ' + ENGINE_ROOT + ' — no artwork/media field',
  ].join('\n'));
};
