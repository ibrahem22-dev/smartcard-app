/**
 * GATE: boi-provenance — criterion A5.  →  `BOI-PROVENANCE OK`
 *
 *   > *"Provenance flips from BUNDLED to LIVE with the source, and a live rate and a frozen one
 *   > are never presented identically."*
 *
 * The handoff's reason for P3-1: *"a consumer that never looked would present a live rate and a
 * frozen one identically."* The boundary refuses a bundled read whose source is not BUNDLED
 * (FxLaneError); the produced LIVE rates are ESTIMATE, carry no fallbackOnly flag, and the resolved
 * `resolution` names the lane that won. This gate requires all of it to have been WATCHED.
 *
 * NEGATIVE CONTROL (declared in the contract for A5): return a LIVE rate carrying fallbackOnly:true
 * and watch the refusal fire — required by name in the suite below.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A5'];
export const SENTINEL = 'BOI-PROVENANCE OK';

const SUITE = 'src/data/fx/__tests__/lane.test.ts';

const REQUIRED_CASES = [
  'the resolved resolution names the lane: LIVE for today’s fetch, BUNDLED for the cold start',
  'a LIVE rate carrying fallbackOnly:true is REFUSED by the boundary’s own lane check',
  'every produced LIVE rate is ESTIMATE — a reference rate is never inherited into certainty',
];

export const run = async ({ root }) => {
  if (!existsSync(join(root, SUITE))) return fail(SUITE + ' does not exist');

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) {
    return fail(problems.join(' · ') + '. A5\'s negative control is the impostor case: a LIVE '
      + 'rate wearing fallbackOnly:true must be refused, and a control that has never fired is '
      + 'not a control', summary ?? undefined);
  }

  return ok(SENTINEL, [
    'provenance follows source: LIVE / CACHED / BUNDLED named in resolution, never presented identically',
    'negative control watched: LIVE rate carrying fallbackOnly:true refused via FxLaneError',
    summary,
  ].join('\n'));
};
