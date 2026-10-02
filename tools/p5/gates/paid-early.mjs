/**
 * GATE: paid-early — criterion J4.  →  `PAID-EARLY OK`
 *
 *   > **J4.** *"Paid early frees the card's held limit immediately through the load engine's
 *   > early-payoff recalculation, and invents no interest-rebate figure."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE IMPLEMENTATION, AND THE CONTRACT SAYS SO IN ADVANCE
 *
 * §8, written before either surface existed: *"WP-3.5's 'Paid early' is the same act Plan
 * Commitments performs. **One implementation**, calling the load engine's early-payoff
 * recalculation. Two 'Paid early' buttons that free a hold two ways is exactly what criterion `A4`
 * exists to catch — and it will catch it in PHASE-4, not here."*
 *
 * So this gate is **presence plus absence** (`D-018`): the shared hook must exist and both surfaces
 * must use it, AND neither may hold paid-early state of its own. Card DNA §D implemented the act
 * inline first, which makes copying it the path of least resistance — and a copy would pass every
 * test either surface has, because both would be right.
 *
 * That is why the check is structural rather than behavioural. A4 compares what the surfaces PAINT
 * over generated contexts; two implementations that agree on those contexts pass it. This asks
 * whether there is one implementation at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "INVENTS NO INTEREST-REBATE FIGURE" IS THE CLAUSE WITH A HELPFUL-LOOKING FAILURE
 *
 * Paying an installment early plausibly saves interest, and a user would want to know. The load
 * engine does not compute that, so any figure a surface shows for it is one nobody calculated from
 * anything — a rate times a remaining balance, invented on a screen, about somebody's money.
 *
 * The engine reports what early payoff **frees**: `releasedByEarlyPayoffIls`, a limit that is
 * available again. That is a true and useful thing to say, and it is a different thing from a
 * saving. The gate refuses the vocabulary of the second.
 *
 * NEGATIVE CONTROL (contract §J4): release the hold in the component instead of the engine, and
 * watch the purity gate and this one both fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['J4'];
export const SENTINEL = 'PAID-EARLY OK';
export const MEASURES = 'render';

const HOOK = 'src/surfaces/usePaidEarly.ts';
const HOOK_SUITE = 'src/surfaces/__tests__/usePaidEarly.test.ts';
const SECTION_D = 'src/screens/cardDna/SectionDActiveNow.tsx';
const SHEET = 'src/screens/plan/CommitmentDetailSheet.tsx';
const SUITE = 'src/screens/plan/__tests__/paidEarly.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const HOOK_CASES = [
  'starts from the ids the context already carries',
  'adds a commitment to the paid-early set',
  'produces a context the engine can be evaluated with',
  'computes no freed figure of its own',
];

const RENDER_CASES = [
  'frees the held limit through the load engine when a commitment is paid early',
  'renders the freed figure the engine reported',
  'invents no interest rebate figure',
  'uses the same implementation Card DNA section D uses',
];

/** An interest rebate, in the vocabulary it would arrive in. */
const REBATE = [
  [/\b(interestRebate|rebate|savedInterest|interestSaved|savingIls)\b/i, 'names an interest rebate'],
  [/\bריבית[^\n]{0,20}(חסכ|חיסכ)/, 'says saved interest'],
  [/interest[A-Za-z]*\s*\*\s*/i, 'multiplies an interest rate into a figure'],
];

/** A second home for the paid-early selection. */
const LOCAL_STATE = /const\s*\[\s*[A-Za-z0-9_]*[Pp]aidEarly[A-Za-z0-9_]*\s*,/;

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
  for (const rel of [HOOK, HOOK_SUITE, SECTION_D, SHEET, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — J4 has nothing to be about');
  }

  const hookSrc = stripComments(readFileSync(join(root, HOOK), 'utf8'));
  const dSrc = stripComments(readFileSync(join(root, SECTION_D), 'utf8'));
  const sheetSrc = stripComments(readFileSync(join(root, SHEET), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. PRESENCE — one implementation, and BOTH surfaces reach it. */
  for (const f of [{ n: SECTION_D, s: dSrc }, { n: SHEET, s: sheetSrc }]) {
    if (!/usePaidEarly/.test(f.s)) {
      problems.push(
        f.n + ' does not use the shared usePaidEarly. §8, written before either surface existed: one implementation, '
          + 'because two Paid-early buttons freeing a hold two ways is what A4 exists to catch',
      );
    }
  }

  /* 2. ABSENCE — neither surface keeps its own selection (D-018). */
  for (const f of [{ n: SECTION_D, s: dSrc }, { n: SHEET, s: sheetSrc }]) {
    if (LOCAL_STATE.test(f.s)) {
      problems.push(
        f.n + ' still holds paid-early state of its own. Section D implemented this act inline first, which makes '
          + 'copying it the path of least resistance — and a copy passes every test either surface has, because both '
          + 'are right. A4 compares what they PAINT over generated contexts; this asks whether there is one '
          + 'implementation at all',
      );
    }
  }

  /* 3. THE FREED FIGURE IS THE ENGINE'S. */
  if (!/releasedByEarlyPayoffIls/.test(sheetSrc)) {
    problems.push(SHEET + ' never reads releasedByEarlyPayoffIls — the engine reports what early payoff frees and the surface renders it');
  }
  if (/releasedByEarlyPayoffIls[^;\n]*[-+*/]/.test(sheetSrc) || /releasedByEarlyPayoffIls\.value[^;\n]*[-+*/]/.test(sheetSrc)) {
    problems.push(SHEET + ' does arithmetic on the freed figure (B1, §2 rule 11)');
  }
  if (/computeFreed|calculateRelease|freedFor\s*\(/.test(hookSrc + sheetSrc)) {
    problems.push('a freed figure is being computed rather than read — the hook arranges for the engine to be asked, it does not answer');
  }

  /* 4. NO INTEREST REBATE, ANYWHERE IN THIS ACT. */
  for (const f of [{ n: HOOK, s: hookSrc }, { n: SHEET, s: sheetSrc }, { n: SECTION_D, s: dSrc }]) {
    for (const [re, why] of REBATE) {
      if (re.test(f.s)) {
        problems.push(
          f.n + ' ' + why + '. Paying early plausibly saves interest and a user would want to know — but the load '
            + 'engine does not compute it, so any figure shown for it is a rate times a balance, invented on a screen, '
            + 'about somebody\'s money. What the engine reports is the HOLD THAT WAS FREED, which is a different and '
            + 'true thing',
        );
      }
    }
  }

  /* 5. THE SEAM. */
  if (/from\s+'[^']*\/engines\//.test(sheetSrc)) {
    problems.push(SHEET + ' imports an engine directly (B1)');
  }

  /* 6. THE SUITE READS THE FIGURE FROM THE ENGINE. */
  if (!/releasedByEarlyPayoffIls/.test(suiteSrc)) {
    problems.push(SUITE + ' never reads releasedByEarlyPayoffIls from the engine result — a hardcoded freed amount passes equally well against a surface that computed its own');
  }

  if (problems.length) return fail(problems.join(' · '));

  const hookCfg = projectConfig(root, 'unit', HOOK_SUITE);
  if (hookCfg.error) return fail(hookCfg.error);
  const hookRun = requireJestCases(root, HOOK_SUITE, HOOK_CASES, ['--config', JSON.stringify(hookCfg.config)]);
  if (hookRun.problems.length) return fail(hookRun.problems.join(' · '), hookRun.summary ?? undefined);

  const cfg = projectConfig(root, 'render', SUITE);
  if (cfg.error) return fail(cfg.error);
  const renderRun = requireJestCases(root, SUITE, RENDER_CASES, ['--config', JSON.stringify(cfg.config)]);
  if (renderRun.problems.length) return fail(renderRun.problems.join(' · '), renderRun.summary ?? undefined);

  for (const r of [hookRun, renderRun]) {
    if (!/Tests:\s+\d+ passed/.test(String(r.summary ?? ''))) {
      return fail('a suite reported no passing tests: ' + String(r.summary));
    }
  }

  return ok(SENTINEL, [
    'CRITERION J4 — Paid early, once.',
    'One implementation in ' + HOOK + ', used by BOTH Card DNA §D and Plan Commitments, and neither',
    '  holds paid-early state of its own. §8 called this in advance: two Paid-early buttons freeing a',
    '  hold two ways is what A4 exists to catch. §D built the act inline first, so copying it was the',
    '  path of least resistance — and a copy would pass every test either surface has, because both',
    '  would be right. A4 compares what they paint over generated contexts; this asks whether there',
    '  is one implementation at all.',
    'The freed figure is releasedByEarlyPayoffIls, read from the engine and not computed.',
    'And no interest rebate anywhere. Paying early plausibly saves interest and a user would want to',
    '  know — but nothing computes it, so any figure shown would be a rate times a balance invented on',
    '  a screen. The hold that was freed is the true thing the engine actually reports.',
    HOOK_CASES.length + ' hook case(s) · ' + hookRun.summary,
    RENDER_CASES.length + ' render case(s) required BY NAME · ' + renderRun.summary,
  ].join('\n'));
};
