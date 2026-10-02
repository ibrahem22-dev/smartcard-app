/**
 * GATE: wallet-render-discipline — criterion W5.  →  `WALLET-RENDER-DISCIPLINE OK`
 *
 *   > **W5.** *"Every image on a tile comes from the P4 media resolver and nowhere else, every
 *   > figure is in shekels except a genuine foreign amount, and a conflicted underlying fact is
 *   > carried as an Estimate and never surfaced on a tile."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE THIRD CLAUSE IS THE DELIBERATE OPPOSITE OF N9, AND BOTH ARE RIGHT
 *
 * Card DNA §A renders a conflicted value as `ConflictedValue`, inline, showing every competing
 * reading with its scope and source. That is `N9`, and it is correct **there**: §A is where a user
 * goes to understand one card's costs in detail, and hiding a disagreement from someone who came to
 * look closely would be the dishonest choice.
 *
 * A tile is not that place. A wallet is a glance surface — five tiles, one line of numbers each —
 * and a disagreement rendered there hands the user a problem they cannot act on in a place they
 * cannot act in. Five at once turns a glance into an audit. So W5 says the fact is **carried** (the
 * tile still shows something, it does not blank) and **never surfaced** (no candidates, no "sources
 * disagree"), wearing `ESTIMATE`, because a value we could not resolve is neither verified nor the
 * user's.
 *
 * The two criteria look contradictory quoted side by side, and are not: they differ on *where*.
 * This gate therefore refuses `ConflictedValue` under `src/screens/wallet` — which would be P5
 * being consistent in exactly the wrong direction.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "AND NOWHERE ELSE" IS THE CLAUSE A RENDER TEST CANNOT PROVE
 *
 * A suite can assert the resolver was used for the images it happened to render. Only reading the
 * source can show there is no second path — a `require()` of a bundled asset, an `Image` with a
 * `uri`, a URL, a base64 blob. Each of those renders a picture that looks fine and bypasses every
 * rights and tier decision P4 built the resolver to make.
 *
 * NEGATIVE CONTROL (contract §W5): render a tile from a hard-coded image path instead of the
 * resolver and watch this fail.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W5'];
export const SENTINEL = 'WALLET-RENDER-DISCIPLINE OK';
export const MEASURES = 'render';

const WALLET_DIR = 'src/screens/wallet';
const DISCIPLINE = 'src/screens/wallet/tileDiscipline.ts';
const SUITE = 'src/screens/wallet/__tests__/walletDiscipline.render.test.tsx';
const RESOLVER = 'src/media/resolveMedia.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders every tile image through the media resolver',
  'renders no image from a hard-coded path',
  'renders figures in shekels',
  'renders a genuine foreign amount in its own currency',
  'carries a conflicted fact as an Estimate',
  'never surfaces a conflict on a tile',
];

/** Every way an image reaches a screen without passing the resolver. */
const IMAGE_BYPASS = [
  [/require\s*\(\s*['"`][^'"`]*\.(png|jpg|jpeg|gif|webp|svg)['"`]/i, 'requires a bundled image asset directly'],
  [/\buri\s*:\s*['"`]/, 'sets an Image uri from a literal'],
  [/https?:\/\/[^\s'"`]*\.(png|jpg|jpeg|gif|webp|svg)/i, 'names a remote image URL'],
  [/data:image\//, 'inlines a base64 image'],
  [/\bsource\s*=\s*\{\s*require\s*\(/, 'passes a require() straight to an Image source'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) { if (entry !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
};

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
  for (const rel of [DISCIPLINE, SUITE, RESOLVER]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — W5 has nothing to be about');
  }

  const files = walk(join(root, WALLET_DIR));
  if (files.length === 0) {
    return fail('no files under ' + WALLET_DIR + ' — a discipline sweep over zero files is the vacuous pass §2 rule 5 refuses');
  }

  const disciplineSrc = stripComments(readFileSync(join(root, DISCIPLINE), 'utf8'));
  const problems = [];

  /* 1. NO SECOND IMAGE PATH, ANYWHERE UNDER THE WALLET. */
  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    for (const [re, why] of IMAGE_BYPASS) {
      if (re.test(src)) {
        problems.push(
          rel + ' ' + why + '. W5 says every image comes from the resolver AND NOWHERE ELSE — a second path renders a '
            + 'picture that looks fine and bypasses every rights and tier decision P4 built ' + RESOLVER + ' to make',
        );
      }
    }

    /* 2. A CONFLICT IS NOT SURFACED HERE. The opposite of N9, on purpose. */
    if (/\bConflictedValue\b/.test(src)) {
      problems.push(
        rel + ' renders ConflictedValue. That is correct on Card DNA §A (N9) and wrong on a tile: W5 says a conflicted '
          + 'fact is CARRIED as an Estimate and NEVER SURFACED. A wallet is a glance surface, and a disagreement there '
          + 'is a problem the user cannot act on in a place they cannot act in',
      );
    }
    if (/\bcandidates\b/.test(src)) {
      problems.push(rel + ' touches a conflict\'s candidates — a tile carries the fact, it does not enumerate the disagreement');
    }
  }

  /* 3. THE RULES HAVE ONE HOME, and a CONFLICT maps to ESTIMATE there. */
  if (!/export function tileChipFor/.test(disciplineSrc)) {
    problems.push(DISCIPLINE + ' exports no tileChipFor — the chip a tile wears for an unresolved fact needs one home, not a decision per component');
  }
  if (!/'ESTIMATE'/.test(disciplineSrc)) {
    problems.push(DISCIPLINE + ' never returns ESTIMATE — W5 says a conflicted fact is carried AS an Estimate');
  }
  if (/'VERIFIED'/.test(disciplineSrc)) {
    problems.push(DISCIPLINE + ' can return VERIFIED for a tile fact — a value we could not resolve is not one the issuer confirmed');
  }
  if (!/CONFLICT/.test(disciplineSrc)) {
    problems.push(DISCIPLINE + ' never mentions the CONFLICT state — it is the state W5 is about');
  }

  /* 4. THE FOREIGN-AMOUNT EXCEPTION HAS ONE HOME TOO. */
  if (!/isForeignAmount|foreignAmount|isGenuineForeign/i.test(disciplineSrc)) {
    problems.push(DISCIPLINE + ' has no single decision for what counts as a genuine foreign amount — W5\'s shekel rule has exactly one exception and it should be decided once');
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
    'CRITERION W5 — Wallet render discipline, over ' + files.length + ' file(s) under ' + WALLET_DIR + '.',
    'Every image goes through ' + RESOLVER + ' and NOWHERE ELSE: no bundled require, no Image uri, no',
    '  remote URL, no base64. A suite can only prove the resolver was used for what it rendered;',
    '  reading the source is what proves there is no second path.',
    'Figures are in shekels, with one exception decided in one place.',
    'And a conflicted fact is CARRIED as an Estimate, never surfaced. That is the deliberate opposite',
    '  of N9, and both are right: §A is where someone came to look closely, and hiding a disagreement',
    '  there would be the dishonest choice. A wallet is a glance surface — a disagreement on five',
    '  tiles at once turns a glance into an audit, and hands the user a problem they cannot act on in',
    '  a place they cannot act in. ConflictedValue is refused under ' + WALLET_DIR + ' for that reason.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
