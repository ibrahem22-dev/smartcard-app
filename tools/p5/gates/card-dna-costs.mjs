/**
 * GATE: card-dna-costs — criterion N2.  →  `CARD-DNA-COSTS OK`
 *
 *   > **N2.** *"Section A renders the six named cost rows, each carrying a value, a provenance chip
 *   > from the adapter's vocabulary and a pencil affordance, with Unknown rendered as the quiet
 *   > 'Add this' affordance and never as a fake number."*
 *
 * MEASURES: 'render'. Every clause is about what reaches the screen. In particular the last one —
 * *never as a fake number* — cannot be read out of source at all: a resolver that returns 0 and a
 * resolver that returns "unknown" are the same three lines until something renders them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CHIP VOCABULARY IS THE ADAPTER'S, AND THIS GATE READS IT FROM THE ADAPTER
 *
 * Contract §8: the chip vocabulary is *"the adapter's four states, never a local restatement"*, and
 * §25 records why the wording matters — *"USER REPORT → Your value"*, because *"'USER REPORT' is a
 * community concept that does not exist in this product."* A gate that hard-coded the four names
 * would be a fifth restatement of the vocabulary, in the one file nobody would think to check when
 * the adapter changed. So the names come from `src/authority/provenanceChip.ts`, and a chip the
 * section renders that the adapter does not know **fails**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SIX ROWS ARE THE CRITERION; EVERYTHING ELSE IS DERIVED
 *
 * As with N1: §2 rule 4 forbids hand-listed populations, not hand-written criteria. Which six rows
 * §A carries is what N2 says, so the six ids live here and are compared against the app's
 * declaration. How many rows render, what each is called, which have values — all read from the app.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CLAUSE THIS GATE EXISTS FOR
 *
 * `src/types/card.types.ts` declares `annualFee` and `foreignTransactionFee` as **non-optional
 * numbers**. A card with no known annual fee and a card with a genuinely free annual fee are the
 * same object. The tempting render — `₪0` — is a fake number in exactly N2's sense, and it is
 * tempting precisely because it looks like data rather than like a guess.
 *
 * So the suite must carry a case that builds a zero-fee card and proves the row does not print a
 * formatted zero, and this gate requires that case BY NAME. A section that quietly starts printing
 * ₪0 will fail here rather than at whatever point a user tells us their card is not free.
 *
 * NEGATIVE CONTROL (contract §8 N2): render one cost row with no provenance chip and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N2'];
export const SENTINEL = 'CARD-DNA-COSTS OK';
export const MEASURES = 'render';

const ROWS = 'src/screens/cardDna/costRows.ts';
const SECTION = 'src/screens/cardDna/SectionACosts.tsx';
const SCREEN = 'src/screens/cardDna/CardDnaScreen.tsx';
const SUITE = 'src/screens/cardDna/__tests__/cardDnaCosts.render.test.tsx';
const VOCAB = 'src/authority/provenanceChip.ts';
const CHIP_COMPONENT = 'src/components/ProvenanceChip.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** N2's six rows, in the order contract §8 names them. The one hand-written thing here. */
const SIX_ROWS = ['annual-fee', 'monthly-fee', 'fx-commission', 'foreign-atm-fee', 'interest-rates', 'other-costs'];

const REQUIRED_CASES = [
  'renders all six cost rows in the declared order',
  'renders a provenance chip from the adapter vocabulary on every known row',
  'renders Add this instead of a number when the value is not known',
  'renders no chip on a row that has no value',
  'renders a pencil on every row including the unknown ones',
  'renders no zero for a fee the card type cannot distinguish from unknown',
  'renders the annual fee as a value when the card carries a non-zero one',
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
  for (const rel of [ROWS, SECTION, SCREEN, SUITE, VOCAB, CHIP_COMPONENT]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N2 has nothing to be about');
  }

  const rowsSrc = stripComments(readFileSync(join(root, ROWS), 'utf8'));
  const sectionSrc = stripComments(readFileSync(join(root, SECTION), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const vocabSrc = readFileSync(join(root, VOCAB), 'utf8');
  const problems = [];

  /* 1. THE VOCABULARY, READ FROM THE ADAPTER. Never restated here. */
  const chips = (vocabSrc.match(/PROVENANCE_CHIPS\s*=\s*\[([^\]]*)\]/) ?? [])[1];
  const vocabulary = chips ? [...chips.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]) : [];
  if (vocabulary.length === 0) {
    return fail(VOCAB + ' yielded no PROVENANCE_CHIPS — the chip vocabulary could not be read from the adapter, so "from the adapter\'s vocabulary" cannot be checked at all');
  }

  /* 2. THE SIX ROWS, DECLARED AS DATA, IN §8's ORDER. */
  const declared = [...rowsSrc.matchAll(/\bid:\s*'([a-z-]+)'/g)].map((m) => m[1]);
  if (declared.length === 0) {
    return fail(ROWS + ' declares no cost rows — a sweep over zero rows is the vacuous pass §2 rule 5 refuses');
  }
  if (declared.join(',') !== SIX_ROWS.join(',')) {
    problems.push(ROWS + ' declares [' + declared.join(', ') + '] but N2 names six rows in this order: [' + SIX_ROWS.join(', ') + ']');
  }

  /* Every row needs a label the section actually renders, and a testID the suite can find. */
  const rowName = (rowsSrc.match(/export const ([A-Z_0-9]+)\s*:\s*readonly/) ?? [])[1];
  for (const id of declared) {
    const row = rowsSrc.match(new RegExp("id:\\s*'" + id + "'[^}]*}", 's'));
    if (!row) continue;
    const key = (row[0].match(/labelKey:\s*'([^']+)'/) ?? [])[1];
    if (!key) problems.push('row ' + id + ' declares no labelKey');
    else if (!sectionSrc.includes("t('" + key + "')")) {
      problems.push(
        'row ' + id + " declares labelKey '" + key + "' and " + SECTION + " never renders it as a literal t('" + key
          + "') — a declared label the screen does not use is a second home for one string with nothing comparing them",
      );
    }
    if (!/testID:\s*'[^']+'/.test(row[0])) problems.push('row ' + id + ' declares no testID');
  }

  /* 3. THE SECTION MAPS THE DECLARATION, so a row cannot reach the screen without reaching the list. */
  if (!rowName) {
    problems.push(ROWS + ' exports no readonly row list — the section has no single declaration to map');
  } else if (!new RegExp(rowName + '\\s*\\.\\s*map\\s*\\(').test(sectionSrc)) {
    problems.push(SECTION + ' does not map over ' + rowName + '. Six hand-written rows agree with the declaration exactly until one of them changes');
  }

  /* 4. THE CHIP COMES FROM THE SHARED COMPONENT, not a local badge with its own words. */
  if (!/\bProvenanceChip\b/.test(sectionSrc)) {
    problems.push(SECTION + ' does not use the shared ProvenanceChip — §8 requires the adapter\'s vocabulary, and a locally drawn badge is the "local restatement" the contract names');
  }

  /* A chip name the adapter does not know is a fifth vocabulary, wherever it was spelled. */
  for (const m of sectionSrc.matchAll(/chip:\s*'([A-Z_]+)'/g)) {
    if (!vocabulary.includes(m[1])) {
      problems.push(SECTION + " names chip '" + m[1] + "', which is not one of the adapter's " + vocabulary.length + ': ' + vocabulary.join(', '));
    }
  }

  /* 5. SECTION A ACTUALLY CARRIES IT. The rows can be perfect and unreachable. */
  if (!/SectionACosts/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render SectionACosts — the rows exist and section A is still empty');
  }

  /* 6. NO COMPUTATION HERE. B1 polices the surface, but a cost row is where the temptation lives. */
  if (/from\s+'[^']*\/engines\//.test(sectionSrc)) {
    problems.push(SECTION + ' imports an engine directly — surfaces read through src/surfaces/ (B1)');
  }

  if (problems.length) return fail(problems.join(' · '));

  /* 7. AND THE RENDERED TREE. The zero-fee case is required by name because it is the one that
        cannot be read from source: a resolver returning 0 and one returning unknown look alike. */
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
    ROWS + ' declares the six cost rows N2 names, in §8\'s order:',
    ...declared.map((id) => '  · ' + id),
    SECTION + ' maps ' + rowName + ' and renders every declared label as a literal t() call.',
    'Chips come from the shared ProvenanceChip and from the adapter\'s vocabulary, read at check',
    '  time from ' + VOCAB + ': ' + vocabulary.join(', ') + '.',
    'A row whose value is not known renders the quiet "Add this" affordance and keeps its pencil.',
    'And a card whose annualFee is 0 renders NO formatted zero — the case is required by name',
    '  because card.types.ts cannot tell a free annual fee from an unknown one, which makes ₪0 the',
    '  most plausible-looking wrong answer on this screen.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
