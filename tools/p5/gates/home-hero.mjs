/**
 * GATE: home-hero — criterion H1.  →  `HOME-HERO OK`
 *
 *   > **H1.** *"The Safe to commit hero renders income minus committed obligations this cycle minus
 *   > the configured buffer, and renders only when income exists — otherwise it says what is
 *   > missing."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SENTENCE DESCRIBES A SUBTRACTION AND DOES NOT SAY WHERE IT HAPPENS
 *
 * `W2` had the same shape and the answer was different: there the engine already published the
 * result, so the surface read a field. Here nothing publishes *"safe to commit"*, so the subtraction
 * genuinely has to happen — and the only question is where.
 *
 * Not on the screen. `J1` set the precedent for exactly this case: the cap's suggested value is
 * derived in `src/surfaces/`, the read seam, which is neither a screen nor an engine. A figure
 * derived on a surface is the recommendation logic `B1` forbids, and this one is a **recommendation
 * in the plainest sense** — it tells a user how much they may safely commit.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE BUFFER IS CONFIGURED, AND `0.1` IS NOT A NUMBER THIS CRITERION MAY WRITE
 *
 * `PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME` lives in `src/config/financial.ts`. A `0.1` written here
 * would be a second home for a figure that has one, and it would not move when the configured one
 * did — the same defect `J1` avoided with the 35% threshold, and the same one P2's `no-magic-numbers`
 * gate exists for.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "OTHERWISE IT SAYS WHAT IS MISSING" — NOT "SOMETHING IS MISSING"
 *
 * The seam already reports **why** each result is null, through `SurfaceEngineAbsence`. A hero that
 * rendered a generic "unavailable" would be throwing that away and telling the user less than the
 * app knows. And a hero that rendered `₪0` would be worse: zero safe-to-commit is a real and
 * alarming state, and it is not the same fact as *we do not know your income*.
 *
 * NEGATIVE CONTROL: render the hero with no income and watch it produce a figure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['H1'];
export const SENTINEL = 'HOME-HERO OK';
export const MEASURES = 'render';

const SEAM = 'src/surfaces/safeToCommit.ts';
const SEAM_SUITE = 'src/surfaces/__tests__/safeToCommit.test.ts';
const HERO = 'src/screens/home/HomeHero.tsx';
const SCREEN = 'src/screens/HomeScreen.tsx';
const SUITE = 'src/screens/home/__tests__/homeHero.render.test.tsx';
const CONFIG = 'src/config/financial.ts';
const JEST_CONFIG = 'jest.config.cjs';

const SEAM_CASES = [
  'subtracts the engine obligations and the configured buffer from income',
  'takes the buffer from configuration rather than a literal',
  'returns null when income is unknown',
];

const RENDER_CASES = [
  'renders the amount the seam derived',
  'renders an Estimate chip',
  'cannot render a Verified chip',
  'explains what the number is made of when tapped',
  'says what is missing when income is unknown',
  'renders no figure when income is unknown',
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
  for (const rel of [SEAM, SEAM_SUITE, HERO, SCREEN, SUITE, CONFIG]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — H1 has nothing to be about');
  }

  const seamSrc = stripComments(readFileSync(join(root, SEAM), 'utf8'));
  const heroSrc = stripComments(readFileSync(join(root, HERO), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. THE DERIVATION IS IN THE SEAM. */
  if (!/export function safeToCommitFrom/.test(seamSrc)) {
    problems.push(SEAM + ' exports no safeToCommitFrom — H1\'s subtraction has to happen somewhere, and the seam is where J1 put the same kind of derivation');
  }
  if (!/monthlyObligationsIls/.test(seamSrc)) {
    problems.push(SEAM + ' never reads load.current.monthlyObligationsIls — "committed obligations this cycle" is the engine\'s figure, not a sum of anything');
  }
  if (/[-+]\s*[A-Za-z0-9_.]*(obligation|buffer|income)/i.test(heroSrc)) {
    problems.push(
      HERO + ' does arithmetic on the screen. This figure tells a user how much they may safely commit — it is a '
        + 'recommendation in the plainest sense, and B1 puts it in the seam',
    );
  }

  /* 2. THE BUFFER IS CONFIGURED. */
  if (/0\.1\b/.test(seamSrc) || /0\.1\b/.test(heroSrc)) {
    problems.push(
      'a 0.1 literal appears. PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME lives in ' + CONFIG + '; a copy here is a second '
        + 'home that would not move when the configured one did',
    );
  }
  if (!/BUFFER/.test(seamSrc)) {
    problems.push(SEAM + ' does not read a configured buffer constant — H1 says "the configured buffer"');
  }

  /* 3. NO FIGURE WITHOUT INCOME, AND THE ABSENCE SAYS WHAT IS MISSING. */
  if (!/home-hero-absent/.test(heroSrc)) {
    problems.push(HERO + ' has no absent state — H1: it renders only when income exists, and otherwise SAYS WHAT IS MISSING');
  }
  if (!/absent|absence/i.test(heroSrc)) {
    problems.push(
      HERO + ' never consults the seam\'s absence reasons. A generic "unavailable" tells the user less than the app '
        + 'knows, and a ₪0 would be worse — zero safe-to-commit is a real and alarming state, and it is not the same '
        + 'fact as not knowing their income',
    );
  }

  /* 4. THE SCREEN SHOWS IT, AND STAYS PURE. B1's control was once fired on this very file. */
  if (!/HomeHero/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render HomeHero');
  }
  if (/from\s+'[^']*\/engines\//.test(heroSrc) || /from\s+'[^']*\/engines\//.test(screenSrc)) {
    problems.push('Home imports an engine directly (B1)');
  }

  /* 5. THE SUITE READS THE FIGURE FROM THE SEAM. */
  if (!/safeToCommitFrom/.test(suiteSrc)) {
    problems.push(SUITE + ' never calls safeToCommitFrom — a hardcoded expectation passes equally well against a hero that subtracted its own');
  }

  if (problems.length) return fail(problems.join(' · '));

  const seamCfg = projectConfig(root, 'unit', SEAM_SUITE);
  if (seamCfg.error) return fail(seamCfg.error);
  const seamRun = requireJestCases(root, SEAM_SUITE, SEAM_CASES, ['--config', JSON.stringify(seamCfg.config)]);
  if (seamRun.problems.length) return fail(seamRun.problems.join(' · '), seamRun.summary ?? undefined);

  const cfg = projectConfig(root, 'render', SUITE);
  if (cfg.error) return fail(cfg.error);
  const renderRun = requireJestCases(root, SUITE, RENDER_CASES, ['--config', JSON.stringify(cfg.config)]);
  if (renderRun.problems.length) return fail(renderRun.problems.join(' · '), renderRun.summary ?? undefined);

  for (const r of [seamRun, renderRun]) {
    if (!/Tests:\s+\d+ passed/.test(String(r.summary ?? ''))) {
      return fail('a suite reported no passing tests: ' + String(r.summary));
    }
  }

  return ok(SENTINEL, [
    'CRITERION H1 — Home\'s "Safe to commit" hero.',
    'W2 had this shape and the answer was different: there the engine already published the result,',
    '  so the surface read a field. Nothing publishes "safe to commit", so the subtraction genuinely',
    '  has to happen — and it happens in ' + SEAM + ', the read seam, exactly where J1 put the cap.',
    '  A figure telling a user how much they may safely commit is a recommendation in the plainest',
    '  sense, and B1 keeps those off the screen.',
    'The buffer comes from ' + CONFIG + '. No 0.1 anywhere: a copy would not move when the',
    '  configured one did.',
    'With no income there is no figure, and the hero says WHAT is missing rather than that something',
    '  is — the seam reports why each result is null and throwing that away tells the user less than',
    '  the app knows. A ₪0 would be worse: zero safe-to-commit is a real and alarming state, and it',
    '  is not the same fact as not knowing their income.',
    SEAM_CASES.length + ' seam case(s) · ' + seamRun.summary,
    RENDER_CASES.length + ' render case(s) required BY NAME · ' + renderRun.summary,
  ].join('\n'));
};
