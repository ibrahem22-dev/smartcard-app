/**
 * GATE: holiday-calendar — criterion C9.  →  `HOLIDAY-CALENDAR OK`
 *
 *   > **C9.** *"A BOI market-holiday calendar is supplied to `stalenessOf` **or** its absence is a
 *   > dated `DEFERRED` entry carrying an OD id. **A holiday must not read as an ordinary
 *   > publication day.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A CRITERION WITH TWO ACCEPTABLE ANSWERS, AND THIS GATE CHECKS WHICHEVER ONE IS GIVEN
 *
 * Supply a calendar, or declare its absence properly. What is not acceptable is the third thing —
 * an empty list nobody decided, passed because the parameter was optional, which looks exactly like
 * a calendar that happens to have no holidays in it this year.
 *
 * So the gate reads what the app declares:
 *
 *   · **A calendar is supplied** → it must be non-empty, dated, and name where it came from. A list
 *     of dates with no source is a list somebody assembled from a web search and rendered to users
 *     as though the Bank of Israel had said so.
 *   · **Absence is declared** → it must carry an **OD id that resolves to a real, CLOSED Owner
 *     Decision**, a date, and a pointer into the deferred register. This gate checks the OD exists
 *     and is closed rather than taking the string on trust: `OD-99` is easy to type.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE SECOND SENTENCE IS THE ONE THAT BINDS
 *
 * *"A holiday must not read as an ordinary publication day."* That obligation does not go away when
 * the calendar is deferred — it changes shape. With no calendar, `businessDaysOld` counts a closed
 * market as an open one, so the app must not present that number as a checked fact, and must not
 * answer "yes, the market was open" about a weekday it cannot vouch for.
 *
 * The gate scans for the shortcut: a surface reading `businessDaysOld` without consulting whether
 * it is authoritative.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C9'];
export const SENTINEL = 'HOLIDAY-CALENDAR OK';

const MODULE = 'src/data/adapter/fxStaleness.ts';
const SUITE = 'src/data/adapter/__tests__/fxStaleness.test.ts';

/**
 * The Owner Decisions, in the PIPELINE repository.
 *
 * The app cannot see it in its own CI, so the check degrades honestly: where the file is reachable
 * the OD is verified to exist and be closed, and where it is not, the gate SAYS the id was taken on
 * trust rather than silently skipping the check.
 */
const DECISIONS = join('..', 'smartcard-data-pipeline', 'authority', 'SMARTCARD_OWNER_DECISIONS.md');

const REQUIRED_CASES = [
  ['carries an Owner Decision id and a date, not a bare TODO', 'the deferral is dated and ruled'],
  ['marks businessDaysOld as NOT authoritative while the calendar is absent', 'the second sentence of C9'],
  ['refuses to call a weekday a publication day', 'a holiday must not read as an ordinary one'],
  ['DOES rule out a weekend, which needs no calendar', 'the control — without it, "cannot tell" would be the answer to everything'],
  ['staleness itself is unaffected — STALE is a CALENDAR-day judgement', 'calendar days need no calendar'],
];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;
const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, MODULE))) {
    return fail(MODULE + ' does not exist. C9 offers two answers and requires one of them; a third '
      + 'state — nothing declared at all — is how an empty holiday list ends up looking like a '
      + 'calendar with no holidays in it');
  }
  const source = stripComments(readFileSync(join(root, MODULE), 'utf8'));

  const state = (source.match(/state:\s*'([A-Z_]+)'/) ?? [])[1];
  const days = (source.match(/days:\s*\[([^\]]*)\]/) ?? [])[1] ?? '';
  const dayCount = (days.match(/'[^']+'/g) ?? []).length;
  const deferredBy = (source.match(/deferredBy:\s*'([^']+)'/) ?? [])[1];
  const deferredAt = (source.match(/deferredAt:\s*'([^']+)'/) ?? [])[1];
  const register = (source.match(/register:\s*'([^']+)'/) ?? [])[1];

  if (!state) {
    problems.push(MODULE + ' declares no calendar state. C9 wants a calendar or a declared absence, '
      + 'and an undeclared empty list is neither');
  }

  if (dayCount > 0) {
    // ── ANSWER ONE: a calendar is supplied ─────────────────────────────────────────
    lines.push('calendar        SUPPLIED · ' + dayCount + ' day(s)');
    if (!register) {
      problems.push('the calendar names no source. A list of dates with no authority behind it is '
        + 'rendered to users as though the Bank of Israel had said so, and a wrong holiday in it '
        + 'makes a STALE rate look FRESH — the unsafe direction');
    }
    if (!deferredAt) problems.push('the calendar carries no date, so nobody can tell how old it is');
  } else {
    // ── ANSWER TWO: the absence is declared ────────────────────────────────────────
    if (state !== 'ABSENT_DEFERRED') {
      problems.push('no calendar is supplied and the state is "' + state + '" rather than a '
        + 'declared absence');
    }
    if (!deferredBy || !/^OD-\d+$/.test(deferredBy)) {
      problems.push('the deferral carries no OD id ("' + deferredBy + '"). C9 requires one: a '
        + 'deferral without a ruling behind it is a decision an engineer took and called a policy');
    }
    if (!deferredAt || !/^\d{4}-\d{2}-\d{2}$/.test(deferredAt)) {
      problems.push('the deferral carries no ISO date ("' + deferredAt + '")');
    }
    if (!register) problems.push('the deferral points at no register entry');

    // The OD is verified to exist and be CLOSED, rather than taken on trust. OD-99 is easy to type.
    const decisions = join(root, DECISIONS);
    if (existsSync(decisions) && deferredBy) {
      const text = readFileSync(decisions, 'utf8');
      const heading = text.split('\n').find((l) => new RegExp('^#+\\s.*\\b' + escapeForRegExp(deferredBy) + '\\b').test(l) && /CLOSED/i.test(l));
      if (!heading) {
        problems.push(deferredBy + ' is not a CLOSED Owner Decision in ' + DECISIONS + '. An id '
          + 'that resolves to nothing is worse than no id: it reads as a ruling somebody made');
      } else {
        lines.push('ruled by        ' + deferredBy + ' · ' + heading.replace(/^#+\s*/, '').slice(0, 72));
        // And the decision must actually mention what it is being cited for.
        const section = text.slice(text.indexOf(heading));
        if (!/holiday/i.test(section.slice(0, 4000))) {
          problems.push(deferredBy + ' is closed but says nothing about a market-holiday calendar '
            + 'near its heading — a citation that does not cover the thing cited is a reference '
            + 'nobody checked');
        }
      }
    } else {
      lines.push('ruled by        ' + deferredBy + ' (NOT VERIFIED HERE — the Owner Decisions live in');
      lines.push('                the pipeline repository and it is not reachable from this checkout.');
      lines.push('                The id was taken on trust, and this line says so rather than the');
      lines.push('                check silently passing.)');
    }
    lines.push('calendar        ABSENT · deferred ' + deferredAt + ' · ' + register);
  }

  // ── the second sentence: no unqualified business-day claim ───────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');
  const unqualified = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === MODULE) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (!/businessDaysOld/.test(code)) continue;
    if (/businessDaysAreAuthoritative/.test(code)) continue;
    const m = /businessDaysOld/.exec(code);
    unqualified.push({ file: rel, line: lineAt(code, m.index) });
  }
  for (const u of unqualified.slice(0, 4)) {
    problems.push(u.file + ':' + u.line + ' reads businessDaysOld without consulting '
      + 'businessDaysAreAuthoritative. With no calendar that number counts a closed market as an '
      + 'open one — it is a FLOOR, not a fact, and rendering it unqualified is exactly "a holiday '
      + 'reading as an ordinary publication day"');
  }

  // ── run the suite ────────────────────────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, SUITE))) problems.push(SUITE + ' does not exist');
  else if (!existsSync(jest)) problems.push('no jest binary');
  else {
    const r = spawnSync(process.execPath, [jest, SUITE, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    for (const [name, why] of REQUIRED_CASES) {
      const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
      const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
      if (skipped) problems.push('SKIPPED: "' + name + '" (' + why + ')');
      else if (!passed) problems.push('did not pass: "' + name + '" (' + why + ')');
    }
    lines.push('suite           ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  lines.push('unqualified     ' + unqualified.length + ' site(s) reading businessDaysOld without its qualifier');
  lines.push('');
  lines.push('THE DEFERRAL FAILS TOWARD STALE, and that is why it is a deferral and not a defect. A');
  lines.push('  holiday counted as a publication day makes a rate look OLDER than it is. A calendar');
  lines.push('  assembled without authority would fail the other way — a stale rate looking fresh —');
  lines.push('  and inventing one to turn this gate green would be the worse answer.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
