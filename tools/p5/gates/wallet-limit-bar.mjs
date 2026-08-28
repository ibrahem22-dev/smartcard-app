/**
 * GATE: wallet-limit-bar — criterion W2.  →  `WALLET-LIMIT-BAR OK`
 *
 *   > **W2.** *"The available-limit bar shows limit minus active holds minus logged-this-cycle
 *   > purchases in shekels, read from the load engine, and carries an Estimate chip that can never
 *   > read Verified."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CRITERION DESCRIBES A SUBTRACTION. IT DOES NOT ASK FOR ONE.
 *
 * *"limit minus active holds minus logged-this-cycle purchases"* is what
 * `CardLimitPosition.availableBeforeChangesIls` **is** — `load.ts` computes exactly that and
 * publishes it. So the sentence is a description of an engine field, and the trap is that it reads
 * like an instruction. Writing the subtraction on the surface produces the identical number today,
 * looks like a faithful implementation of the words, and becomes a second opinion about the user's
 * money the first time the engine treats an edge case differently — an over-limit card, a
 * mid-cycle refund, a hold the engine declines to count.
 *
 * B1 and §2 rule 11 settle it: a rendered figure traces to the engine result **field**. This gate
 * refuses the arithmetic, in the shape it would actually take — through `.value`, because every
 * figure the engine publishes is a `ProvenancedNumber` (that lesson cost N7 a control that could
 * not fire).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "CAN NEVER READ VERIFIED" IS A CLAIM ABOUT THE TYPE, NOT ABOUT TODAY'S VALUE
 *
 * A component taking `chip: ProvenanceChip` and being passed `'ESTIMATE'` at its one call site
 * satisfies *"carries an Estimate chip"* and fails *"can never read Verified"* — the second is a
 * claim about what the code **admits**, and a variable that is ESTIMATE today is one call site away
 * from not being.
 *
 * The reason it matters is what the number is: a credit limit the user typed, holds the app
 * inferred, and purchases it logged. `VERIFIED` on that would claim the issuer confirmed it. So the
 * gate requires the impossibility to be structural — no chip input, or one narrowed to the literal.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE READER, WHICH D-020 SAYS TO CHECK FOR QUANTITY AND NOT FOR NUMBERHOOD
 *
 * This bar is the `wallet-limit-bar` participant in `one-limit`, alongside Card DNA §D's
 * `availableAfterChangesIls` and the Verdict's impact strip. A reader returning a ratio, a
 * percentage or a bar width would not make the property fail — it would make it compare two
 * different questions and report whatever fell out. That already happened once here, and it was
 * found by luck rather than by a check.
 *
 * NEGATIVE CONTROL (contract §W2): label the limit Verified and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W2'];
export const SENTINEL = 'WALLET-LIMIT-BAR OK';
export const MEASURES = 'render';

const BAR = 'src/screens/wallet/WalletLimitBar.tsx';
const TILE = 'src/screens/wallet/WalletTile.tsx';
const SUITE = 'src/screens/wallet/__tests__/walletLimitBar.render.test.tsx';
const READERS = 'src/surfaces/__tests__/agreementReaders.tsx';
const LOAD = 'src/engines/load.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders the available limit the engine reported',
  'renders no figure the engine did not publish',
  'renders an Estimate chip',
  'cannot render a Verified chip',
  'renders an honest unknown when the engine reports no limit position for the card',
];

/** The figures the load engine publishes for a card. Arithmetic on any of them is a second opinion. */
const FIGURES = '(creditLimitIls|activeInstallmentHoldsIls|loggedThisCyclePurchasesIls'
  + '|availableBeforeChangesIls|availableAfterChangesIls|releasedByEarlyPayoffIls|prospectiveHoldIls)';

const DERIVES = [
  [new RegExp(FIGURES + '(\\.value)?\\s*[-+*/]\\s*(?![/*])'), 'does arithmetic on an engine figure'],
  [new RegExp('[-+*/]\\s*[A-Za-z0-9_.]*' + FIGURES), 'feeds an engine figure into arithmetic'],
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
  for (const rel of [BAR, TILE, SUITE, READERS, LOAD]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — W2 has nothing to be about');
  }

  const barSrc = stripComments(readFileSync(join(root, BAR), 'utf8'));
  const tileSrc = stripComments(readFileSync(join(root, TILE), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const readersSrc = stripComments(readFileSync(join(root, READERS), 'utf8'));
  const problems = [];

  /* 1. THE FIELD, NOT THE SUBTRACTION. */
  if (!/availableBeforeChangesIls/.test(barSrc)) {
    problems.push(
      BAR + ' never reads availableBeforeChangesIls. W2\'s wording DESCRIBES that field — ' + LOAD
        + ' already computes limit minus holds minus logged purchases — so the sentence is not an instruction to subtract',
    );
  }
  for (const [re, why] of DERIVES) {
    const hit = barSrc.match(re);
    if (hit) {
      problems.push(
        BAR + ' ' + why + ' (' + hit[0].trim().slice(0, 40) + '). The same number today, and a second opinion '
          + 'the first time the engine treats an edge case differently — an over-limit card, a mid-cycle refund, '
          + 'a hold it declines to count',
      );
    }
  }

  /* 2. VERIFIED MUST BE IMPOSSIBLE, NOT MERELY ABSENT. */
  if (/VERIFIED/.test(barSrc)) {
    problems.push(BAR + ' names VERIFIED. This figure rests on a limit the user typed, holds the app inferred and purchases it logged — VERIFIED would claim the issuer confirmed it');
  }
  const takesWideChip = /chip\s*:\s*ProvenanceChip\b/.test(barSrc) && !/chip\s*:\s*'ESTIMATE'/.test(barSrc);
  if (takesWideChip) {
    problems.push(
      BAR + ' accepts a chip of the full ProvenanceChip type. W2 says the chip CAN NEVER read Verified, which is a '
        + 'claim about what the code admits — a variable that is ESTIMATE today is one call site away from not being. '
        + 'Take no chip input, or narrow it to the ESTIMATE literal',
    );
  }
  if (!/ESTIMATE/.test(barSrc)) {
    problems.push(BAR + ' renders no Estimate chip');
  }

  /* 3. NO RATIO ON THIS SURFACE. The ratio of income is Card DNA §D's, and a different fact. */
  if (/ratioOfIncome/.test(barSrc)) {
    problems.push(BAR + ' reads ratioOfIncome — that is a ratio of income and belongs to Card DNA §D; W2 is a shekel figure');
  }

  /* 4. THE SEAM. */
  if (/from\s+'[^']*\/engines\//.test(barSrc)) {
    problems.push(BAR + ' imports an engine directly — B1: a surface reads through src/surfaces/');
  }

  /* 5. IT IS IN THE TILE'S SLOT. */
  if (!/WalletLimitBar/.test(tileSrc)) {
    problems.push(TILE + ' does not render WalletLimitBar — W1 left the limit-bar slot for this');
  }

  /* 6. THE READER RETURNS A LIMIT POSITION IN SHEKELS (D-020). */
  const reader = readersSrc.match(/export function readWalletLimitBar[\s\S]{0,500}?\n}/);
  if (!reader) {
    problems.push(READERS + ' has no readWalletLimitBar — it is the wallet-limit-bar participant in one-limit');
  } else {
    if (/NOT_BUILT;\s*\n?}/.test(reader[0]) && !/render|getByTestId|paintedValue/.test(reader[0])) {
      problems.push(READERS + ' still returns NOT_BUILT for readWalletLimitBar while the bar renders');
    }
    if (!/wallet-limit-bar-available/.test(reader[0])) {
      problems.push(
        READERS + ' readWalletLimitBar does not read wallet-limit-bar-available. one-limit compares LIMIT POSITIONS '
          + 'IN SHEKELS; a reader returning a ratio or a bar width would not fail the property, it would make it '
          + 'compare two different questions and report whatever fell out — see D-020',
      );
    }
  }

  /* 7. THE SUITE READS THE FIGURE FROM THE ENGINE. */
  if (!/availableBeforeChangesIls/.test(suiteSrc)) {
    problems.push(SUITE + ' never reads availableBeforeChangesIls from the engine result — a hardcoded expectation passes equally well against a surface that subtracted its own');
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
    'CRITERION W2 — the Wallet available-limit bar.',
    'W2\'s wording describes a subtraction the engine has already done: availableBeforeChangesIls IS',
    '  limit minus holds minus logged-this-cycle purchases. The bar renders that FIELD, and the gate',
    '  refuses the arithmetic in the shape it would take — through .value, because every engine',
    '  figure is a ProvenancedNumber.',
    'The Estimate chip cannot read Verified STRUCTURALLY, not by habit: this figure rests on a limit',
    '  the user typed, holds the app inferred and purchases it logged, and VERIFIED would claim the',
    '  issuer confirmed it. A chip variable that is ESTIMATE today is one call site away from not.',
    'An absent limit position renders an honest unknown, never a zero.',
    'And readWalletLimitBar reads a shekel limit position, which is the quantity one-limit compares —',
    '  a reader with the wrong quantity does not fail the property, it makes it answer a different',
    '  question (D-020).',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
