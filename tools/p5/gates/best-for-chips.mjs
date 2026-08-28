/**
 * GATE: best-for-chips — criterion W4.  →  `BEST-FOR-CHIPS OK`
 *
 *   > **W4.** *"Best-For chips are tappable to a one-line reason taken from the scoring engine's
 *   > reason trace, and the reason deep-links into Card DNA section C."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SAME CHIPS, FROM THE SAME CALL — AND A1 IS WATCHING
 *
 * `A1` says it plainly: *"Wallet's Best-For chips, Card DNA §C's chips and the recommendation Check
 * would produce for the same context are **the same scoring call**, measured in one run."*
 *
 * Two derivations that agree today are not one derivation. They agree until one of them learns
 * something — a tie-break, a suppressed delta, an unavailable card — and then two screens tell the
 * user different things about the same wallet, which is the entire failure spec §20 exists to
 * prevent. So this gate requires Wallet to reuse §C's derivation rather than to match it, and
 * refuses a second local one.
 *
 * That is stronger than what A1 will measure. A1 compares what the two surfaces PAINT; this
 * compares where they GET it. A property can only sample the contexts it generates, and a second
 * derivation that diverges on an input nobody generated passes A1 and ships.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE REASON IS THE ENGINE'S SENTENCE, WHICH IS N6's RULE AGAIN
 *
 * Presence plus absence, `D-018`: the reason must be a trace `detail`, and must NOT be in
 * `src/i18n`. A string in the catalogue is UI copy by construction — `arabicCoverage` walks the
 * catalogue, so a sentence placed there acquires translations and a maintenance story, and the next
 * person to reword it edits it there and never touches the engine.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE TWO READERS MUST RETURN THE SAME SHAPE
 *
 * `readWalletBestForChips` and `readCardDnaWhenBestChips` are the two participants A1 compares. If
 * one returns ids and the other labels, A1 does not fail — it compares two different questions and
 * reports whatever falls out. `D-020` is that failure, found once already by luck.
 *
 * NEGATIVE CONTROL: derive a Wallet chip from a second ranking path and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W4'];
export const SENTINEL = 'BEST-FOR-CHIPS OK';
export const MEASURES = 'render';

const CHIPS = 'src/screens/wallet/WalletBestForChips.tsx';
const TILE = 'src/screens/wallet/WalletTile.tsx';
const SUITE = 'src/screens/wallet/__tests__/walletBestFor.render.test.tsx';
const READERS = 'src/surfaces/__tests__/agreementReaders.tsx';
const SHARED = 'src/screens/cardDna/bestForChips.ts';
const SEAM = 'src/surfaces/surfaceEngines.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders a Best-For chip when the engine ranks this card best',
  'renders at most two chips',
  'reveals the engine trace reason when a chip is tapped',
  'takes the reason from the engine rather than the translation catalogue',
  'deep-links into Card DNA when the reason is tapped',
  'renders nothing when the engine ranks this card nowhere',
];

/** A second derivation, in the forms it would actually take. */
const SECOND_DERIVATION = [
  [/\bresult\??\.\s*ranked\b/, 'walks the ranked array itself instead of reusing the shared derivation'],
  [/\.sort\s*\(/, 'sorts a ranking the engine already ordered'],
  [/\.trace\s*\.\s*steps\s*\.\s*find/, 'selects its own trace step — §C already decides which step explains a chip'],
];

/** Composition of the reason, which N6 forbids and W4 inherits. */
const COMPOSES = [
  [/\bt\(\s*['"`][^'"`]{25,}/, 'passes a long sentence to t() — a reason in the catalogue is UI copy'],
  [/\.detail\s*\+/, 'appends to a trace detail'],
  [/\.detail\s*\.\s*(replace|slice|substring|toUpperCase|toLowerCase)\b/, 'rewrites a trace detail'],
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
  for (const rel of [CHIPS, TILE, SUITE, READERS, SHARED, SEAM]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — W4 has nothing to be about');
  }

  const chipsSrc = stripComments(readFileSync(join(root, CHIPS), 'utf8'));
  const tileSrc = stripComments(readFileSync(join(root, TILE), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const readersSrc = stripComments(readFileSync(join(root, READERS), 'utf8'));
  const problems = [];

  /* 1. ONE DERIVATION, REUSED — not two that agree. */
  if (!/bestForChipsFor/.test(chipsSrc)) {
    problems.push(
      CHIPS + ' does not use bestForChipsFor from ' + SHARED + '. A1 requires Wallet\'s chips and Card DNA §C\'s to be '
        + 'the SAME scoring call, and two derivations that agree today agree until one of them learns a tie-break',
    );
  }
  for (const [re, why] of SECOND_DERIVATION) {
    if (re.test(chipsSrc)) {
      problems.push(CHIPS + ' ' + why + ' — that is the second derivation A1 exists to catch, written a phase before A1 can see it');
    }
  }

  /* 2. THE REASON IS THE ENGINE'S (N6's rule, inherited). */
  for (const [re, why] of COMPOSES) {
    if (re.test(chipsSrc)) problems.push(CHIPS + ' ' + why);
  }

  /* 3. THE SEAM. */
  if (/from\s+'[^']*\/engines\//.test(chipsSrc)) {
    problems.push(CHIPS + ' imports an engine directly — B1: a surface reads through ' + SEAM);
  }

  /* 4. AT MOST TWO. W1: "one or two Best-For chips". */
  if (!/slice\s*\(\s*0\s*,\s*2\s*\)/.test(chipsSrc) && !/slice\s*\(\s*0\s*,\s*MAX/.test(chipsSrc)) {
    problems.push(CHIPS + ' does not cap the chip count at two — spec §10 via W1 says one or two');
  }

  /* 5. TAPPABLE, WITH A REASON, THAT DEEP-LINKS. */
  if (!/-reason/.test(chipsSrc)) {
    problems.push(CHIPS + ' renders no reason element — W4\'s chips are tappable TO a one-line reason');
  }
  if (!/navigate/.test(chipsSrc)) {
    problems.push(CHIPS + ' never navigates — W4 says the reason deep-links into Card DNA §C');
  }

  /* 6. IN THE TILE'S SLOT. */
  if (!/WalletBestForChips/.test(tileSrc)) {
    problems.push(TILE + ' does not render WalletBestForChips — W1 left the best-for-chips slot for this');
  }

  /* 7. THE TWO READERS A1 COMPARES MUST RETURN THE SAME SHAPE (D-020). */
  const wallet = readersSrc.match(/export function readWalletBestForChips[\s\S]{0,500}?\n}/);
  const cardDna = readersSrc.match(/export function readCardDnaWhenBestChips[\s\S]{0,500}?\n}/);
  if (!wallet) {
    problems.push(READERS + ' has no readWalletBestForChips — it is the wallet-best-for participant in A1');
  } else if (/return NOT_BUILT;\s*\n?}/.test(wallet[0]) && !/render|getAllByTestId/.test(wallet[0])) {
    problems.push(READERS + ' still returns NOT_BUILT for readWalletBestForChips while the chips render');
  } else if (cardDna) {
    const shapeOf = (s) => (/\.map\s*\(/.test(s) ? 'mapped-list' : 'other');
    if (shapeOf(wallet[0]) !== shapeOf(cardDna[0])) {
      problems.push(
        READERS + ' readWalletBestForChips and readCardDnaWhenBestChips return different shapes. A1 compares them '
          + 'directly: differing shapes do not make it fail, they make it compare two different questions (D-020)',
      );
    }
  }

  /* 8. THE SUITE READS THE SENTENCE FROM THE TRACE. */
  if (!/\.detail\b/.test(suiteSrc)) {
    problems.push(SUITE + ' never reads a .detail from the trace — a hardcoded reason passes equally well against a component that wrote its own');
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
    'CRITERION W4 — Wallet\'s Best-For chips.',
    'Wallet REUSES Card DNA §C\'s derivation rather than matching it. That is stronger than what A1',
    '  will measure: A1 compares what the two surfaces PAINT, over the contexts it generates, and a',
    '  second derivation that diverges on an input nobody generated would pass it and ship. This',
    '  compares where they GET it.',
    'The reason is the engine\'s own trace sentence — not composed, not templated, not edited, and',
    '  not in src/i18n, where a string becomes UI copy by construction (D-018\'s presence-plus-absence).',
    'Chips are capped at two, tappable, and the reason deep-links into Card DNA §C.',
    'And both readers A1 compares return the same shape, so the property compares one question',
    '  rather than two (D-020).',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
