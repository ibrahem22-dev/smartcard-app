/**
 * GATE: commitments-row — criterion J3.  →  `COMMITMENTS-ROW OK`
 *
 *   > **J3.** *"Each row carries name, monthly amount, a remaining count in the seven-of-twelve
 *   > form, a linked card mini-tile from the media resolver, and a chevron into the detail sheet."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "SEVEN OF TWELVE" IS A FORM, AND A ROW THAT CANNOT FILL IT SHOWS NOTHING
 *
 * The count is *"payment 7 of 12"* — an ordinal out of a total, both of which have to be real. The
 * failure this invites is `1/1`: a commitment carrying no payment count still has *a* payment, so
 * the honest-looking default is to call it the first of one. That is a fabricated total dressed as
 * arithmetic, and it reads to a user as *"this ends after this month"*, which nobody said.
 *
 * The rule §A, §B and §D already hold applies here too: **absent is absent**. No count, no count.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE MINI-TILE IS W5's RULE ON A DIFFERENT SURFACE
 *
 * Every image through the resolver and nowhere else. A commitment row is a small, dense place where
 * a `require()` of a card image would be quick and would look right, and it would bypass every
 * rights and tier decision P4 built the resolver to make. And a commitment linked to no card gets
 * **no tile** — not a grey rectangle, not a placeholder card.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ROW COMPUTES NOTHING, AND J1's TOTAL IS WHY THAT STILL MATTERS
 *
 * J1 put a real monthly total on this screen, from the load engine. That makes the row a tempting
 * place to "help" — a remaining balance, a payoff figure, monthly × remaining. Every one of those
 * is a number no engine produced, on a surface, next to a number one did. B1, and §2 rule 11.
 *
 * NEGATIVE CONTROL: render a remaining count for a commitment that carries no payment count, and
 * watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['J3'];
export const SENTINEL = 'COMMITMENTS-ROW OK';
export const MEASURES = 'render';

const ROW = 'src/screens/plan/CommitmentRow.tsx';
const SCREEN = 'src/screens/plan/CommitmentsScreen.tsx';
const SUITE = 'src/screens/plan/__tests__/commitmentRow.render.test.tsx';
const RESOLVER = 'src/media/resolveMedia.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** The five things J3 names, in the row. */
const ROW_PARTS = [
  ['-name', 'the name'],
  ['-monthly', 'the monthly amount'],
  ['-remaining', 'the remaining count'],
  ['-card', 'the linked-card mini-tile'],
  ['-chevron', 'the chevron into the detail sheet'],
];

const REQUIRED_CASES = [
  'renders the name and the monthly amount the commitment carries',
  'renders the remaining count in the seven-of-twelve form',
  'renders no remaining count when the commitment carries no payment count',
  'renders the linked card mini-tile through the media resolver',
  'renders no mini-tile when the commitment is linked to no card',
  'renders a chevron on every row',
  'computes no figure of its own',
];

/** An image reaching the row without the resolver. */
const IMAGE_BYPASS = [
  [/require\s*\(\s*['"`][^'"`]*\.(png|jpg|jpeg|gif|webp|svg)['"`]/i, 'requires a bundled image directly'],
  [/\buri\s*:\s*['"`]/, 'sets an Image uri from a literal'],
  [/https?:\/\/[^\s'"`]*\.(png|jpg|jpeg|gif|webp|svg)/i, 'names a remote image URL'],
];

/** A figure the row made up. */
const COMPUTES = [
  [/monthlyIls[^;\n]*\*/, 'multiplies the monthly amount — a remaining balance is a figure no engine produced'],
  [/\*[^;\n]*monthlyIls/, 'multiplies the monthly amount'],
  [/\.reduce\s*\(/, 'reduces — J1 owns the total and it comes from the load engine'],
  [/remaining[A-Za-z]*\s*\*\s*/i, 'multiplies by a remaining count'],
];

/** The fabricated total that reads as "this ends this month". */
const FAKE_COUNT = [
  [/\?\?\s*1\s*[,)}]/, 'defaults a count to 1 — a commitment with no payment count is not the first of one'],
  [/total\w*\s*(\?\?|\|\|)\s*1\b/i, 'defaults a total to 1'],
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
  for (const rel of [ROW, SCREEN, SUITE, RESOLVER]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — J3 has nothing to be about');
  }

  const rowSrc = stripComments(readFileSync(join(root, ROW), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. THE FIVE PARTS. */
  for (const [suffix, what] of ROW_PARTS) {
    if (!rowSrc.includes(suffix)) {
      problems.push(ROW + ' renders no ' + suffix + ' element — ' + what);
    }
  }

  /* 2. THE MINI-TILE IS THE RESOLVER'S, VIA THE SHARED TILE. */
  if (!/\bCardTile\b/.test(rowSrc)) {
    problems.push(ROW + ' does not use the shared CardTile — the mini-tile resolves through ' + RESOLVER + ' and nowhere else (W5\'s rule, this surface)');
  }
  for (const [re, why] of IMAGE_BYPASS) {
    if (re.test(rowSrc)) {
      problems.push(ROW + ' ' + why + ' — a row is a small dense place where that would look right and would bypass every rights and tier decision the resolver makes');
    }
  }

  /* 3. NO FABRICATED COUNT. */
  for (const [re, why] of FAKE_COUNT) {
    if (re.test(rowSrc)) {
      problems.push(
        ROW + ' ' + why + '. It reads to a user as "this ends after this month", which nobody said — absent is absent, '
          + 'as §A, §B and §D already hold',
      );
    }
  }

  /* 4. NO FIGURE OF ITS OWN. J1's real total sits on this screen now, which makes helping tempting. */
  for (const [re, why] of COMPUTES) {
    if (re.test(rowSrc)) problems.push(ROW + ' ' + why + ' (B1, §2 rule 11)');
  }
  if (/from\s+'[^']*\/engines\//.test(rowSrc)) {
    problems.push(ROW + ' imports an engine directly (B1)');
  }

  /* 5. THE SCREEN USES IT. */
  if (!/CommitmentRow/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render CommitmentRow');
  }

  /* 6. THE SUITE PROVES THE ABSENCES, which is where this criterion actually fails. */
  for (const needle of ['no remaining count', 'no mini-tile']) {
    if (!suiteSrc.includes(needle)) {
      problems.push(SUITE + ' has no case about "' + needle + '" — the absences are the half a fixture with complete data never reaches');
    }
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
    'CRITERION J3 — the anatomy of one commitment row.',
    'All five parts render, and two of them render NOTHING when the fact is absent:',
    '  · no remaining count when the commitment carries no payment count. The tempting default is',
    '    1/1 — a commitment with no count still has a payment — and it reads as "this ends after',
    '    this month", which nobody said.',
    '  · no mini-tile when the commitment is linked to no card. Not a grey rectangle.',
    'The mini-tile composes the shared CardTile, so it resolves through ' + RESOLVER + ' and nowhere',
    '  else — W5\'s rule, on a smaller and denser surface where a require() would look right.',
    'And the row computes nothing. J1 put a real monthly total on this screen from the load engine,',
    '  which makes a remaining balance or a payoff figure tempting here: a number no engine produced,',
    '  on a surface, sitting next to one that did.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
