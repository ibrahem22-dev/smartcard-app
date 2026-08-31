/**
 * GATE: card-dna-layout — criterion N1.  →  `CARD-DNA-LAYOUT OK`
 *
 *   > **N1.** *"Card DNA renders the header then sections A, B, C and D in spec §11's fixed order."*
 *
 * MEASURES: 'render'. The claim is about what the screen PUTS ON SCREEN and in what order, and a
 * source read cannot tell a section that renders from a section that is declared and then dropped
 * by a condition nobody noticed. So the order is measured in a rendered tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ORDER IS THE CRITERION, SO THE GATE HOLDS IT — AND NOTHING ELSE IS HAND-LISTED
 *
 * Contract §2 rule 4 forbids hand-listed POPULATIONS, not hand-written criteria. A B C D in that
 * sequence is what N1 says; spec §25 records the four-question model as *"the permanent Card Detail
 * architecture"*, and a gate that read the order out of the screen it is checking would agree with
 * any order the screen happened to have. So the four ids live here, and everything else — which
 * sections exist, what each is called, how many there are — is read from the app's own declaration.
 *
 * The three-way check that makes that worth something:
 *
 *   1. the DECLARATION lists exactly the four sections N1 names, in N1's order;
 *   2. the SCREEN renders them by mapping that declaration, not as four hand-written blocks — so a
 *      fifth section cannot appear on screen without appearing in the declaration first;
 *   3. the RENDERED TREE puts the header before section A and the four sections in the declared
 *      order, proved by a suite whose cases are required BY NAME.
 *
 * Without (2), (1) and (3) can both pass while the screen renders whatever it likes: the declaration
 * becomes decoration, and the render test proves only that four particular testIDs happen to be in
 * order today. That is the *two homes, no comparison* failure this campaign has already paid for
 * six times in one day.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY AN EMPTY SECTION PASSES AND A PLACEHOLDER DOES NOT
 *
 * WP-2.1 ships the shell; §A's rows are WP-2.2 and §B, §C, §D are PHASE-3. An empty section
 * container is therefore the correct render at this criterion, and N1 says nothing about contents.
 * A *placeholder* is a different thing — B2 requires that no P5 route reaches one — so this gate
 * refuses the words that turn an honest empty container into a shipped promise.
 *
 * NEGATIVE CONTROL: reorder two sections in the declaration and watch the rendered order disagree.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N1'];
export const SENTINEL = 'CARD-DNA-LAYOUT OK';
export const MEASURES = 'render';

const DECL = 'src/screens/cardDna/sections.ts';
const SCREEN = 'src/screens/cardDna/CardDnaScreen.tsx';
const SUITE = 'src/screens/cardDna/__tests__/cardDnaLayout.render.test.tsx';
const STACK = 'src/navigation/stacks/WalletStack.tsx';
/**
 * OQ-MDC-005 (Owner, option 2): the surface that now holds the M4 editing behaviour. Clause 4
 * used to name the CardEdit ROUTE; it names the EDITOR now, and this is where the editor lives.
 */
const EDITOR = 'src/screens/cardDna/SectionACosts.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** N1's order, and the one thing in this gate that is not read from the app. */
const SPEC_11_ORDER = ['a', 'b', 'c', 'd'];

/** What each section is, so a mis-ordered declaration can be named rather than just counted. */
const SECTION_MEANING = {
  a: 'what it costs me',
  b: 'what it gives me',
  c: "when it's best to use",
  d: "what's active right now",
};

const REQUIRED_CASES = [
  'renders the header before section A',
  'renders all four sections in spec section 11 order',
  'renders every section the declaration lists, and no others',
  'renders a content container for every section the declaration lists',
  'renders no placeholder text in any section container',
];

/** Words that turn an honest empty container into a shipped promise (B2's territory). */
const PLACEHOLDER_WORDS = /\b(coming soon|not yet|placeholder|todo|tbd|under construction|בקרוב)\b/i;

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
  for (const rel of [DECL, SCREEN, SUITE, STACK]) {
    if (!existsSync(join(root, rel))) {
      return fail(rel + ' does not exist — N1 has nothing to be about');
    }
  }

  const declSrc = stripComments(readFileSync(join(root, DECL), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const stackSrc = stripComments(readFileSync(join(root, STACK), 'utf8'));
  const editorSrc = stripComments(readFileSync(join(root, EDITOR), 'utf8'));
  const problems = [];

  /* 1. THE DECLARATION — exactly the four sections N1 names, in N1's order. */
  const declared = [...declSrc.matchAll(/\bid:\s*'([a-z]+)'/g)].map((m) => m[1]);
  if (declared.length === 0) {
    return fail(DECL + ' declares no section ids — a layout check over zero sections is the vacuous pass §2 rule 5 refuses');
  }
  if (declared.join(',') !== SPEC_11_ORDER.join(',')) {
    problems.push(
      DECL + ' declares [' + declared.join(', ') + '] but spec §11 fixes the order as ['
        + SPEC_11_ORDER.map((id) => id + ' (' + SECTION_MEANING[id] + ')').join(', ') + ']',
    );
  }

  /*
   * Every section must carry a title key and a testID — AND THE SCREEN MUST ACTUALLY RENDER THAT
   * KEY. The first version of this gate checked only that a titleKey was declared, and the shell it
   * passed declared four of them and rendered none: the titles came from a switch on the section id
   * with its own literal strings. Both spellings agreed on the day, and nothing compared them, so
   * editing sections.ts would have changed a value no screen reads.
   *
   * That is the failure mode this campaign has paid for more than any other, and it does not
   * announce itself — a dead field looks exactly like a live one. The screen has to keep using
   * literal t('...') calls, because t(variable) is invisible to the i18n coverage test and falls
   * back to Hebrew, so the fix is not to interpolate the key. It is to require that every key the
   * declaration names appears as a literal argument to t() in the screen.
   */
  for (const id of declared) {
    const row = declSrc.match(new RegExp("id:\\s*'" + id + "'[^}]*}", 's'));
    if (!row) continue;
    const key = (row[0].match(/titleKey:\s*'([^']+)'/) ?? [])[1];
    if (!key) problems.push('section ' + id + ' declares no titleKey');
    else if (!screenSrc.includes("t('" + key + "')")) {
      problems.push(
        'section ' + id + " declares titleKey '" + key + "' and " + SCREEN + " never renders it as a literal t('" + key
          + "') — the declaration names a title the screen does not use, so the two can drift with nothing comparing them",
      );
    }
    if (!/testID:\s*'[^']+'/.test(row[0])) problems.push('section ' + id + ' declares no testID');
  }

  /* 2. THE SCREEN MAPS THE DECLARATION. Without this the declaration is decoration: a section could
        reach the screen without ever reaching the list, and both the other checks would still pass. */
  const declName = (declSrc.match(/export const ([A-Z_0-9]+)\s*:\s*readonly/) ?? [])[1];
  if (!declName) {
    problems.push(DECL + ' exports no readonly section list — the screen has no single declaration to map');
  } else {
    if (!new RegExp('\\b' + declName + '\\b').test(screenSrc)) {
      problems.push(SCREEN + ' never references ' + declName + ' — it does not render from the declaration, so the declaration constrains nothing');
    }
    if (!new RegExp(declName + '\\s*\\.\\s*map\\s*\\(').test(screenSrc)) {
      problems.push(SCREEN + ' does not map over ' + declName + '. Four hand-written blocks satisfy the order today and stop agreeing with the declaration the first time either changes — that is two homes for one fact with nothing comparing them');
    }
  }

  /* 3. NO PLACEHOLDER. An empty section is correct at N1; a promise is B2's problem. */
  if (PLACEHOLDER_WORDS.test(screenSrc)) {
    problems.push(SCREEN + ' contains placeholder wording — an EMPTY section container is the correct render for a section a later package fills, but a "coming soon" is a placeholder on a live P5 route (B2)');
  }

  /* 4. THE EDITOR IS REACHABLE. What M4 protects is that a card fee can still be edited.

        PD-P5-011 kept the legacy form at CardEdit for a stated reason — "until N3's pencil
        exists, so no card fee becomes uneditable for the length of two packages" — and this
        clause used to enforce the ROUTE NAME rather than the behaviour. N3's pencil has since
        shipped, so the precondition is discharged and the route name became a thing that was
        true rather than a thing that mattered: enforcing it forced the MDC's C11 either to
        leave a dead legacy screen mounted or to break this gate.

        Repaired under Owner ruling OQ-MDC-005 option 2, as a named exception to the P5
        boundary: "assert that the fee editor remains reachable through a valid route, without
        weakening M4's protected editing behavior". So it asserts the chain a user actually
        walks — Wallet routes CardDetail to Card DNA, Card DNA renders section A, and section A
        carries an editor that opens and saves. That is strictly stronger than the old check:
        a route named CardEdit could exist while leading nowhere, and did. */
  if (!/CardDnaScreen/.test(stackSrc)) {
    problems.push(STACK + ' does not render CardDnaScreen — the shell exists but nothing reaches it');
  }
  if (!/['"]CardDetail['"]/.test(stackSrc)) {
    problems.push(STACK + ' no longer routes CardDetail — Card DNA is the M4 destination and nothing reaches it');
  }
  const editorOpens = /onPress=\{[^}]*openEditor\(/.test(editorSrc);
  const editorSaves = /saveDraft\s*\(/.test(editorSrc);
  if (!editorOpens || !editorSaves) {
    problems.push(
      EDITOR + ' no longer carries a reachable fee editor (' +
      [editorOpens ? null : 'nothing opens it', editorSaves ? null : 'nothing saves it'].filter(Boolean).join(', ') +
      '). M4 protects the EDITING BEHAVIOUR, not a route name: if the pencil stops opening or stops saving, a card fee becomes uneditable exactly as PD-P5-011 feared (OQ-MDC-005)',
    );
  }

  if (problems.length) return fail(problems.join(' · '));

  /* 5. AND THE RENDERED TREE, because everything above is still only source. */
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
    DECL + ' declares the four sections spec §11 fixes, in its order:',
    ...declared.map((id) => '  · ' + id.toUpperCase() + ' — ' + (SECTION_MEANING[id] ?? '?')),
    SCREEN + ' renders them by mapping ' + declName + ', so a section cannot reach the screen',
    '  without reaching the declaration first — the order has one home, not two.',
    'The header renders before section A, and no section container carries placeholder wording:',
    '  an empty section is the correct render for one a later package fills.',
    STACK + ' routes CardDetail to Card DNA, and ' + EDITOR + ' carries a fee editor that',
    '  opens and saves — M4 is measured as reachable EDITING BEHAVIOUR, not as a route name',
    '  (PD-P5-011 discharged; repaired under Owner ruling OQ-MDC-005 option 2).',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
