/**
 * GATE: boi-lane — criterion A4.  →  `BOI-LANE OK`
 *
 *   > *"The rate lane is cache, then bundled snapshot, and the bundled snapshot is used only until
 *   > the first successful fetch."*
 *
 * The lane is the boundary's own chain order (USER → LIVE → CACHED → BUNDLED), fed by this app's
 * live fetch and its cache port. This gate requires the modules to exist, the transport policy to
 * be what PD-P3-002 recorded (two attempts, no more), and the lane behaviour — cold start lands on
 * BUNDLED, one success moves it to LIVE/CACHED for ever after — to have been watched by name.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A4'];
export const SENTINEL = 'BOI-LANE OK';

const MODULES = [
  'src/data/fx/liveFetch.ts',
  'src/data/fx/rateCache.ts',
  'src/data/fx/lane.ts',
];
const SUITES = [
  'src/data/fx/__tests__/liveFetch.test.ts',
  'src/data/fx/__tests__/lane.test.ts',
];

const REQUIRED_CASES = {
  'src/data/fx/__tests__/liveFetch.test.ts': [
    'fetches and validates an episode end to end over an injected transport',
    'retries a 5xx once and refuses after the second failure with HTTP_STATUS',
    'does NOT retry a 4xx — asking again will not help',
  ],
  'src/data/fx/__tests__/lane.test.ts': [
    'a device with no live and no cached rate lands on BUNDLED — the cold start',
    'a successful fetch outranks the bundle — LIVE wins at once',
    'a PREVIOUS session’s cached success also outranks the bundle',
    'bundled participates only until the first success: cache beats bundle even stale-ish',
    'a USER rate outranks everything, including this session’s live fetch (OD-23b)',
    'the memory cache round-trips an episode: write on success, read on the next session',
  ],
};

export const run = async ({ root }) => {
  for (const m of MODULES) {
    if (!existsSync(join(root, m))) {
      return fail(m + ' does not exist. The lane is client + cache + assembly; a missing piece '
        + 'is a missing obligation (handoff P3-1)');
    }
  }

  // The wire contract is the MEASURED one (spec §4): the endpoint string appears verbatim.
  const client = readFileSync(join(root, MODULES[0]), 'utf8');
  if (!client.includes('boi.org.il/PublicApi/GetExchangeRates?asXml=false')) {
    return fail(MODULES[0] + ' does not carry the shipped attribution\'s endpoint verbatim '
      + '(spec §C12)');
  }
  if (!client.includes('conventionalQuoteUnit')) {
    return fail(MODULES[0] + ' does not validate units against the adapter\'s exported '
      + 'convention table — the ONE home of the quotation convention (PD-P3-004)');
  }

  const problems = [];
  const summaries = [];
  for (const [suite, cases] of Object.entries(REQUIRED_CASES)) {
    const r = requireJestCases(root, suite, cases);
    problems.push(...r.problems.map((x) => suite + ': ' + x));
    if (r.summary) summaries.push(suite.split('/').pop() + ' — ' + r.summary);
  }
  if (problems.length) return fail(problems.join(' · '), summaries.join('\n'));

  return ok(SENTINEL, [
    'modules: ' + MODULES.join(' · '),
    'chain order is the boundary\'s own slice.resolve — no local re-derivation',
    ...summaries,
  ].join('\n'));
};
