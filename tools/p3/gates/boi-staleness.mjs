/**
 * GATE: boi-staleness — criterion A3.  →  `BOI-STALENESS OK`
 *
 *   > *"Carry-forward across weekends is implemented and staleness is computed from the calendar,
 *   > never guessed."*
 *
 * Staleness itself is the adapter's (`stalenessOf`, STALE after 7 CALENDAR days, business-day
 * aware). This gate requires the app to CONSUME that rather than re-derive it, and requires the
 * carry-forward behaviour — a weekend probe landing on Friday, labelled Friday — to have been
 * watched passing by name.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A3'];
export const SENTINEL = 'BOI-STALENESS OK';

const MODULE = 'src/data/fx/publicationCalendar.ts';
const SUITE = 'src/data/fx/__tests__/publicationCalendar.test.ts';

const REQUIRED_CASES = [
  'a Saturday probe also lands on Friday',
  'a publication day resolves to itself',
  'a malformed date answers undefined rather than inventing a day',
];

export const run = async ({ root }) => {
  const p = join(root, MODULE);
  if (!existsSync(p)) return fail(MODULE + ' does not exist');

  // The app consumes the adapter's staleness; it does not keep its own day-counting.
  const stalenessConsumer = 'src/data/adapter/fxStaleness.ts';
  const consumerSrc = existsSync(join(root, stalenessConsumer))
    ? readFileSync(join(root, stalenessConsumer), 'utf8')
    : '';
  if (!consumerSrc.includes('stalenessOf')) {
    return fail(stalenessConsumer + ' does not consume the adapter\'s stalenessOf. A second '
      + 'staleness implementation is two homes for the rule "STALE after 7 calendar days"');
  }
  // ...and the fx lane modules do not smuggle one in either.
  for (const f of [
    'src/data/fx/publicationCalendar.ts',
    'src/data/fx/liveFetch.ts',
    'src/data/fx/lane.ts',
    'src/data/fx/rateCache.ts',
  ]) {
    const abs = join(root, f);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');
    if (/function\s+stalenessOf|calendarDaysOld\s*=/.test(src)) {
      return fail(f + ' appears to implement staleness arithmetic locally. One home: the '
        + 'adapter\'s stalenessOf');
    }
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    'carry-forward walks back over weekends to the real publication day (suite, watched)',
    stalenessConsumer + ' consumes the adapter\'s stalenessOf; no local re-derivation in src/data/fx/**',
    summary,
  ].join('\n'));
};
