/**
 * GATE: home-billing-and-cta — criterion H5.  →  `HOME-BILLING-AND-CTA OK`
 *
 *   > **H5.** *"Upcoming billing shows the nearest card billing event labelled Estimate when derived
 *   > and taps through to Plan, and the Check CTA is always present above the fold in addition to
 *   > the centre nav action."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "IN ADDITION TO THE CENTRE NAV ACTION" IS THE CLAUSE THAT WILL BE ARGUED AWAY
 *
 * The nav bar already has a Check action in the middle. So a reasonable person looking at Home with
 * a CTA on it sees a duplicate and removes one — and the criterion says, in advance, that the
 * duplication is deliberate. **Two entry points to the same action is not redundancy here**; the nav
 * action is how someone who already knows what Check is gets to it, and the above-the-fold CTA is
 * how someone who does not finds out it exists.
 *
 * A gate cannot stop a future redesign, but it can make the removal deliberate rather than tidy. So
 * it checks for the CTA on Home specifically and says why it is there.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "LABELLED ESTIMATE WHEN DERIVED" — K3's RULE, AND ITS SECOND HALF AGAIN
 *
 * A billing date the app worked out from a cycle is derived and wears the chip. One the issuer or
 * the user stated does not. `K3` already required both directions on the day sheet; the failure mode
 * is the same here and so is the remedy — label everything Estimate and the label stops meaning
 * anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "THE NEAREST" IS A SELECTION, NOT A COMPUTATION
 *
 * Picking the soonest of a set of dates is ordering, which a surface may do. Working out WHEN a card
 * bills is not, and it is not this criterion's to invent: the billing cycle already carries it.
 *
 * NEGATIVE CONTROL: remove the Home CTA and rely on the nav action, and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['H5'];
export const SENTINEL = 'HOME-BILLING-AND-CTA OK';
export const MEASURES = 'render';

const BILLING = 'src/screens/home/HomeUpcomingBilling.tsx';
const SCREEN = 'src/screens/HomeScreen.tsx';
const SUITE = 'src/screens/home/__tests__/homeBillingAndCta.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders the nearest card billing event',
  'labels a derived billing date Estimate',
  'does not label a stated billing date Estimate',
  'taps through to Plan',
  'renders the Check CTA above the fold',
  'renders no billing block when no card has a billing date',
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
  for (const rel of [BILLING, SCREEN, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — H5 has nothing to be about');
  }

  const billingSrc = stripComments(readFileSync(join(root, BILLING), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const problems = [];

  /* 1. THE CTA IS ON HOME, IN ADDITION TO THE NAV ACTION. */
  if (!/home-check-cta/.test(screenSrc)) {
    problems.push(
      SCREEN + ' has no home-check-cta. The nav bar already has a Check action, so a reader seeing both may take this '
        + 'for a duplicate — H5 says the duplication is deliberate: the nav action is how someone who already knows '
        + 'what Check is gets to it, and this one is how someone who does not finds out it exists',
    );
  }

  /* 2. BOTH HALVES OF THE ESTIMATE LABEL, as K3 required on the day sheet. */
  if (!/derived/.test(billingSrc)) {
    problems.push(BILLING + ' carries no derived flag — "labelled Estimate WHEN DERIVED" needs it to know which dates were worked out');
  }
  if (!/ESTIMATE/.test(billingSrc)) {
    problems.push(BILLING + ' never renders an Estimate chip');
  }
  if (/<ProvenanceChip[^>]*view=\{\{\s*chip:\s*'ESTIMATE'/.test(billingSrc) && !/derived/.test(billingSrc)) {
    problems.push(BILLING + ' renders the Estimate chip unconditionally — label everything Estimate and the label stops meaning anything (K3 holds the same line)');
  }

  /* 3. NEAREST IS A SELECTION; THE DATE ITSELF IS NOT INVENTED. */
  if (!/billingCycle|billingDay/i.test(billingSrc)) {
    problems.push(BILLING + ' never reads a card billing cycle — when a card bills is data, not something this criterion invents');
  }

  /* 4. IT TAPS THROUGH TO PLAN. */
  if (!/navigate/.test(billingSrc)) {
    problems.push(BILLING + ' never navigates — H5 says it taps through to Plan');
  }

  /* 5. ABSENT IS ABSENT. */
  if (!/return null|-absent/.test(billingSrc)) {
    problems.push(BILLING + ' has no absent path — a wallet whose cards carry no billing date gets no billing block, not an invented one');
  }

  /* 6. THE SEAM, AND NO ENGINE. */
  if (/from\s+'[^']*\/engines\//.test(billingSrc)) {
    problems.push(BILLING + ' imports an engine directly (B1)');
  }

  /* 7. HOME SHOWS IT. */
  if (!/HomeUpcomingBilling/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render HomeUpcomingBilling');
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
    'CRITERION H5 — upcoming billing, and the Check CTA.',
    'The CTA is on Home IN ADDITION to the centre nav action, and that is deliberate rather than',
    '  redundant: the nav action is how someone who already knows what Check is reaches it, and this',
    '  one is how someone who does not finds out it exists. A future reader seeing both will be',
    '  tempted to tidy one away; this gate makes that removal deliberate rather than incidental.',
    'A derived billing date wears the Estimate chip and a stated one does not — K3\'s rule, and its',
    '  second half again, because labelling everything Estimate costs the label its meaning.',
    '"The nearest" is a selection over dates the data already carries, not a computation of when a',
    '  card bills.',
    'And a wallet whose cards carry no billing date gets no billing block at all.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
