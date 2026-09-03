/**
 * GATE: money-format — criterion T2.  →  `MONEY-FORMAT OK`
 *
 *   > **T2.** *"MONEY & TYPE: every rendered amount uses tabular numerals with thousands-separated
 *   > shekel formatting, and every rendered percentage's TEXT is pinned to its unit — a ratio of
 *   > 0.41 renders 41 percent, never 0.41 percent"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE TEXT IS THE CLAIM, SO THE TEXT IS WHAT IS ASSERTED
 *
 * A formatter can be correct in isolation and still put the wrong string on a screen. So clause 1
 * does not inspect `formatMoney`; it runs named cases that pin what it RENDERS — `₪18,000.00`,
 * `₪1,234,567.50`, two fraction digits always, the sign exactly once and at the front.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE UNIT, AND WHY THIS GATE GUARDS IT RATHER THAN RE-PROVING IT
 *
 * `formatPercent` takes a RATIO. That is OQ-MDC-004's ruling and `percentUnit.test.ts` pins it,
 * read by C11's debt-retirement gate, which also inventories every call site with its measured
 * unit. This gate does not duplicate that inventory. It guards the thing the inventory cannot see:
 * that a SECOND percent formatter has not appeared beside the first. money.ts warns about exactly
 * this — *"adding a second function beside this one leaves two formatters serving two units with
 * nothing to say which is right at a new call site, so the defect returns the first time somebody
 * guesses."* Clause 4 is that sentence made executable.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE LOCALE TRAP, RECORDED BECAUSE IT ALMOST BECAME A FALSE FINDING
 *
 * Measuring the formatters before writing this gate, a first probe used a bare `ar` locale and
 * produced `₪١٨٬٠٠٠٫٠٠` — Arabic-Indic digits, U+066C group separator — which looks like a real
 * cross-locale defect. It is not. `NUMBER_LOCALE` maps Arabic to `ar-IL-u-nu-latn`: Arabic
 * language, LATIN digits, deliberately. The three shipped locales agree exactly, and the pinned
 * cases assert that agreement so that dropping the extension is caught rather than discovered.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DECLARED CONTROL
 *
 * T2 declares `ratio-to-percent-formatter`: *"pass one ratio to the already-percent formatter"*.
 * `ratioFromPercent` divides by 100, so feeding it a ratio renders a hundredth of the truth —
 * `41%` becomes `0.41%`. Clause 1's pinned percentage cases are what that control fires at.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';

export const SENTINEL = 'MONEY-FORMAT OK';
export const FAILURE_SENTINEL = 'MONEY-FORMAT FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const MONEY = join(ROOT, 'src', 'utils', 'money.ts');

const MONEY_SUITE = 'src/utils/__tests__/moneyFormat.test.ts';
const PERCENT_SUITE = 'src/utils/__tests__/percentUnit.test.ts';

const MONEY_CASES = [
  'renders a shekel amount with thousands separation: 18000 becomes ₪18,000.00',
  'separates thousands at every magnitude the app renders',
  'renders the same money text in he, ar and en',
  'always renders two fraction digits, so amounts align down a column',
  'carries the currency sign exactly once, at the front',
  'renders digits without the currency sign when the caller asks for an amount',
  'applies tabular numerals, which is what makes a column of amounts align',
];

/* The unit cases the control fires at. Named here so this gate fails on the RENDERED text rather
   than on a call-site inventory, which is C11's job and not this one's. */
const PERCENT_CASES = [
  'renders a ratio as its percentage: 0.41 becomes 41%',
  'never renders a ratio as a fraction of a percent',
  'renders the same percentage in he, ar and en',
];

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const read = (p) => readFileSync(p, 'utf8');

/* Comments go, strings stay: a raw money string IS a string literal, so stripping strings would
   blank the very thing clause 2 hunts. Length-preserving so line numbers stay true. */
const stripComments = (text) => {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, before, comment) => before + blank(comment));
};

const surfaceFiles = () => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
      else if (/\.tsx$/.test(e.name)) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
};

export const run = async () => {
  const problems = [];
  const clauses = [];

  if (!existsSync(MONEY)) return fail('src/utils/money.ts is missing — there is no one place that formats money');

  /* 1. THE RENDERED TEXT, pinned. Money and the percentage unit the control attacks. */
  const money = requireJestCases(ROOT, MONEY_SUITE, MONEY_CASES, ['--runInBand']);
  if (money.problems.length) problems.push(...money.problems.map((p) => 'money text: ' + p));
  const percent = requireJestCases(ROOT, PERCENT_SUITE, PERCENT_CASES, ['--runInBand']);
  if (percent.problems.length) problems.push(...percent.problems.map((p) => 'percent unit: ' + p));
  clauses.push(`rendered text pinned by ${MONEY_CASES.length} money and ${PERCENT_CASES.length} percent case(s)`);

  /* 2. NO AMOUNT ESCAPES THE FORMATTER. A surface that builds its own money string is a second
        format with nothing comparing it to the first. */
  const escapes = [];
  for (const f of surfaceFiles()) {
    const lines = stripComments(read(f)).split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/₪\s*\$\{/.test(line) || /\$\{[^}]*\}\s*₪/.test(line)) escapes.push(`${rel(f)}:${i + 1} builds a shekel string by interpolation`);
      if (/\.toLocaleString\s*\(/.test(line)) escapes.push(`${rel(f)}:${i + 1} calls toLocaleString directly`);
      if (/new\s+Intl\.NumberFormat\s*\(/.test(line)) escapes.push(`${rel(f)}:${i + 1} constructs its own Intl.NumberFormat`);
    }
  }
  if (escapes.length > 0) problems.push(`amounts formatted outside the money module: ${escapes.join('; ')}`);
  clauses.push('no surface formats an amount for itself');

  /* 3. TABULAR NUMERALS REACH THE SURFACES. A screen that renders amounts must apply the style,
        or a column of figures will not align however correct each one is. */
  const renderers = surfaceFiles().filter((f) => /\b(money|amount)\s*\(/.test(stripComments(read(f))));
  const withoutTabular = renderers.filter((f) => !/TABULAR_NUMERALS/.test(read(f)));
  if (renderers.length === 0) problems.push('no surface renders an amount — an empty population proves nothing');
  if (withoutTabular.length > 0) {
    problems.push(`surfaces rendering amounts without TABULAR_NUMERALS: ${withoutTabular.map(rel).join(', ')}`);
  }
  clauses.push(`${renderers.length} surface(s) render amounts, all applying tabular numerals`);

  /* 4. ONE PERCENT FORMATTER. money.ts's own warning, enforced. */
  const moneySrc = stripComments(read(MONEY));
  const percentExports = (moneySrc.match(/export\s+function\s+(\w*[Pp]ercent\w*)/g) || [])
    .map((m) => m.replace(/.*\s/, ''));
  const formatters = percentExports.filter((n) => /^format/.test(n));
  if (!formatters.includes('formatPercent')) problems.push('money.ts no longer exports formatPercent');
  if (formatters.length !== 1) {
    problems.push(
      `money.ts exports ${formatters.length} percent FORMATTERS (${formatters.join(', ')}); exactly one may exist. `
      + 'Two formatters serving two units leave nothing to say which is right at a new call site.',
    );
  }
  if (!/export\s+function\s+ratioFromPercent/.test(moneySrc)) {
    problems.push('ratioFromPercent is gone — the unit conversion must stay a named, greppable function');
  }
  clauses.push(`exactly one percent formatter, with ratioFromPercent as the named conversion`);

  const population = MONEY_CASES.length + PERCENT_CASES.length + renderers.length;
  if (problems.length > 0) return fail(problems.join('; '), { population });
  return okOverPopulation({
    population,
    unit: 'pinned case(s) and amount-rendering surface(s)',
    detail: clauses.join(' · '),
  });
};
