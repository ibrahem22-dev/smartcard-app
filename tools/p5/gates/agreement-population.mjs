/**
 * GATE: agreement-population — criterion A6.  →  `AGREEMENT-POPULATION OK`
 *
 *   > **A6.** *"The population the agreement properties run over is derived from the navigation
 *   > declaration and the shipped packs, never hand-listed, and a check over zero surfaces fails."*
 *
 * MEASURES: 'source'. Two halves, and neither is sufficient alone.
 *
 *   1. **It reads the generator.** A6 is a claim about where the population COMES FROM, and no
 *      runtime assertion can tell a derived list from a hand-written one that happens to have the
 *      same five entries today. So the source must import the navigation declaration and the
 *      catalog door, and must not carry a literal array of surface names.
 *   2. **It runs the generator's suite, by named case.** A source scan cannot tell whether the
 *      derivation actually yields anything, whether it lands exactly on the thresholds, or whether
 *      it would be empty. Requiring the cases BY NAME means deleting the assertion that carries a
 *      clause of the criterion fails this gate — *"the suite passed" is satisfied by a suite whose
 *      only remaining case is `it('exists')`*.
 *
 * AND ONE CROSS-CHECK THE CRITERION IMPLIES RATHER THAN STATES. Four surfaces come from `ia.ts`.
 * The fifth cannot: **Card DNA is contextual, route `CardDetail` in `WalletStack`**, which is what
 * assumption A21 established. So the generator declares that one entry — and this gate reads
 * `WalletStack.tsx` and refuses if the route is not there. One entry with something comparing it to
 * the declaration that owns it is not a hand-written list; one entry with nothing comparing it is
 * exactly what A6 forbids, and the difference is this check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['A6'];
export const SENTINEL = 'AGREEMENT-POPULATION OK';
export const MEASURES = 'source';

const GENERATOR = 'src/surfaces/population.ts';
const SUITE = 'src/surfaces/__tests__/population.test.ts';
const IA = 'src/navigation/ia.ts';
const WALLET_STACK = 'src/navigation/stacks/WalletStack.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const UNIT_PROJECT = 'unit';

const REQUIRED_CASES = [
  'is not empty — a check over zero surfaces fails, and so does this',
  'names all five P5 surfaces exactly once',
  'takes four of them from the navigation declaration, by its own keys',
  'takes the fifth from a route, and says so, because a tab list cannot yield it',
  'does not treat the Wallet Benefits segment as a P5 surface',
  'takes its card ids from the shipped catalog pack, not from this file',
  'carries the boundary contexts two implementations of one rule diverge on',
  'lands exactly on the thresholds rather than near them',
  'fixes its window rather than reading a clock, so a property cannot pass only today',
];

const unitConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const unit = projects.find((p) => p && p.displayName === UNIT_PROJECT);
  if (!unit) return { error: JEST_CONFIG + ' has no "' + UNIT_PROJECT + '" project' };
  return { config: { ...unit, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [GENERATOR, SUITE, IA, WALLET_STACK]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — A6 has nothing to be about');
  }

  const src = readFileSync(join(root, GENERATOR), 'utf8');
  const problems = [];

  if (!/from\s+'\.\.\/navigation\/ia'/.test(src) || !/\bBOTTOM_NAVIGATION\b/.test(src)) {
    problems.push(GENERATOR + ' does not read BOTTOM_NAVIGATION from ' + IA + ' — the surface set would then be this file\'s opinion');
  }
  if (!/currentCatalogProducts/.test(src) || !/adapter\/catalogSearch/.test(src)) {
    problems.push(GENERATOR + ' does not read the shipped catalog pack through src/data/adapter/catalogSearch.ts — A6 names the packs, and B4 forbids re-deriving that door');
  }
  /* A literal array of surface names is the shape A6 forbids. The generator's own declared ids in
     the TYPE are fine — a union type is a vocabulary, not a population. */
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const literalSurfaceArray = /=\s*\[[^\]]*['"](home|wallet-cards|plan-calendar|plan-commitments)['"][^\]]*\]/.test(stripped);
  if (literalSurfaceArray) {
    problems.push(GENERATOR + ' assigns an array literal containing surface ids — that is a hand-written population, which is what A6 forbids (contract §2 rule 4)');
  }

  /* THE CROSS-CHECK FOR THE ONE ENTRY THAT CANNOT BE DERIVED. */
  const route = (src.match(/CARD_DNA_ROUTE\s*=\s*'([^']+)'/) ?? [])[1];
  if (!route) {
    problems.push(GENERATOR + ' does not name the contextual Card DNA route, so nothing can be cross-checked against the navigator');
  } else {
    const stack = readFileSync(join(root, WALLET_STACK), 'utf8');
    if (!new RegExp('name=\\{?["\']' + route + '["\']').test(stack) && !new RegExp('name="' + route + '"').test(stack)) {
      problems.push(WALLET_STACK + ' registers no route named "' + route + '" — the one surface the tab declaration cannot yield is not in the navigator either, so the population is asserting a screen that is not reachable');
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  const { config, error } = unitConfigFor(root);
  if (error) return fail(error);
  const { problems: caseProblems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (caseProblems.length) return fail(caseProblems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    GENERATOR + ' derives the population:',
    '  · four surfaces from BOTTOM_NAVIGATION in ' + IA,
    '  · one contextual surface, route "' + route + '", cross-checked against ' + WALLET_STACK,
    '  · card ids from the shipped catalog pack through src/data/adapter/catalogSearch.ts',
    '  · no array literal of surface ids anywhere in the generator',
    'and ' + SUITE + ' proves it is non-empty, lands exactly on the thresholds, and fixes its window:',
    '  ' + REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
