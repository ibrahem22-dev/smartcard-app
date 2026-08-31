/**
 * C11 — DEBT RETIREMENT.
 *
 *   > *"the legacy CardEdit route is gone and the pencil is the only fee editor; no
 *   > un-interpolated template literal reaches a user; the OQ-P5-003 formatPercent unit defect
 *   > (carried OPEN from P5) is repaired under an Owner disposition obtained no later than this
 *   > criterion, with the rendered percentage TEXT pinned to its unit; no dead legacy screen is
 *   > mounted"*
 *
 * MEASURES: 'runtime'. The load-bearing clause is the rendered TEXT, and text is a runtime fact.
 * The four structural clauses are read from source in the same pass and are named separately in
 * the output, so a reader can see which kind of evidence each one rests on.
 *
 * WHAT THIS GATE DOES NOT MEASURE, said plainly rather than implied by silence: it does not open
 * a screen and edit a fee. "The pencil is the only fee editor" is measured here as *the legacy
 * fee-editing screen is not mounted, and the pencil affordance exists* — which is what source can
 * honestly support. Observing the edit itself belongs to the device lane.
 *
 * THE INVENTORY CLAUSE IS THE ONE THAT PREVENTS RECURRENCE. Every call of the percent formatter
 * is enumerated from source and matched against a declared inventory of argument expressions,
 * each carrying the unit it was MEASURED to pass. A new call site that nobody classified fails
 * this gate. That is the difference between fixing the twelve call sites that exist and stopping
 * the thirteenth from reintroducing the defect — and the thirteenth is how this class returns,
 * because the original defect was never that a formatter was wrong, it was that one formatter
 * served two units and nothing said which was which.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { okOverPopulation, fail, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'DEBT-RETIREMENT OK';
export const FAILURE_SENTINEL = 'DEBT-RETIREMENT FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SRC = join(ROOT, 'src');

const SUITE = 'src/utils/__tests__/percentUnit.test.ts';
const REQUIRED_CASES = [
  'renders a ratio as its percentage: 0.41 becomes 41%',
  'never renders a ratio as a fraction of a percent',
  'renders the two shipped load thresholds as 35% and 50%',
  'renders a whole percentage without a decimal tail from floating point',
  'renders the same percentage in he, ar and en',
  'converts an already-percent figure through ratioFromPercent',
];

/**
 * EVERY CALL OF THE PERCENT FORMATTER, WITH THE UNIT IT WAS MEASURED TO PASS.
 *
 * Established 2026-08-31 by a traced pass over all twelve call sites, each followed back to a
 * definition or a real value and then independently re-derived by a second reader. The RATIO
 * entries were rendering a hundredfold too small before the repair; the ALREADY_PERCENT four are
 * the ones the Owner ruling names, and each now converts at the call site.
 *
 * Keyed by the argument EXPRESSION rather than a line number, so ordinary edits do not churn it
 * and a genuinely new caller still fails.
 */
const INVENTORY = [
  // The seam. It decides no unit; it forwards one, and its parameter is named for it.
  { file: 'src/hooks/useMoney.ts', arg: 'ratio', unit: 'PASS_THROUGH' },
  { file: 'src/screens/home/HomeLoadBar.tsx', arg: 'ratio', unit: 'RATIO' },
  { file: 'src/screens/home/HomeLoadBar.tsx', arg: 'strongWarningRatio', unit: 'RATIO' },
  { file: 'src/screens/home/HomeLoadBar.tsx', arg: 'blockedRatio', unit: 'RATIO' },
  { file: 'src/screens/plan/CommitmentsSummary.tsx', arg: 'load.current.ratioOfIncome.value', unit: 'RATIO' },
  { file: 'src/screens/plan/CommitmentsSummary.tsx', arg: 'load.thresholds.warningRatio.value', unit: 'RATIO' },
  { file: 'src/screens/plan/CommitmentsSummary.tsx', arg: 'load.thresholds.strongWarningRatio.value', unit: 'RATIO' },
  { file: 'src/screens/plan/CommitmentsSummary.tsx', arg: 'load.thresholds.blockedRatio.value', unit: 'RATIO' },
  { file: 'src/screens/cardDna/SectionDActiveNow.tsx', arg: 'number.value', unit: 'RATIO' },
  { file: 'src/screens/cardDna/SectionACosts.tsx', arg: 'ratioFromPercent(numeric)', unit: 'ALREADY_PERCENT' },
  { file: 'src/screens/cardDna/SectionACosts.tsx', arg: 'ratioFromPercent(rate)', unit: 'ALREADY_PERCENT' },
  { file: 'src/screens/cardDna/SectionBGives.tsx', arg: 'ratioFromPercent(row.valuePercent)', unit: 'ALREADY_PERCENT' },
  { file: 'src/screens/DecisionScreen.tsx', arg: 'ratioFromPercent(rowItem.commission)', unit: 'ALREADY_PERCENT' },
];

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== '__snapshots__') walk(p, out); }
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
};
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/** percent(...) / format.percent(...) / formatPercent(...) call sites, with their argument text. */
const percentCallSites = (files) => {
  const sites = [];
  for (const f of files) {
    if (rel(f) === 'src/utils/money.ts') continue; // the definition, not a call site
    const src = stripCommentsAndStrings(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/(?:^|[^A-Za-z0-9_.])(?:format\.)?(percent|formatPercent)\s*\(/g)) {
      const open = m.index + m[0].length - 1;
      let depth = 0, i = open;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) break; }
      }
      const inner = src.slice(open + 1, i).trim();
      // formatPercent's own definition and the language argument are not call sites.
      if (/^ratio: number|^value: number/.test(inner)) continue;
      const arg = inner.split(/,(?![^(]*\))/)[0].trim();
      sites.push({ file: rel(f), arg, line: src.slice(0, m.index).split('\n').length });
    }
  }
  return sites;
};

/** t('… {{x}} …') calls whose params object does not supply x. */
const unsuppliedPlaceholders = (files) => {
  const bad = [];
  let scanned = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gs)) {
      const key = m[2];
      const phs = [...key.matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]);
      if (!phs.length) continue;
      scanned++;
      let i = m.index + m[0].length;
      while (i < src.length && /\s/.test(src[i])) i++;
      const line = src.slice(0, m.index).split('\n').length;
      if (src[i] !== ',') { bad.push(`${rel(f)}:${line} passes no values for ${phs.join(', ')}`); continue; }
      i++;
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== '{') { bad.push(`${rel(f)}:${line} second argument is not an object literal`); continue; }
      let depth = 0, j = i;
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } }
      }
      const supplied = new Set([...src.slice(i, j).matchAll(/(?:^|[{,\s])(\w+)\s*[:,}]/g)].map((x) => x[1]));
      const missing = phs.filter((p) => !supplied.has(p));
      if (missing.length) bad.push(`${rel(f)}:${line} omits ${missing.join(', ')}`);
    }
  }
  return { bad, scanned };
};

export const run = async () => {
  if (!existsSync(SRC)) return fail('src/ does not exist');
  const files = walk(SRC);
  const problems = [];
  const clauses = [];

  // ---- CLAUSE 1 (runtime): the rendered percentage TEXT is pinned to its unit.
  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES);
  if (jest.problems.length) problems.push(...jest.problems.map((p) => 'rendered-text: ' + p));
  clauses.push(`rendered text pinned by ${REQUIRED_CASES.length} named case(s) — ${jest.summary}`);

  // ---- CLAUSE 2 (source): the legacy CardEdit route is gone.
  const cardEdit = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (/CardEdit/.test(src)) {
      for (const [i, l] of src.split('\n').entries()) {
        // A prose mention in a comment recording the retirement is not a route.
        if (!/CardEdit/.test(l)) continue;
        if (/^\s*(\*|\/\/)/.test(l)) continue;
        cardEdit.push(`${rel(f)}:${i + 1} ${l.trim().slice(0, 80)}`);
      }
    }
  }
  if (cardEdit.length) problems.push(...cardEdit.map((c) => 'CardEdit survives: ' + c));
  clauses.push(`CardEdit route absent from ${files.length} source file(s)`);

  // ---- CLAUSE 3 (source): no dead legacy screen is mounted.
  const mounted = [];
  for (const f of files.filter((x) => /navigation/.test(rel(x)))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/component=\{(\w+)\}/g)) mounted.push({ file: rel(f), component: m[1] });
  }
  const LEGACY = ['CardDetailScreen', 'CardEditRoute'];
  const deadMounted = mounted.filter((m) => LEGACY.includes(m.component));
  if (deadMounted.length) {
    problems.push(...deadMounted.map((m) => `dead legacy screen mounted: ${m.component} in ${m.file}`));
  }
  clauses.push(`${mounted.length} mounted screen component(s), none of them ${LEGACY.join(' or ')}`);

  // ---- CLAUSE 4 (source): the pencil, the one fee editor this gate can see, is present.
  const pencil = files.filter((f) => /-pencil/.test(readFileSync(f, 'utf8'))).map(rel);
  if (pencil.length === 0) problems.push('no pencil affordance found in any source file — C11 requires the pencil to BE the fee editor');
  if (pencil.length > 1) problems.push('more than one file carries a pencil affordance: ' + pencil.join(', '));
  clauses.push(`pencil affordance in exactly ${pencil.length} file(s): ${pencil.join(', ') || '(none)'}`);

  // ---- CLAUSE 5 (source): no un-interpolated placeholder reaches a user.
  const ph = unsuppliedPlaceholders(files);
  if (ph.bad.length) problems.push(...ph.bad.map((b) => 'un-interpolated placeholder: ' + b));
  clauses.push(`${ph.scanned} translation call(s) carrying a placeholder, all supplied`);

  // ---- CLAUSE 6 (source): every percent call site is classified.
  const sites = percentCallSites(files);
  const key = (s) => `${s.file}::${s.arg}`;
  const declared = new Set(INVENTORY.map(key));
  const found = new Set(sites.map(key));
  for (const s of sites) {
    if (!declared.has(key(s))) {
      problems.push(
        `unclassified percent call site ${s.file}:${s.line} — percent(${s.arg}). ` +
        'Every caller must state its unit: pass a RATIO, or convert an already-percent figure with ratioFromPercent(), ' +
        'and add it to INVENTORY in this gate with the unit you MEASURED it to pass (OQ-MDC-004).',
      );
    }
  }
  for (const d of INVENTORY) {
    if (!found.has(key(d))) problems.push(`INVENTORY names a call site that no longer exists: ${d.file} percent(${d.arg}) — re-measure and update it, never delete it unread`);
  }
  clauses.push(`${sites.length} percent call site(s), every one classified (${INVENTORY.filter((i) => i.unit === 'RATIO').length} ratio, ${INVENTORY.filter((i) => i.unit === 'ALREADY_PERCENT').length} converted)`);

  if (problems.length) {
    return fail(problems.join('\n           '), { population: sites.length });
  }

  return okOverPopulation({
    population: sites.length + REQUIRED_CASES.length + ph.scanned,
    unit: 'measurement(s)',
    detail: clauses.join(' · '),
    floor: 12,
  });
};
