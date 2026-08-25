/**
 * GATE: no-rederivation — criterion G10.  →  `NO-REDERIVATION OK`
 *
 *   > *"None of the eight interfaces in P2 handoff §3 is re-derived anywhere in the
 *   > application, engines included."*  (P2 criterion D4, carried.)
 *
 * Delegates to P2's own gate (tools/p2/gates/no-rederivation.mjs), whose eight interface
 * checks ship with watched negative controls (rederivation-controls.mjs: "8 of 8 checks
 * watched to fire, tree restored"). The engines are inside src/** and were always in that
 * gate's population; P3 landing five new modules re-runs the same promise over a bigger tree.
 */
import * as inner from '../../p2/gates/no-rederivation.mjs';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['G10'];
export const SENTINEL = 'NO-REDERIVATION OK';

export const run = async ({ root }) => {
  const result = await inner.run({ root });
  if (!result.ok) {
    return fail('P2 no-rederivation gate refused the current tree: '
      + String(result.message ?? result.sentinel ?? '(no message)')
      + (result.detail ? '\n' + String(result.detail) : ''));
  }
  if (!String(result.sentinel ?? '').startsWith(SENTINEL)) {
    return fail('inner gate printed "' + String(result.sentinel) + '" which does not carry '
      + 'the contracted sentinel "' + SENTINEL + '"');
  }
  return ok(String(result.sentinel), [
    'delegated to tools/p2/gates/no-rederivation.mjs (D4 machinery, 8 interfaces,',
    'negative controls proven separately); the engine modules are in its population.',
    result.detail ?? null,
  ].filter(Boolean).join('\n'));
};
