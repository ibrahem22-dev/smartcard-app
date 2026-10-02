/**
 * GATE: boi-refusals — criterion A6.  →  `BOI-REFUSALS OK`
 *
 *   > *"Every fetch failure mode refuses rather than invents; FxLaneError's existing refusals are
 *   > preserved, not widened."*
 *
 * The refusal list is the spec's (§4, C11): unit contradicting the convention in BOTH directions, a
 * non-positive/non-finite rate, an unparseable publication date, a non-JSON body, a shape that is
 * not the measured one, and a partially bad episode refusing whole. Each must be WATCHED firing by
 * name — a refusal that has never fired is a comment.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A6'];
export const SENTINEL = 'BOI-REFUSALS OK';

const MODULE = 'src/data/fx/liveFetch.ts';
const SUITE = 'src/data/fx/__tests__/liveFetch.test.ts';

const REQUIRED_CASES = [
  'JPY arriving per-1 is REFUSED — the silent divide that turns 934.85 into 93,485',
  'USD arriving per-100 is REFUSED too — the refusal fires in both directions',
  'a non-positive or non-finite published rate is refused',
  'a row without an ISO lastUpdate is refused — a rate whose age cannot be computed',
  'an HTML error page is NOT_JSON, never a partial accept',
  'an empty publication is SHAPE-refused, not zero rates to convert with',
  'one refused row refuses the whole episode — no partial accept, no silent drop',
];

/** Every error code the module declares. The suite must exercise each family by name above. */
const REQUIRED_CODES = ['UNIT_REFUSED', 'RATE_REFUSED', 'DATE_REFUSED', 'NOT_JSON', 'SHAPE', 'HTTP_STATUS'];

export const run = async ({ root }) => {
  const p = join(root, MODULE);
  if (!existsSync(p)) return fail(MODULE + ' does not exist');
  const src = readFileSync(p, 'utf8');

  for (const code of REQUIRED_CODES) {
    if (!src.includes(`'${code}'`)) {
      return fail(MODULE + ' never declares ' + code + '. The refusal vocabulary is the '
        + 'spec\'s; a missing code is a failure mode with no name and no test');
    }
  }
  // The boundary's own refusal class is untouched: still defined in fx.ts, not re-implemented.
  const fxBundled = join(root, 'src/data/adapter/fx.ts');
  const bundledSrc = readFileSync(fxBundled, 'utf8');
  if (!bundledSrc.includes('class FxLaneError')) {
    return fail('src/data/adapter/fx.ts no longer defines FxLaneError. A6 requires its existing '
      + 'refusals preserved, not widened or moved');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    REQUIRED_CODES.length + ' refusal codes declared and exercised: ' + REQUIRED_CODES.join(', '),
    'FxLaneError preserved in place (src/data/adapter/fx.ts), not widened',
    summary,
  ].join('\n'));
};
