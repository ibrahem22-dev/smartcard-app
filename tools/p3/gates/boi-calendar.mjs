/**
 * GATE: boi-calendar — criterion A2.  →  `BOI-CALENDAR OK`
 *
 *   > *"The publication calendar is MON-FRI with Fridays published and no Saturday or Sunday,
 *   > derived from the spec and not from the Israeli banking week."*
 *
 * The trap is on the record in reports/campaign/BOI_STATE.md §4: the banking-week answer is wrong
 * on BOTH days in opposite directions. This gate requires the module to STATE the week, to reuse
 * the adapter's own isBusinessDay rather than a second implementation, and to have been watched
 * getting Friday right and Saturday/Sunday wrong-side-up — by name, in the suite.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A2'];
export const SENTINEL = 'BOI-CALENDAR OK';

const MODULE = 'src/data/fx/publicationCalendar.ts';
const SUITE = 'src/data/fx/__tests__/publicationCalendar.test.ts';

const REQUIRED_CASES = [
  'Friday IS a publication day — the banking-week assumption would have called it a weekend',
  'Saturday and Sunday are not publication days',
  'a Sunday probe walks back to Friday, never hunting a rate that was never published',
  'the calendar honours a supplied holiday list',
];

export const run = async ({ root }) => {
  const p = join(root, MODULE);
  if (!existsSync(p)) {
    return fail(MODULE + ' does not exist. A2 is about the calendar the fetch cadence and '
      + 'staleness answers depend on, and a missing module cannot carry it');
  }
  const src = readFileSync(p, 'utf8');

  // The week is STATED, not implied by whatever isBusinessDay happens to do today.
  for (const [field, want] of [
    ['fridayIsPublicationDay', true],
    ['saturdayIsPublicationDay', false],
    ['sundayIsPublicationDay', false],
  ]) {
    const m = src.match(new RegExp(field + String.raw`\s*:\s*(true|false)`));
    if (!m) return fail(MODULE + ' never states ' + field);
    if (String(want) !== m[1]) {
      return fail(MODULE + ' states ' + field + ': ' + m[1] + '. The measured publication week is '
        + 'MON-FRI with FRIDAY published (BOI_STATE §4) — the banking week is the trap');
    }
  }

  // One home per fact: the judgement comes from the adapter, not from a second table of weekdays.
  if (!src.includes('isBusinessDay')) {
    return fail(MODULE + ' does not reuse the adapter\'s isBusinessDay — a second weekday table '
      + 'is two homes for one fact, and they will disagree silently');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ' states MON-FRI with Friday published, over the adapter\'s own isBusinessDay',
    summary,
    'negative control (banking-week trap): watched in the suite — Sunday/Saturday refuse, Friday publishes',
  ].join('\n'));
};
