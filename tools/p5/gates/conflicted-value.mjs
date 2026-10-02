/**
 * GATE: conflicted-value — criterion N9.  →  `CONFLICTED-VALUE OK`
 *
 *   > **N9.** *"A conflicted section A row renders the shared `ConflictedValue`: every competing
 *   > value with its scope verbatim from the source and its tappable source, one neutral header,
 *   > ordered newest source first and saying so, amber, with no default selection and no
 *   > most-likely badge; the pencil still resolves it to 'Your value'."*
 *
 * MEASURES: 'render'. Every clause is about what a conflicted row puts on screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * READ D-016 BEFORE TRUSTING THE LAST LINE OF THIS OUTPUT
 *
 * **P2's criterion `A3` prints the identical sentinel**, from
 * `tools/p2/gates/conflicted-value.mjs`. Same string, different criterion, different campaign. The
 * sentinel is contract text inside the ```criteria fence, so P5 cannot rename it — §18 — and every
 * consumer that keys on the sentinel alone (the control receipts, the worker review's paste check,
 * the ledger) would accept A3's output as N9's.
 *
 * So the body below names Card DNA §A, the inline substitution, the ordering claim and the pencil
 * clause. P2's gate cannot produce those sentences. A reviewer comparing two outputs can tell them
 * apart on the second line even though the last one matches.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT A3 ALREADY PROVES, AND WHY THIS GATE MUST NOT RE-PROVE IT
 *
 * A3 establishes that `ConflictedValue` is **one shared component**, that it renders every competing
 * reading with scope and source, amber, with no winner and no default selection — and, the part
 * that matters most, that **no other file in the tree renders a conflict**. That is P2's, it is
 * closed, and re-measuring it here would be P5 re-litigating a closed phase (§1.2).
 *
 * N9 is the delta, and the delta is entirely about **Card DNA §A**:
 *
 *   · the component renders **in place of the single figure** — spec §11-A's words — so a
 *     conflicted row shows no value and no provenance chip, because nothing has won;
 *   · each scope appears **verbatim from the source**, not re-worded, title-cased or truncated;
 *   · the source is **tappable**;
 *   · the candidates are ordered **newest source first**, and the row **says so** — a list that
 *     happens to be sorted and a list that tells the reader it is sorted are different artefacts;
 *   · **the pencil survives**. A conflicted row is the row a user most needs to settle, and N3's
 *     writer is how they settle it. A conflict that could not be resolved would be a dead end
 *     wearing an explanation.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ORDERING LIVES IN THE RESOLUTION MODULE
 *
 * "Newest source first" is a rule about data, and a screen that sorts its own candidates is a screen
 * holding a rule. B1 forbids that in general; here it also splits the rule from `readCardCost`,
 * which is the one place a §A value is decided. So the sort must be visible in
 * `cardCostResolution.ts` and absent from the section.
 *
 * NEGATIVE CONTROL (contract §8.2 N9): render only the newer of two competing values and watch
 * this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N9'];
export const SENTINEL = 'CONFLICTED-VALUE OK';
export const MEASURES = 'render';

const RESOLUTION = 'src/store/cardCostResolution.ts';
const SECTION = 'src/screens/cardDna/SectionACosts.tsx';
const SUITE = 'src/screens/cardDna/__tests__/cardDnaConflict.render.test.tsx';
const COMPONENT = 'src/components/ConflictedValue.tsx';
const AUTHORITY = 'src/authority/authorityValue.ts';
/** Where the envelope becomes an ordered ConflictAuthority — the one home A3 permits (D-017). */
const CONFLICT_BUILDER = 'src/authority/cardCostConflict.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders ConflictedValue in place of the single figure on a conflicted row',
  'renders every competing value, not just the newest',
  'renders each candidate scope verbatim as the source gave it',
  'renders the sources newest first and says that is the order',
  'renders no most-likely badge and preselects nothing',
  'keeps the pencil on a conflicted row so the user can settle it',
  'replaces the conflict with Your value once the user saves',
];

/** Words that would smuggle a winner back in. §8.2 and OD-9: no default, no most-likely. */
const WINNER_WORDS = /\b(mostLikely|bestGuess|recommended|preferredCandidate|defaultCandidate|winner|likeliest)\b/i;

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
  for (const rel of [RESOLUTION, SECTION, SUITE, COMPONENT, AUTHORITY]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N9 has nothing to be about');
  }

  const resolutionSrc = stripComments(readFileSync(join(root, RESOLUTION), 'utf8'));
  const sectionSrc = stripComments(readFileSync(join(root, SECTION), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. THE SHARED COMPONENT, and no locally drawn substitute for it. A3 and OD-9 both. */
  if (!/\bConflictedValue\b/.test(sectionSrc)) {
    problems.push(SECTION + ' never renders ConflictedValue — N9 is the INLINE RENDER, and a §A that cannot show a conflict is the "per-screen bespoke logic" OD-9 refuses');
  }
  if (!/from\s+'[^']*\/components\/ConflictedValue'/.test(sectionSrc)) {
    problems.push(SECTION + ' does not import the shared component from ' + COMPONENT);
  }

  /* 2. THE CONFLICT TYPE IS THE AUTHORITY LAYER'S. A second conflict shape is a second vocabulary. */
  if (!/ConflictAuthority/.test(resolutionSrc)) {
    problems.push(RESOLUTION + ' does not use ConflictAuthority from ' + AUTHORITY + ' — a private conflict shape is the second vocabulary §2.2 warns about');
  }
  if (!/kind:\s*'conflict'/.test(resolutionSrc)) {
    problems.push(RESOLUTION + ' has no conflict reading — readCardCost is the one place a §A value is decided, so a conflict that is not a reading cannot reach the row');
  }

  /*
   * 3. THE ORDERING LIVES IN THE AUTHORITY LAYER, AND THREE OF THE FOUR HOMES ARE FORBIDDEN.
   *
   * D-017. This gate first required the sort in cardCostResolution.ts, and that instruction walked
   * P5 straight into a closed phase's tripwire: P2's A3 refuses any read of a conflict's
   * `.candidates` outside the component, with one carve-out its own gate spells out — *"The
   * authority layer itself constructs and folds them — that is its job."* A3 also refuses to let
   * the COMPONENT sort, because *"ordering candidates is ranking them, and the top row reads as
   * the answer."* So the screen may not, the store may not, and the component may not.
   *
   * The two criteria only looked opposed. A3 guards against ranking by PLAUSIBILITY; N9 orders by
   * RECENCY and makes the row say so, which is what stops the top row reading as an argument.
   * Applying it at construction, in the authority layer, satisfies both without touching either.
   */
  const authoritySrc = existsSync(join(root, CONFLICT_BUILDER))
    ? stripComments(readFileSync(join(root, CONFLICT_BUILDER), 'utf8'))
    : null;
  if (authoritySrc === null) {
    problems.push(CONFLICT_BUILDER + ' does not exist — the newest-first ordering has nowhere to live that A3 permits (D-017)');
  } else if (!(/\.sort\s*\(/.test(authoritySrc) && /observedAt/.test(authoritySrc))) {
    problems.push(CONFLICT_BUILDER + ' does not order candidates by observedAt — "newest source first" is applied at construction, the one place A3 allows candidates to be handled');
  }
  for (const f of [{ n: RESOLUTION, s: resolutionSrc }, { n: SECTION, s: sectionSrc }]) {
    if (/\.candidates\b/.test(f.s)) {
      problems.push(f.n + " reads a conflict's .candidates. P2's A3 fails on that anywhere outside the component and the authority layer, and A3 belongs to a CLOSED phase — see D-017");
    }
    if (/\.sort\s*\(/.test(f.s)) {
      problems.push(f.n + ' sorts candidates. The ordering is applied once, at construction, in ' + CONFLICT_BUILDER);
    }
  }

  /* 4. NO WINNER SMUGGLED BACK IN, at either end. */
  for (const f of [{ n: RESOLUTION, s: resolutionSrc }, { n: SECTION, s: sectionSrc }]) {
    const hit = f.s.match(WINNER_WORDS);
    if (hit) {
      problems.push(f.n + ' names "' + hit[0] + '" — N9 forbids a most-likely badge and a default selection, and A3 forbids a winner. Preserving every candidate is the whole point of showing a conflict');
    }
  }

  /* 5. IN PLACE OF THE SINGLE FIGURE. A conflicted row shows no value and no chip: if a figure
        still renders beside the conflict, the row has quietly picked one after all. */
  if (!/-conflict/.test(sectionSrc)) {
    problems.push(SECTION + ' gives the conflict no testID of its own, so nothing can assert it replaced the figure rather than joining it');
  }

  /* 6. THE PENCIL SURVIVES. Checked in the suite by name too, but stated here because a conflicted
        row that cannot be settled is the failure a reader is least likely to look for. */
  if (!/pencil/.test(sectionSrc)) {
    problems.push(SECTION + ' no longer renders a pencil affordance at all');
  }

  /* 7. THE SUITE MUST NOT BE P2's. D-016: the sentinels are identical, so the temptation to cite
        A3's evidence here is real and would look exactly like a pass. */
  if (/components\/__tests__\/ConflictedValue/.test(suiteSrc)) {
    problems.push(SUITE + " reaches into P2's ConflictedValue suite. A3 proves the component; N9 proves Card DNA §A renders it. Borrowing the first as the second is what D-016 exists to warn about");
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
    'CRITERION N9 — Card DNA §A renders the shared ConflictedValue INLINE.',
    '  (P2\'s A3 prints this same sentinel from tools/p2/gates/. See D-016: the string is contract',
    '   text and cannot be renamed, so read these lines, not the last one, to know which gate ran.)',
    '',
    'A conflicted §A row renders ' + COMPONENT + ' IN PLACE OF the single figure — spec §11-A —',
    '  so it shows no value and no provenance chip, because nothing has won.',
    'Every competing value survives, each scope appears verbatim as the source gave it, and the',
    '  source is tappable.',
    'Candidates are ordered newest-source-first in ' + CONFLICT_BUILDER + ' — at construction, in',
    '  the authority layer, which A3 names as the one place candidates may be handled at all (D-017),',
    '  and the row SAYS that is the order — a list that happens to be sorted and a list that tells',
    '  the reader it is sorted are different artefacts.',
    'No most-likely badge, no default selection, nothing preselected.',
    'And the pencil survives: a conflicted row is the one a user most needs to settle, so N3\'s',
    '  writer still turns it into "Your value".',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
