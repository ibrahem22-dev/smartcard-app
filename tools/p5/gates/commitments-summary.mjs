/**
 * GATE: commitments-summary — criterion J1.  →  `COMMITMENTS-SUMMARY OK`
 *
 *   > **J1.** *"The sticky summary shows all three parts together: total monthly commitments as a
 *   > shekel hero numeral, the load bar against income, and the cap as an editable absolute shekel
 *   > limit derived from the 35 percent threshold."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "ALL THREE PARTS TOGETHER" IS THE CRITERION, NOT A LIST OF THREE CRITERIA
 *
 * Spec §25 gives the reason: *"absolute + percent together is more tangible than either alone."*
 * A percentage alone is abstract — 41% of an income the user is not thinking about. An absolute
 * alone has no sense of proportion. The pairing is the design, so two of three is not a partial
 * pass, and this gate requires all three by name in one render.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE TOTAL IS THE ONE THAT WILL BE SUMMED ON THE SURFACE IF NOBODY STOPS IT
 *
 * `CommitmentsScreen` has shipped since B2 deliberately summing nothing, and its own header says
 * why: *"Adding `reduce((a, c) => a + c.monthly, 0)` here would be four lines, would look obviously
 * right, and would be the exact defect the whole architecture exists to prevent."*
 *
 * This is the package that adds the total, so it is the moment that four-line reduce becomes
 * tempting — the data is right there in the list the screen already renders. The number belongs to
 * `load.current.monthlyObligationsIls`, because the engine knows what counts as a monthly
 * obligation and a surface only knows what it was handed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "DERIVED FROM THE 35 PERCENT THRESHOLD" — THE NUMBER IS THE ENGINE'S, NOT A LITERAL
 *
 * The threshold already exists as `load.thresholds.strongWarningRatio`, a `ProvenancedNumber`. A
 * `0.35` written into P5's code would be a fourth home for a figure that already has one, and it
 * would not move when the engine's did. The derivation belongs in `src/surfaces/` — which is the
 * read seam, neither a screen nor an engine — because a suggested figure computed on a screen is
 * the recommendation logic `B1` forbids.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND A SUGGESTION IS NEVER WRITTEN TO THE VAULT
 *
 * `src/store/p5UserState.ts` already says it, in the row `U1` classified: *"unknown until the user
 * sets one is a real state, and a default written into the vault would be the app's opinion wearing
 * the user's provenance."* So the gate refuses a write of the suggested value.
 *
 * NEGATIVE CONTROL (contract §J1): drop the absolute shekel cap and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['J1'];
export const SENTINEL = 'COMMITMENTS-SUMMARY OK';
export const MEASURES = 'render';

const CAP = 'src/surfaces/commitmentCap.ts';
const SUMMARY = 'src/screens/plan/CommitmentsSummary.tsx';
const SCREEN = 'src/screens/plan/CommitmentsScreen.tsx';
const CAP_SUITE = 'src/surfaces/__tests__/commitmentCap.test.ts';
const SUITE = 'src/screens/plan/__tests__/commitmentsSummary.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

/** All three, by name. Two of three is not a partial pass. */
const THREE_PARTS = [
  ['commitments-summary-total', 'the shekel hero numeral'],
  ['commitments-summary-load-bar', 'the load bar against income'],
  ['commitments-summary-cap', 'the editable absolute shekel cap'],
];

const CAP_CASES = [
  'derives the suggested cap from the engine threshold and the income',
  'uses the engine threshold rather than a literal',
  'returns no suggestion when income is unknown',
];

const RENDER_CASES = [
  'renders all three parts together',
  'renders the total the engine reported and sums nothing itself',
  'renders the load ratio the engine reported',
  'renders a suggested cap when the user has not set one',
  'renders the user cap once they set one',
  'writes the cap to the vault when saved',
  'renders an honest absence when income is unknown',
];

/** The four-line reduce the screen's own header warns about. */
const SUMS_ITSELF = [
  [/\.reduce\s*\(/, 'reduces a list into a total'],
  [/monthlyIls[^;\n]*\+/, 'adds monthly amounts'],
  [/\+[^;\n]*monthlyIls/, 'adds monthly amounts'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const projectConfig = (root, displayName, suite) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const project = projects.find((p) => p && p.displayName === displayName);
  if (!project) return { error: JEST_CONFIG + ' has no "' + displayName + '" project' };
  return { config: { ...project, rootDir: root, testMatch: ['**/' + suite] } };
};

export const run = async ({ root }) => {
  for (const rel of [CAP, SUMMARY, SCREEN, CAP_SUITE, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — J1 has nothing to be about');
  }

  const capSrc = stripComments(readFileSync(join(root, CAP), 'utf8'));
  const summarySrc = stripComments(readFileSync(join(root, SUMMARY), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. ALL THREE PARTS. */
  /*
   * THE testID MUST MATCH EXACTLY, TERMINATOR AND ALL.
   *
   * This was a plain summarySrc.includes(id), and it was watched staying green while the cap testID
   * was renamed to commitments-summary-cap-REMOVED — which CONTAINS the string it was looking for.
   * The suite caught that mutation; this check did not.
   *
   * And a substring test can never work here, because commitments-summary-cap-input and
   * commitments-summary-cap-suggested legitimately carry the same prefix: the rule had no way to
   * tell a present part from an absent one whose name merely starts the same. It now requires the
   * id between quotes, so the terminator is part of the match.
   */
  const rendersExactly = (src, id) => new RegExp("['\"`]" + id + "['\"`]").test(src);
  for (const [id, what] of THREE_PARTS) {
    if (!rendersExactly(summarySrc, id)) {
      problems.push(SUMMARY + ' has no ' + id + ' — ' + what + '. §25: absolute and percent together are more tangible than either alone, so two of three is not a partial pass');
    }
  }

  /* 2. THE TOTAL IS THE ENGINE'S, AND THE SURFACE SUMS NOTHING. */
  if (!/monthlyObligationsIls/.test(summarySrc)) {
    problems.push(SUMMARY + ' never reads load.current.monthlyObligationsIls — the engine knows what counts as a monthly obligation and a surface only knows what it was handed');
  }
  for (const [re, why] of SUMS_ITSELF) {
    if (re.test(summarySrc)) {
      problems.push(
        SUMMARY + ' ' + why + '. ' + SCREEN + '\'s own header calls this out: four lines, obviously right, and the '
          + 'exact defect the architecture exists to prevent',
      );
    }
  }

  /* 3. THE RATIO IS THE ENGINE'S. */
  if (!/ratioOfIncome/.test(summarySrc)) {
    problems.push(SUMMARY + ' never reads load.current.ratioOfIncome — the load bar is an engine field, not a division');
  }

  /* 4. THE THRESHOLD IS THE ENGINE'S, NOT A LITERAL — anywhere in this package. */
  for (const f of [{ n: CAP, s: capSrc }, { n: SUMMARY, s: summarySrc }]) {
    if (/0\.35\b/.test(f.s)) {
      problems.push(
        f.n + ' writes 0.35 as a literal. The figure already exists as load.thresholds.strongWarningRatio; a copy here '
          + 'is a fourth home for one number and would not move when the engine\'s did',
      );
    }
  }
  if (!/strongWarningRatio/.test(capSrc)) {
    problems.push(CAP + ' does not take the threshold from the engine result — "derived from the 35 percent threshold" means derived from the engine\'s threshold');
  }

  /* 5. THE DERIVATION IS IN THE SEAM, NOT ON THE SCREEN. */
  if (/monthlyIncome[^;\n]*\*/.test(summarySrc) || /\*[^;\n]*strongWarningRatio/.test(summarySrc)) {
    problems.push(SUMMARY + ' derives the suggested cap on the screen. That belongs in ' + CAP + ' — a suggested figure computed on a surface is the recommendation logic B1 forbids');
  }

  /* 6. A SUGGESTION IS NOT WRITTEN TO THE VAULT. */
  if (/set[A-Za-z]*Cap[^;\n]*suggest/i.test(summarySrc) || /suggest[A-Za-z]*[^;\n]*setCommitmentCap/i.test(summarySrc)) {
    problems.push(
      SUMMARY + ' writes the SUGGESTED cap to the vault. p5UserState.ts already says why not: unknown until the user '
        + 'sets one is a real state, and a default written there is the app\'s opinion wearing the user\'s provenance',
    );
  }

  /* 7. THE SUMMARY IS REACHED. */
  if (!/CommitmentsSummary/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render CommitmentsSummary');
  }

  /* 8. NO ENGINE IMPORT ON THE SCREEN. */
  if (/from\s+'[^']*\/engines\//.test(summarySrc)) {
    problems.push(SUMMARY + ' imports an engine directly (B1)');
  }

  /* 9. THE SUITE READS THE TOTAL FROM THE ENGINE. */
  if (!/monthlyObligationsIls/.test(suiteSrc)) {
    problems.push(SUITE + ' never reads monthlyObligationsIls from the engine result — a hardcoded total passes equally well against a surface that summed its own');
  }

  if (problems.length) return fail(problems.join(' · '));

  const capCfg = projectConfig(root, 'unit', CAP_SUITE);
  if (capCfg.error) return fail(capCfg.error);
  const capRun = requireJestCases(root, CAP_SUITE, CAP_CASES, ['--config', JSON.stringify(capCfg.config)]);
  if (capRun.problems.length) return fail(capRun.problems.join(' · '), capRun.summary ?? undefined);

  const cfg = projectConfig(root, 'render', SUITE);
  if (cfg.error) return fail(cfg.error);
  const run2 = requireJestCases(root, SUITE, RENDER_CASES, ['--config', JSON.stringify(cfg.config)]);
  if (run2.problems.length) return fail(run2.problems.join(' · '), run2.summary ?? undefined);

  for (const r of [capRun, run2]) {
    if (!/Tests:\s+\d+ passed/.test(String(r.summary ?? ''))) {
      return fail('a suite reported no passing tests: ' + String(r.summary));
    }
  }

  return ok(SENTINEL, [
    'CRITERION J1 — the Plan Commitments sticky summary.',
    'All three parts render together, which is the criterion rather than three of them: §25 says',
    '  absolute and percent together are more tangible than either alone, so two of three fails.',
    'The hero total is load.current.monthlyObligationsIls and the surface sums nothing. This is the',
    '  package where that four-line reduce becomes tempting — the list is right there on the screen —',
    '  and ' + SCREEN + ' has warned about it in its own header since B2.',
    'The load bar is load.current.ratioOfIncome, not a division.',
    'The cap is derived in ' + CAP + ', in the seam, from load.thresholds.strongWarningRatio — no 0.35',
    '  literal anywhere, because that figure already has a home and a copy would not move when it did.',
    'And the suggestion is never written to the vault: unknown-until-set is a real state, and a',
    '  default stored there would be the app\'s opinion wearing the user\'s provenance.',
    CAP_CASES.length + ' seam case(s) · ' + capRun.summary,
    RENDER_CASES.length + ' render case(s) required BY NAME · ' + run2.summary,
  ].join('\n'));
};
