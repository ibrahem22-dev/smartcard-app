/**
 * GATE: card-dna-active-now — criterion N7.  →  `CARD-DNA-ACTIVE-NOW OK`
 *
 *   > **N7.** *"Section D renders the fee-waiver countdown, seasonal offers, credit-limit
 *   > utilization against the safe-zone threshold, and active installments on this card with
 *   > 'Paid early'."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PHRASE THAT INVITES THE DEFECT: "UTILIZATION AGAINST THE SAFE-ZONE THRESHOLD"
 *
 * It sounds like a percentage, and a percentage is two engine fields and a division away. `load.ts`
 * gives `creditLimitIls` and `availableBeforeChangesIls` on every `CardLimitPosition`; the ratio is
 * one line, it would look obviously right, and it would be **a second opinion about the user's
 * money computed on a screen**.
 *
 * There is no credit-limit utilization ratio in the engine. `LoadSnapshot.ratioOfIncome` exists and
 * is a **different fact** — a ratio of income, not of limit — and reaching for it because it is the
 * nearest available number would be worse than computing one.
 *
 * So B1 and §2 rule 11 decide it: a rendered figure traces to an engine result **field**. §D renders
 * the limit position's fields, each labelled for what it is, plus the engine's own band and the
 * threshold figures. A gate cannot see a division that a component did not write, so what this
 * checks is that the component wrote none.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PAID EARLY" IS ONE ACT, AND IT IS ALREADY DESIGNED
 *
 * Contract §8: *"WP-3.5's 'Paid early' is the same act Plan Commitments performs. One
 * implementation, calling the load engine's early-payoff recalculation. Two 'Paid early' buttons
 * that free a hold two ways is exactly what criterion `A4` exists to catch — and it will catch it
 * in PHASE-4, not here."*
 *
 * The mechanism exists: put the commitment id in `SurfaceContext.paidEarlyCommitmentIds`, and the
 * engine returns `releasedByEarlyPayoffIls` and an `afterEarlyPayoff` snapshot. So the surface never
 * computes what was freed — it renders the field. A local release calculation here would be the
 * second implementation A4 is waiting for, shipped a phase early and passing every test in sight.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE READER, IN TWO PROPERTIES AT ONCE
 *
 * `card-dna-utilization` is declared `builtIn: 'PHASE-3'` in **both** `one-load` and `one-limit`.
 * A `readCardDnaUtilizationRatio` still returning `NOT_BUILT` once §D renders makes that declaration
 * false twice over.
 *
 * NEGATIVE CONTROL: compute the freed amount on the surface instead of reading the engine's field,
 * and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N7'];
export const SENTINEL = 'CARD-DNA-ACTIVE-NOW OK';
export const MEASURES = 'render';

const ROWS = 'src/screens/cardDna/activeNowRows.ts';
const SECTION = 'src/screens/cardDna/SectionDActiveNow.tsx';
const SCREEN = 'src/screens/cardDna/CardDnaScreen.tsx';
const SUITE = 'src/screens/cardDna/__tests__/cardDnaActiveNow.render.test.tsx';
const READERS = 'src/surfaces/__tests__/agreementReaders.tsx';
const LOAD = 'src/engines/load.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders the card limit position from the engine fields',
  'renders the safe-zone threshold the engine reported',
  'renders active installments on this card and no others',
  'frees a hold through the engine when a commitment is marked paid early',
  'renders the freed amount the engine reported rather than one it computed',
  'renders no fee waiver countdown when the card has no waiver',
  'renders no seasonal offer when none is evidenced',
];

/** Arithmetic that turns two engine fields into a third number nobody computed. */
const DERIVES = [
  [/availableBeforeChangesIls[^;\n]*\/[^;\n]*creditLimitIls/, 'divides available by the credit limit — that is a utilization ratio the engine does not report'],
  [/creditLimitIls[^;\n]*-[^;\n]*(activeInstallmentHolds|loggedThisCycle)/, 'subtracts holds from the limit — the engine already publishes availableBeforeChangesIls'],
  [/1\s*-\s*[A-Za-z0-9_.]*available/i, 'computes one-minus-available — a utilization percentage by another spelling'],
  [/\*\s*100\b[^;\n]*(available|creditLimit|utilis|utiliz)/i, 'scales a limit figure to a percentage'],
  [/releasedByEarlyPayoffIls\s*[-+]/, 'does arithmetic on the freed figure — the engine reports what early payoff frees; the surface renders it'],
];

/*
 * ENGINE FIGURES ARE ProvenancedNumber, SO ARITHMETIC WEARS A `.value` FIRST.
 *
 * The first version of this rule was /releasedByEarlyPayoffIls\s*[-+]/, and it was watched NOT
 * firing against `releasedByEarlyPayoffIls.value + 0` — because every figure the load engine
 * publishes is a ProvenancedNumber, and the only way to do arithmetic on one is to unwrap it.
 * The rule was looking for the shape arithmetic CANNOT take here.
 *
 * It now matches the field with an optional `.value` on either side of an operator. Formatting
 * (`money(x.value)`) stays legal, because a call is not an operator; deriving a third number from
 * two engine fields does not.
 */
const FIELD_ARITHMETIC = [
  [new RegExp("(creditLimitIls|activeInstallmentHoldsIls|loggedThisCyclePurchasesIls|availableBeforeChangesIls|availableAfterChangesIls|releasedByEarlyPayoffIls|prospectiveHoldIls|monthlyObligationsIls|ratioOfIncome)(\\.value)?\\s*[-+*/]\\s*(?![/*])"), "does arithmetic on an engine figure"],
  [new RegExp("[-+*/]\\s*[A-Za-z0-9_.]*(creditLimitIls|activeInstallmentHoldsIls|loggedThisCyclePurchasesIls|availableBeforeChangesIls|availableAfterChangesIls|releasedByEarlyPayoffIls|prospectiveHoldIls|monthlyObligationsIls|ratioOfIncome)"), "feeds an engine figure into arithmetic"],
];
/** A second early-payoff implementation, which is precisely what A4 is waiting to catch. */
const LOCAL_PAYOFF = /\b(computeReleased|calculateFreed|freedAmountFor|releaseFor)\s*\(/;

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
  for (const rel of [ROWS, SECTION, SCREEN, SUITE, READERS, LOAD]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N7 has nothing to be about');
  }

  const rowsSrc = stripComments(readFileSync(join(root, ROWS), 'utf8'));
  const sectionSrc = stripComments(readFileSync(join(root, SECTION), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const readersSrc = stripComments(readFileSync(join(root, READERS), 'utf8'));
  const problems = [];

  /* 1. NO SECOND OPINION ABOUT THE USER'S MONEY. */
  for (const f of [{ n: ROWS, s: rowsSrc }, { n: SECTION, s: sectionSrc }]) {
    for (const [re, why] of DERIVES) {
      if (re.test(f.s)) {
        problems.push(f.n + ' ' + why + '. §2 rule 11: a rendered figure traces to the engine result FIELD');
      }
    }
    for (const [re, why] of FIELD_ARITHMETIC) {
      const hit = f.s.match(re);
      if (hit) {
        problems.push(
          f.n + ' ' + why + ' (' + hit[0].trim().slice(0, 48) + '). Every figure the engine publishes is a '
            + 'ProvenancedNumber, so deriving a new number means unwrapping one first — which is what this catches. '
            + 'Formatting is fine; a second opinion about the user\'s money is not',
        );
      }
    }
    if (LOCAL_PAYOFF.test(f.s)) {
      problems.push(
        f.n + ' implements its own early-payoff release. Contract §8: this is the same act Plan Commitments '
          + 'performs, and two Paid-early buttons freeing a hold two ways is exactly what A4 exists to catch',
      );
    }
  }

  /* `ratioOfIncome` is a ratio of INCOME. Rendering it as credit-limit utilization would be the
     nearest available number standing in for the one that does not exist. */
  if (/ratioOfIncome/.test(sectionSrc) && /utilis|utiliz/i.test(sectionSrc)) {
    problems.push(
      SECTION + ' renders ratioOfIncome as utilization. That is a ratio of INCOME and a different fact from '
        + 'credit-limit utilization — the engine reports no utilization ratio, and the nearest available number '
        + 'is not the number',
    );
  }

  /* 2. PAID EARLY GOES THROUGH THE CONTEXT AND THE ENGINE. */
  if (!/paidEarlyCommitmentIds/.test(sectionSrc) && !/paidEarlyCommitmentIds/.test(rowsSrc)) {
    problems.push('section D never touches paidEarlyCommitmentIds — that is how a commitment is marked paid early, and the engine is what recomputes the release');
  }
  if (!/releasedByEarlyPayoffIls/.test(rowsSrc) && !/releasedByEarlyPayoffIls/.test(sectionSrc)) {
    problems.push('section D never reads releasedByEarlyPayoffIls — the freed figure is an engine field, not a surface calculation');
  }

  /* 3. THE FIELDS THAT MAKE THE LIMIT POSITION A POSITION. */
  for (const field of ['creditLimitIls', 'availableAfterChangesIls']) {
    if (!new RegExp('\\b' + field + '\\b').test(rowsSrc + sectionSrc)) {
      problems.push('section D never reads ' + field + ' — "utilization against the safe-zone threshold" is rendered as the engine\'s limit-position fields, and this is one of them');
    }
  }
  if (!/thresholds/.test(rowsSrc + sectionSrc)) {
    problems.push('section D never reads the load thresholds — there is no safe zone on screen to be against');
  }

  /* 4. THE SEAM. */
  if (/from\s+'[^']*\/engines\//.test(sectionSrc) || /from\s+'[^']*\/engines\//.test(rowsSrc)) {
    problems.push('section D reaches an engine directly — B1: a surface reads through src/surfaces/');
  }

  /* 5. SECTION D IS REACHED. */
  if (!/SectionDActiveNow/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render SectionDActiveNow — section D is still empty');
  }

  /* 6. THE READER, WHICH TWO PROPERTIES DEPEND ON. */
  const oneLiner = readersSrc.match(/export function readCardDnaUtilizationRatio[^\n]*NOT_BUILT[^\n]*/);
  const body = readersSrc.match(/export function readCardDnaUtilizationRatio[\s\S]{0,400}?\n}/);
  if (oneLiner || (body && /return NOT_BUILT;\s*\n?}/.test(body[0]) && !/render|getByTestId/.test(body[0]))) {
    problems.push(
      READERS + ' still returns NOT_BUILT for readCardDnaUtilizationRatio, and card-dna-utilization is declared '
        + 'builtIn PHASE-3 in BOTH one-load and one-limit — that declaration is now false in two properties at once',
    );
  }

  /* 7. THE SUITE MUST READ THE FREED FIGURE FROM THE ENGINE, not restate it. */
  if (!/releasedByEarlyPayoffIls/.test(suiteSrc)) {
    problems.push(
      SUITE + ' never reads releasedByEarlyPayoffIls from the engine result. A hardcoded freed amount passes '
        + 'equally well against a surface that computed its own and happened to match',
    );
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
    'CRITERION N7 — Card DNA §D, "what\'s active right now".',
    '"Utilization against the safe-zone threshold" is rendered as ENGINE FIELDS — the card\'s limit',
    '  position and the load thresholds — and not as a percentage. There is no credit-limit',
    '  utilization ratio in ' + LOAD + '; ratioOfIncome exists and is a different fact, and the',
    '  nearest available number is not the number. §2 rule 11: a figure traces to a FIELD.',
    'Paid early goes through paidEarlyCommitmentIds and the engine recomputes: the freed amount on',
    '  screen is releasedByEarlyPayoffIls, and the suite reads it from the result at run time. A local',
    '  release calculation here would be the second implementation A4 is waiting for, shipped a phase',
    '  early and passing every test in sight.',
    'A card with no waiver renders no countdown and a card with no evidenced offer renders none —',
    '  absent is absent, the same discipline §A and §B already keep.',
    'readCardDnaUtilizationRatio is real, so builtIn: PHASE-3 is true in one-load and one-limit both.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
