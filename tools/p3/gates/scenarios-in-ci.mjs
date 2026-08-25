/**
 * GATE: scenarios-in-ci — criterion S4.  →  `SCENARIOS-IN-CI OK`
 *
 *   > *"The scenario battery runs in CI as its own step, not only on a laptop."*
 *
 * The battery being a Jest suite inside `npx jest --ci` is NOT enough: the campaign's
 * acceptance asset must be readable as its own line in the CI log, with its contracted
 * sentinel asserted POSITIVELY (present, or the step fails) — the same discipline the ladder
 * step follows. This gate reads the workflow from disk and refuses anything less.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['S4'];
export const SENTINEL = 'SCENARIOS-IN-CI OK';

const WORKFLOWS = '.github/workflows';

export const run = async ({ root }) => {
  const dir = join(root, WORKFLOWS);
  if (!existsSync(dir)) return fail(WORKFLOWS + ' does not exist — there is no CI');

  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8');
    if (!text.includes('p3:scenarios')) continue;

    // Its own step: an invocation of the script (`npm run p3:scenarios`)...
    const ownStep = /\brun\s+p3:scenarios\b/.test(text);
    // ...and the sentinel asserted positively in that step's captured output.
    const positiveSentinel = text.includes('grep -q "SCENARIOS OK — 23 of 23"');

    if (ownStep && positiveSentinel) {
      return ok(SENTINEL, [
        WORKFLOWS + '/' + name + ': the 23-scenario battery is its own CI step;',
        'npm run p3:scenarios captured and "SCENARIOS OK — 23 of 23" asserted present',
        '(FRESH evidence for this criterion comes from the next green CI run at closure).',
      ].join('\n'));
    }
    if (ownStep && !positiveSentinel) {
      return fail(WORKFLOWS + '/' + name + ' invokes p3:scenarios but never asserts '
        + '"SCENARIOS OK — 23 of 23" in its output - a killed process also produces silence');
    }
  }
  return fail('no workflow in ' + WORKFLOWS + ' runs p3:scenarios as its own step');
};
