#!/usr/bin/env node
/**
 * P3 CONTROLS — `npm run p3:controls -- boi`.
 *
 * Contract §2 rule 7: **a check that has never failed is not a check.** Where a criterion declares a
 * negative control, the campaign must watch it fire — not trust that a test file contains a case,
 * not remember having seen it pass once. This runner re-runs every DECLARED boi control now, by
 * name, and prints what it saw for each one so the output can be committed as evidence.
 *
 * A control here is a named test whose whole job is to watch a refusal fire. The runner requires
 * the case to have PASSED (the refusal was thrown) and prints the verbose reporter's own line as
 * the receipt.
 */
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const jest = join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');

const WHICH = process.argv[2] ?? 'boi';

/** The declared negative controls, by criterion, suite and exact test name. */
const CONTROLS = {
  boi: [
    { criterion: 'A2', suite: 'src/data/fx/__tests__/publicationCalendar.test.ts',
      name: 'Saturday and Sunday are not publication days',
      watches: 'a Sunday/Saturday publication day would flow into fetch cadence and staleness' },
    { criterion: 'A5', suite: 'src/data/fx/__tests__/lane.test.ts',
      name: 'a LIVE rate carrying fallbackOnly:true is REFUSED by the boundary’s own lane check',
      watches: 'a frozen rate dressed as live (or vice versa) reaching a renderer' },
    { criterion: 'A6', suite: 'src/data/fx/__tests__/liveFetch.test.ts',
      name: 'JPY arriving per-1 is REFUSED — the silent divide that turns 934.85 into 93,485',
      watches: 'the unit trap entering through the live lane' },
    { criterion: 'A6', suite: 'src/data/fx/__tests__/liveFetch.test.ts',
      name: 'USD arriving per-100 is REFUSED too — the refusal fires in both directions',
      watches: 'an over-applied unit' },
    { criterion: 'A6', suite: 'src/data/fx/__tests__/liveFetch.test.ts',
      name: 'one refused row refuses the whole episode — no partial accept, no silent drop',
      watches: 'a partially-bad publication shipping nine currencies and hiding the tenth' },
    { criterion: 'A7', suite: 'src/data/fx/__tests__/lane.test.ts',
      name: 'a currency outside every lane yields COMPARISON_INCOMPLETE, not zero',
      watches: 'offline-with-no-answer producing a number anyway' },
  ],
  arithmetic: [
    { criterion: 'X1/X4', suite: 'src/engines/__tests__/currency.test.ts',
      name: 'CONTROL: with the divide removed, 50,000 JPY reads 93,485.00 — a factor of exactly one hundred',
      watches: 'any caller skipping perOne — the wrong answer must stay visible, not merely unreachable' },
    { criterion: 'X3/X4', suite: 'src/engines/__tests__/currency.test.ts',
      name: 'CONTROL: a VERIFIED-provenance input still produces an ESTIMATE output — never inherited',
      watches: 'an input’s grade laundering a derived figure into a fact (ADR-013 §3)' },
  ],

  'holiday-authority': [
    { criterion: 'H2', suite: 'src/data/adapter/__tests__/holidayAuthority.test.ts',
      name: 'CONTROL: a calendar with no named source is REFUSED',
      watches: 'a web-assembled list rendered as though the Bank of Israel had said so' },
    { criterion: 'H2', suite: 'src/data/adapter/__tests__/holidayAuthority.test.ts',
      name: 'CONTROL: a calendar whose ruling carries no OD id is REFUSED',
      watches: 'an unsanctioned calendar entering under nobody\'s decision' },
    { criterion: 'H2', suite: 'src/data/adapter/__tests__/holidayAuthority.test.ts',
      name: 'CONTROL: a malformed date is REFUSED',
      watches: 'a silently misparsed day shifting staleness by a week' },
  ],
};

const set = CONTROLS[WHICH];
if (!set) {
  console.log('');
  console.log('P3-CONTROLS FAILED — unknown control family "' + WHICH + '".');
  console.log('  Declared families: ' + Object.keys(CONTROLS).join(', '));
  console.log('');
  process.exit(1);
}

const escapeForRegExp = (t) => t.replace(/[.*+?${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

console.log('');
console.log('  P3 NEGATIVE CONTROLS — ' + WHICH + ' (' + set.length + ' declared)');
console.log('');

const bySuite = new Map();
for (const c of set) {
  if (!bySuite.has(c.suite)) bySuite.set(c.suite, []);
  bySuite.get(c.suite).push(c);
}

const receipts = [];
const problems = [];
for (const [suite, controls] of bySuite) {
  const r = spawnSync(process.execPath, [jest, suite, '--verbose', '--ci'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  for (const c of controls) {
    const escaped = escapeForRegExp(c.name);
    const passed = new RegExp('[√✓]\\s*' + escaped).test(out);
    const skipped = new RegExp('(○|skipped|todo)\\s+' + escaped).test(out);
    const line = out.match(new RegExp('.{0,4}\\s*' + escaped + '\\s*\\(\\d+ ms\\)'));
    if (skipped) problems.push('SKIPPED: "' + c.name + '" (' + c.criterion + ')');
    else if (!passed) problems.push('did not fire/pass: "' + c.name + '" (' + c.criterion + ')');
    else receipts.push({ ...c, seen: line ? line[0].trim() : '(passed)' });
  }
}

for (const rc of receipts) {
  console.log('  watched  [' + rc.criterion + '] ' + rc.name);
  console.log('           saw      ' + rc.seen);
  console.log('           guards   ' + rc.watches);
  console.log('');
}

if (problems.length) {
  console.log('  ' + problems.join('\n  '));
  console.log('');
  console.log('P3-CONTROLS FAILED — ' + problems.length + ' control(s) did not demonstrate firing');
  console.log('');
  process.exit(1);
}

console.log('P3-CONTROLS OK — ' + receipts.length + ' of ' + set.length + ' declared '
  + WHICH + ' controls watched to fire');
// The contract names each family's sentinel directly (A8 BOI-CONTROLS OK, X4
// ARITHMETIC-CONTROLS OK, H2 HOLIDAY-AUTHORITY OK). Print it here, so a live verify
// finds the criterion's own positive statement in this run's output.
const FAMILY_SENTINELS = { 'holiday-authority': 'HOLIDAY-AUTHORITY OK' };
console.log(FAMILY_SENTINELS[WHICH] ?? WHICH.toUpperCase() + '-CONTROLS OK');
console.log('');
