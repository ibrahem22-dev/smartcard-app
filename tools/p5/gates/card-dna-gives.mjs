/**
 * GATE: card-dna-gives — criterion N5.  →  `CARD-DNA-GIVES OK`
 *
 *   > **N5.** *"Section B renders benefits tagged card versus club, cashback and discount values,
 *   > and reward earn rates but never balances; an evidenced empty state is a first-class correct
 *   > render tested by name; and every benefit image resolves through the P4 media resolver."*
 *
 * MEASURES: 'render'. Every clause is about what the panel puts on screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE VACUITY TRAP, AND IT IS NOT HYPOTHETICAL HERE
 *
 * `src/authority/noSource.ts` ships `EMPTY_BENEFITS_DB` — *"an EMPTY benefits database, not a
 * missing one"* — and eleven of seventeen institutions carry zero benefit-linked cards. So **the
 * evidenced empty state is today's render for every card in the product**, not an edge case.
 *
 * That makes a panel which renders the empty state *unconditionally* satisfy most of N5 by
 * accident: no benefit is rendered untagged, no value is rendered wrong, and no balance appears,
 * because nothing appears. §2 rule 5 refuses a check over zero items, and this is that check with a
 * plausible excuse attached. So the suite is required to exercise **both directions** — a populated
 * database whose rows actually render, and an empty one — and this gate names the cases for each.
 *
 * It is the same shape as `D-015`: the population is not empty, the *effect* is.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NO BENEFIT EVIDENCED" IS A DIFFERENT SENTENCE FROM "THIS CARD HAS NO BENEFITS"
 *
 * Roadmap §4 domain 17 calls the first *a correct render*. The second is a claim about the world
 * that the app has no basis for: an empty benefits database is a statement about our evidence, not
 * about the card. A panel that says the card has none would be converting an absence of data into
 * an assertion — the same defect as §A printing `₪0` for a fee nobody knows.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NEVER A BALANCE, AND THIS GATE IS THE "V2-PLUS SCOPE GATE" THE CONTRACT NAMES
 *
 * N5's declared negative control is *"render a reward balance and watch the V2-plus scope gate
 * refuse it."* There is no separately-named scope gate; the phrase describes whichever gate
 * enforces the V2+ boundary for the criterion at hand, and for N5 that is this one. Spec §11 says
 * earn rates and never balances; §19 feature 55 puts manual balance entry in V2+; the contract's
 * deferral table cites both. So a balance reaching this panel fails here.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE MEDIA TIERS ARE THE APP'S OWN, AND P5 COLLECTS NOTHING
 *
 * §8: *"benefit imagery on this panel resolves through the P4 media resolver at its app-owned
 * tiers — category artwork or the generic benefit fallback — because the Media Enrichment Campaign
 * has not launched and P5 collects nothing. P5 may not fetch an image and may not write
 * `rightsDecidedBy`."* So the panel calls `resolveMedia`, and it may not carry a URL, a fetch, or a
 * rights decision. Writing `rightsDecidedBy` would be P5 recording a clearance nobody made.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N5'];
export const SENTINEL = 'CARD-DNA-GIVES OK';
export const MEASURES = 'render';

const ROWS = 'src/screens/cardDna/benefitRows.ts';
const SECTION = 'src/screens/cardDna/SectionBGives.tsx';
const SCREEN = 'src/screens/cardDna/CardDnaScreen.tsx';
const SUITE = 'src/screens/cardDna/__tests__/cardDnaGives.render.test.tsx';
const RESOLVER = 'src/media/resolveMedia.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  /* The empty direction — a correct render, not a fallback. */
  'renders the evidenced empty state when no benefit is evidenced for this card',
  'says no benefit is evidenced rather than that the card has none',
  /* The populated direction — without these the four above are vacuous. */
  'renders every benefit the database evidences for this card',
  'tags each benefit as card or club',
  'renders cashback and discount values as percentages',
  'renders no reward balance anywhere in the panel',
  'resolves every benefit image through the media resolver at an app-owned tier',
];

/** V2+. Spec §11 "never balances"; §19 feature 55; the contract's deferral table. */
const BALANCE_WORDS = /\b(pointsBalance|rewardBalance|balancePoints|milesBalance|יתרת נקודות)\b/i;

/** P5 collects nothing: no fetch, no URL, no clearance decision. */
const COLLECTION_WORDS = /\b(rightsDecidedBy|fetch\s*\(|https?:\/\/|imageUrl|artworkUrl)\b/;

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
  for (const rel of [ROWS, SECTION, SCREEN, SUITE, RESOLVER]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N5 has nothing to be about');
  }

  const rowsSrc = stripComments(readFileSync(join(root, ROWS), 'utf8'));
  const sectionSrc = stripComments(readFileSync(join(root, SECTION), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. NEVER A BALANCE — this gate is N5's "V2-plus scope gate". */
  for (const f of [{ n: ROWS, s: rowsSrc }, { n: SECTION, s: sectionSrc }]) {
    const hit = f.s.match(BALANCE_WORDS);
    if (hit) {
      problems.push(
        f.n + ' names "' + hit[0] + '". Spec §11 is earn rates and NEVER balances — a reward balance '
          + 'is unknowable locally, and manual balance entry is feature 55, V2+',
      );
    }
  }

  /* 2. THE RESOLVER, AND NOTHING P5 IS NOT ALLOWED TO DO. */
  if (!/resolveMedia/.test(sectionSrc)) {
    problems.push(SECTION + ' does not call resolveMedia — §8 requires every benefit image to resolve through the P4 resolver, at the app-owned tiers');
  }
  for (const f of [{ n: ROWS, s: rowsSrc }, { n: SECTION, s: sectionSrc }]) {
    const hit = f.s.match(COLLECTION_WORDS);
    if (hit) {
      problems.push(
        f.n + ' carries "' + hit[0].trim() + '". The Media Enrichment Campaign has not launched and P5 '
          + 'collects nothing: it may not fetch an image, may not carry a URL, and may not write '
          + 'rightsDecidedBy, which would be recording a clearance nobody made',
      );
    }
  }

  /* 3. THE ROWS ARE DERIVED IN ONE PLACE, and the section renders what it is given. */
  if (!/export function benefitRowsFor/.test(rowsSrc)) {
    problems.push(ROWS + ' exports no benefitRowsFor — the rows must be derived in one place, not inside the component');
  }
  if (!/benefitRowsFor/.test(sectionSrc)) {
    problems.push(SECTION + ' does not call benefitRowsFor — a section deriving its own rows is a second derivation');
  }
  if (/\bissuers\b\s*\[/.test(sectionSrc) || /\.clubs\b/.test(sectionSrc)) {
    problems.push(SECTION + ' walks the benefits database itself. That walk belongs in ' + ROWS + ' — the component renders rows');
  }

  /* 4. SECTION B IS ACTUALLY REACHED. */
  if (!/SectionBGives/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render SectionBGives — the panel exists and section B is still empty');
  }

  /* 5. NO COMPUTATION ON THE SURFACE (B1, and this panel has percentages in it). */
  if (/from\s+'[^']*\/engines\//.test(sectionSrc) || /from\s+'[^']*\/engines\//.test(rowsSrc)) {
    problems.push('section B reaches an engine directly — surfaces read through src/surfaces/ (B1)');
  }

  /*
   * 6. THE SUITE MUST SEE A POPULATED DATABASE. Without this the whole criterion is satisfied by a
   *    panel that renders the empty state unconditionally — which is what the product does today.
   */
  if (!/EMPTY_BENEFITS_DB|issuers:\s*\{\s*\}/.test(suiteSrc)) {
    problems.push(SUITE + ' never exercises an empty benefits database — the evidenced empty state is a first-class render and must be tested as one');
  }
  const populated = /issuers:\s*\{\s*[^}]/.test(suiteSrc) || /benefits:\s*\[\s*\{/.test(suiteSrc);
  if (!populated) {
    problems.push(
      SUITE + ' never builds a POPULATED benefits database. The app ships EMPTY_BENEFITS_DB, so a panel that '
        + 'always renders the empty state would satisfy most of N5 by rendering nothing at all — the §2 rule 5 '
        + 'vacuous pass, wearing a plausible excuse',
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
    'CRITERION N5 — Card DNA §B, "what it gives me".',
    'The evidenced empty state is a FIRST-CLASS render and is tested as one: the app ships',
    '  EMPTY_BENEFITS_DB and eleven of seventeen institutions carry no benefit-linked cards, so it is',
    '  today\'s render for every card — which is exactly why the suite also exercises a POPULATED',
    '  database. A panel that always rendered nothing would satisfy most of this criterion by',
    '  rendering nothing (§2 rule 5, D-015\'s shape).',
    'And it says NO BENEFIT IS EVIDENCED, not that the card has none — the first is a statement about',
    '  our evidence, the second a claim about the world we have no basis for.',
    'Benefits are tagged card or club, values render as percentages, and no reward balance appears:',
    '  spec §11 is earn rates and never balances, and this gate is the V2-plus scope gate N5 names.',
    'Every image resolves through ' + RESOLVER + ' at the app-owned tiers. No fetch, no URL, and no',
    '  rightsDecidedBy — P5 collects nothing and may not record a clearance nobody made.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
