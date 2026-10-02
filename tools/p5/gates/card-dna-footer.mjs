/**
 * GATE: card-dna-footer — criterion N8.  →  `CARD-DNA-FOOTER OK`
 *
 *   > **N8.** *"The footer carries 'View all benefits for this card' and 'Compare FX fees', the
 *   > section A FX row carries 'Compare across my cards' opening the P4 sheet, and the standing line
 *   > 'Always verify with your issuer' with the update date renders; a destination that is not built
 *   > is stated honestly rather than faked."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS CRITERION IS ABOUT AFFORDANCES WHOSE DESTINATIONS P5 DOES NOT OWN
 *
 * Contract §8: *"Two of those targets are not P5's: the benefits link points at the V1.x Benefits
 * Hub, and the FX actions open the sheet P4 built. The criterion requires the affordances to exist
 * and to behave honestly about a destination that is not built — it does not require the
 * destination."*
 *
 * There are exactly three ways to get this wrong, and all three look fine in a screenshot:
 *
 *   1. **Hide it.** No benefits action at all, because there is nowhere to go. The criterion asks
 *      for the affordance; a missing one is not honesty, it is silence.
 *   2. **Fake it.** A button that navigates to a Benefits Hub P5 invented, or to a route that does
 *      not exist. B2 already refuses a reachable placeholder; this refuses the reverse.
 *   3. **Deaden it.** A button that looks live and swallows the press. That is the worst of the
 *      three, because the user concludes the app is broken rather than that the feature is coming.
 *
 * So the suite must press the benefits action and prove something honest appears. A press that
 * changes nothing on screen fails, and so does one that navigates.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE FRESHNESS LINE IS THE ONE THAT CAN LIE QUIETLY
 *
 * *"Always verify with your issuer · updated [date]"* exists to tell a user how old this is. A date
 * invented to fill the slot — today's date, a build date, a hardcoded string — makes the line say
 * the opposite of what it is for, and it is the single most plausible thing to write here, because
 * the layout looks unfinished without it.
 *
 * If nothing in reach publishes an update date, the honest render is the line **without** one. So
 * this gate refuses a literal date, and refuses `new Date()` reaching the footer: today is when the
 * user opened the screen, not when anybody verified anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE FX SHEET, ONE WAY IN
 *
 * The footer's *"Compare FX fees"* and §A's *"Compare across my cards"* open the same P4 sheet. Two
 * buttons reaching it two ways is the shape `A4` exists to catch, and it is cheap to avoid now and
 * expensive to find later.
 *
 * NEGATIVE CONTROL: make the benefits action do nothing on press and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N8'];
export const SENTINEL = 'CARD-DNA-FOOTER OK';
export const MEASURES = 'render';

const FOOTER = 'src/screens/cardDna/CardDnaFooter.tsx';
const SECTION_A = 'src/screens/cardDna/SectionACosts.tsx';
const SCREEN = 'src/screens/cardDna/CardDnaScreen.tsx';
const SUITE = 'src/screens/cardDna/__tests__/cardDnaFooter.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders both footer actions and the standing verification line',
  'opens the FX sheet P4 built from the footer',
  'opens the same FX sheet from the section A FX row',
  'says the benefits destination is not built rather than doing nothing',
  'renders no fabricated update date',
];

/** The affordances N8 names, and the honest statement the unbuilt one must produce. */
const REQUIRED_TEST_IDS = [
  ['card-dna-footer-benefits', 'the "View all benefits for this card" action'],
  ['card-dna-footer-benefits-unbuilt', 'the honest statement that its destination is not built'],
  ['card-dna-footer-fx', 'the "Compare FX fees" action'],
  ['card-dna-footer-freshness', 'the standing "Always verify with your issuer" line'],
];

/** A date the footer made up. The line exists to say how old this is. */
const INVENTED_DATE = [
  [/new Date\s*\(\s*\)/, 'calls new Date() — today is when the user opened the screen, not when anybody verified anything'],
  [/['"`]\d{4}-\d{2}-\d{2}['"`]/, 'carries a literal ISO date — a date written into the component is not a freshness claim, it is a decoration that ages'],
  [/toLocaleDateString\s*\(\s*\)/, 'formats a date it did not receive'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
  return { config: { ...render, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [FOOTER, SECTION_A, SCREEN, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N8 has nothing to be about');
  }

  const footerSrc = stripComments(readFileSync(join(root, FOOTER), 'utf8'));
  const sectionSrc = stripComments(readFileSync(join(root, SECTION_A), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const problems = [];

  /* 1. THE AFFORDANCES EXIST. Hiding the benefits action is not honesty, it is silence. */
  for (const [id, what] of REQUIRED_TEST_IDS) {
    if (!footerSrc.includes(id)) {
      problems.push(FOOTER + ' has no ' + id + ' — ' + what + '. N8 asks for the affordance; not building the destination is fine, not building the affordance is not');
    }
  }

  /* 2. THE UNBUILT DESTINATION IS STATED, NOT NAVIGATED TO. */
  if (/navigate\s*\(\s*['"`]Benefits/i.test(footerSrc)) {
    problems.push(FOOTER + ' navigates to a Benefits route. The V1.x Benefits Hub does not exist — §17 defers it, and amendment A-4 already re-owned its placeholder away from P5');
  }

  /* 3. THE FRESHNESS LINE DOES NOT INVENT A DATE. */
  for (const [re, why] of INVENTED_DATE) {
    if (re.test(footerSrc)) {
      problems.push(FOOTER + ' ' + why + '. If nothing in reach publishes an update date, the honest render is the line without one');
    }
  }

  /* 4. ONE FX SHEET, ONE WAY IN. */
  if (!/card-dna-cost-fx-commission-compare/.test(sectionSrc)) {
    problems.push(SECTION_A + ' has no card-dna-cost-fx-commission-compare — N8 requires §A\'s FX row to carry "Compare across my cards"');
  }

  /* 5. THE FOOTER IS REACHED. */
  if (!/CardDnaFooter/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render CardDnaFooter — the footer exists and nothing reaches it');
  }

  /* 6. NO ENGINE, AND NO COMPUTATION. B1 still holds on a footer. */
  if (/from\s+'[^']*\/engines\//.test(footerSrc)) {
    problems.push(FOOTER + ' imports an engine directly (B1)');
  }

  if (problems.length) return fail(problems.join(' · '));

  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);
  const { problems: caseProblems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (caseProblems.length) return fail(caseProblems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    'CRITERION N8 — the Card DNA footer, and §A\'s FX action.',
    'Both actions exist, and one of them has nowhere to go. "View all benefits for this card" points',
    '  at the V1.x Benefits Hub, which §17 defers and amendment A-4 already re-owned away from P5 —',
    '  so pressing it SAYS SO. It is not hidden, not faked, and not deadened: the suite presses it and',
    '  proves something honest appears, which a swallowed press cannot do.',
    'The FX actions open the sheet P4 built, and the footer and §A reach it the same way — two buttons',
    '  opening one sheet two ways is the shape A4 exists to catch.',
    'And the freshness line does not invent a date. No new Date(), no literal ISO string: today is',
    '  when the user opened the screen, not when anybody verified anything, and a line whose whole',
    '  purpose is honesty about age is the worst possible place to write a plausible number.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
