/**
 * GATE: no-rederivation — criterion B4.  →  `NO-REDERIVATION OK`
 *
 *   > *"None of the eight interfaces in P2 handoff §3 is re-derived anywhere in the
 *   > application, surfaces included."*
 *
 * Delegates to P2's gate (tools/p2/gates/no-rederivation.mjs), the same machinery P3 G10
 * used. Surfaces sit inside src/** and are in that population.
 */
import * as inner from '../../p2/gates/no-rederivation.mjs';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['B4'];
export const SENTINEL = 'NO-REDERIVATION OK';
export const MEASURES = 'source';

export const run = async ({ root }) => {
  const result = await inner.run({ root });
  if (!result.ok) {
    return fail('P2 no-rederivation gate refused the current tree: '
      + String(result.message ?? result.sentinel ?? '(no message)')
      + (result.detail ? '\n' + String(result.detail) : ''));
  }
  if (!String(result.sentinel ?? '').includes(SENTINEL)) {
    return fail('inner gate printed "' + String(result.sentinel) + '" which does not carry '
      + 'the contracted sentinel "' + SENTINEL + '"');
  }
  return ok(SENTINEL, [
    'delegated to tools/p2/gates/no-rederivation.mjs (D4 machinery, 8 interfaces,',
    'negative controls proven separately); P4 surfaces are in its population.',
    result.detail ?? null,
  ].filter(Boolean).join('\n'));
};
