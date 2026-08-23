/**
 * GATE: i18n-audit — criterion A7.  →  `I18N-AUDIT OK — 1 formatter`
 *
 *   > **A7.** *"A Hebrew fall-through audit makes untranslated dynamic strings **visible, not
 *   > silent**; **exactly one money formatter exists**; **tabular numerals applied app-wide**."*
 *
 * Three clauses, three checks, and the sentinel names the middle one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * 1. EXACTLY ONE MONEY FORMATTER
 *
 * Derived, not declared: every `toLocaleString` and `Intl.NumberFormat` in `src/**` is counted, and
 * only `src/utils/money.ts` may hold one. There were EIGHT, in five screens, and every one
 * hardcoded `'he-IL'` — so an Arabic or English reader saw amounts grouped by Hebrew conventions
 * whatever language they had chosen. Three of the eight also disagreed about decimals.
 *
 * Nobody decided the app should format money three ways. Three screens each made a local decision
 * and nothing compared them.
 *
 * 2. THE FALL-THROUGH AUDIT IS VISIBLE
 *
 * `t()` returns the Hebrew source when a translation is missing. That is right at runtime and
 * invisible: an Arabic reader sees Hebrew and nothing says so. The audit enumerates every Hebrew
 * string that can reach a reader and reports what is missing, and this gate refuses any fall-through
 * that `tools/p2/i18n-fallthrough.json` does not account for — the same shape D7 uses, for the same
 * reason: a backlog nobody has to look at is a backlog nobody looks at.
 *
 * A DISPOSITION THAT COVERS NOTHING FAILS TOO. An entry for a gap that has been closed reads as a
 * live deferral and would silently cover the next one.
 *
 * 3. NO LITERAL CARRIES TWO SCRIPTS
 *
 * Added because the audit found one shipping: two Hebrew letters inside an Arabic word, in an engine
 * reason an Arabic reader would have seen as nonsense. There is no allowlist for this one.
 *
 * 4. TABULAR NUMERALS, APP-WIDE
 *
 * Every text that renders a formatted amount carries the tabular style. Derived by finding the
 * formatter's call sites and checking the element around each — proportional digits are different
 * widths, so a column of amounts cannot be read down, which is the only way a list of charges is
 * ever read.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditHebrew } from '../lib/i18n-audit.mjs';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A7'];
export const SENTINEL = 'I18N-AUDIT OK — 1 formatter';

const FORMATTER_MODULE = 'src/utils/money.ts';
const REGISTER = join(HERE, '..', 'i18n-fallthrough.json');

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. exactly one money formatter ───────────────────────────────────────────────
  if (!existsSync(join(root, FORMATTER_MODULE))) {
    return fail(FORMATTER_MODULE + ' does not exist. A7 says exactly one money formatter exists, '
      + 'and a gate that passed without one would be counting to one from zero');
  }
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing');

  const formatters = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const m of code.matchAll(/\.toLocaleString\s*\(|\bIntl\.NumberFormat\s*\(/g)) {
      formatters.push({ file: rel, line: lineAt(code, m.index), what: m[0].trim() });
    }
  }
  const strays = formatters.filter((f) => f.file !== FORMATTER_MODULE);
  const inModule = formatters.length - strays.length;

  if (inModule === 0) {
    problems.push(FORMATTER_MODULE + ' formats nothing — a module named as the one formatter that '
      + 'never calls Intl is a place for a formatter, not a formatter');
  }
  for (const s of strays.slice(0, 6)) {
    problems.push(s.file + ':' + s.line + ' formats a number outside ' + FORMATTER_MODULE
      + ' (' + s.what + '). A7: exactly one money formatter exists');
  }
  if (strays.length > 6) problems.push('… and ' + (strays.length - 6) + ' more formatting site(s)');

  lines.push('formatter       ' + FORMATTER_MODULE + ' · ' + inModule + ' call(s) inside it, '
    + strays.length + ' outside');

  // ── 2, 3. the audit ──────────────────────────────────────────────────────────────
  const audit = auditHebrew(root);
  lines.push('translations    ar ' + audit.translations.ar + ' · en ' + audit.translations.en);
  lines.push('hebrew strings  ' + (audit.covered + audit.fallsThrough.length) + ' reach a reader · '
    + audit.covered + ' fully covered · ' + audit.fallsThrough.length + ' fall through');

  for (const m of audit.mixed) {
    problems.push(m.file + ':' + m.line + ' carries BOTH scripts in one literal: ' + JSON.stringify(m.text.slice(0, 40))
      + '. Nothing in this app legitimately mixes them, and a reader of either language sees nonsense');
  }
  lines.push('mixed script    ' + audit.mixed.length + ' literal(s) carrying Hebrew and Arabic together');

  if (!existsSync(REGISTER)) {
    problems.push('no fall-through register at tools/p2/i18n-fallthrough.json — A7 requires the '
      + 'untranslated strings to be visible, and a count nobody has to account for is not visibility');
  } else {
    const reg = JSON.parse(readFileSync(REGISTER, 'utf8'));
    const dispositions = reg.dispositions ?? [];
    if (dispositions.length === 0) problems.push('the register declares no dispositions');

    const covered = new Map(dispositions.map((d) => [d.id, 0]));
    const orphans = [];
    for (const f of audit.fallsThrough) {
      const hit = dispositions.filter((d) => new RegExp(d.file).test(f.file));
      if (hit.length === 0) { orphans.push(f); continue; }
      covered.set(hit[0].id, covered.get(hit[0].id) + 1);
    }
    lines.push('');
    for (const d of dispositions) {
      const n = covered.get(d.id);
      lines.push('  ' + String(n).padStart(4) + '  ' + d.disposition.padEnd(8) + '  ' + d.id
        + '   → ' + d.deferredTo + ' [' + d.od + ', ' + d.deferredAt + ']');
      if (n === 0) {
        problems.push(d.id + ' covers NOTHING — a disposition for a gap that has closed reads as a '
          + 'live deferral and would silently cover the next one');
      }
      if (d.disposition === 'DEFERRED' && (!d.od || !d.deferredAt)) {
        problems.push(d.id + ' is DEFERRED without ' + (!d.od ? 'an OD id' : 'a date'));
      }
    }
    for (const f of orphans.slice(0, 4)) {
      problems.push('UNACCOUNTED ' + f.file + ':' + f.line + ' [' + f.missing.join(',') + '] '
        + JSON.stringify(f.text.slice(0, 40)));
    }
    if (orphans.length > 4) problems.push('… and ' + (orphans.length - 4) + ' more unaccounted');
    lines.push('  unaccounted   ' + orphans.length);
  }

  // ── 4. tabular numerals wherever an amount renders ───────────────────────────────
  const tabularMisses = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === FORMATTER_MODULE) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    // A rendered amount looks like `{money(x)}` / `{percent(x)}` / `{formatDigits(x, n)}` inside JSX.
    for (const m of code.matchAll(/\{\s*(money|percent|formatDigits)\s*\(/g)) {
      const line = lineAt(code, m.index);
      // The element opening this expression is at most a few lines above it.
      const context = code.split('\n').slice(Math.max(0, line - 6), line).join('\n');
      if (!/TABULAR_NUMERALS/.test(context)) {
        tabularMisses.push({ file: rel, line, call: m[1] });
      }
    }
  }
  for (const t of tabularMisses.slice(0, 5)) {
    problems.push(t.file + ':' + t.line + ' renders ' + t.call + '() without TABULAR_NUMERALS — '
      + 'proportional digits are different widths, so a column of amounts cannot be read down');
  }
  if (tabularMisses.length > 5) problems.push('… and ' + (tabularMisses.length - 5) + ' more');
  lines.push('tabular         ' + tabularMisses.length + ' rendered amount(s) without the tabular style');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'I18N-AUDIT OK — 1 formatter, ' + audit.fallsThrough.length + ' fall-throughs visible and accounted for',
  };
};
