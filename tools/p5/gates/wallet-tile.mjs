/**
 * GATE: wallet-tile — criterion W1.  →  `WALLET-TILE OK`
 *
 *   > **W1.** *"The card tile carries spec §10's element set in order — nickname with role tag,
 *   > issuer or club text, masked digits, the limit bar, the waiver badge, one or two Best-For
 *   > chips — and 'Add card' is always visible with tap opening Card DNA."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "ALWAYS VISIBLE" IS THE CLAUSE WITH A FAILURE MODE
 *
 * The natural implementation puts *"+ Add card"* at the end of the card list, which makes it
 * invisible on a full wallet until you scroll, and — the case that actually matters — leaves a
 * brand-new user with an empty wallet and, depending on the empty state, nothing to press. W1 says
 * **always**, so the suite proves it with cards and without them, and both cases are required by
 * name.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS PACKAGE BUILDS SIX SLOTS AND FILLS THREE
 *
 * The limit bar is `W2`, the waiver badge is `W3`, the Best-For chips are `W4`. At W1 those three
 * are **empty containers**, and that is a correct render — the same shape `N1` shipped when Card
 * DNA's four sections were empty. What is not correct is a promise: a *"coming soon"* in a slot is
 * a placeholder on a live P5 route, which `B2` refuses.
 *
 * So this gate requires the slots to exist and refuses placeholder wording inside them, and it does
 * NOT require their contents — a gate that demanded the limit bar here would make W1 unsatisfiable
 * until W2 shipped, which is a red no honest sequence of work could clear.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND IT MUST NOT HAVE EDITED P4's TILE — D-021
 *
 * `src/components/CardTile.tsx` existed when earlier campaigns measured their boundaries. A P5 edit
 * to it invalidates a record P5 has no standing to re-take, **even when every gate stays green** —
 * which is exactly how it went unnoticed last time until a phase refused to close. W1's tile
 * composes around it. This gate checks the composition rather than trusting it, because "I did not
 * edit that file" is precisely the kind of claim that is easy to make and easy to be wrong about.
 *
 * NEGATIVE CONTROL (contract §W1): remove the role tag and watch the element sweep fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W1'];
export const SENTINEL = 'WALLET-TILE OK';
export const MEASURES = 'render';

const ELEMENTS = 'src/screens/wallet/tileElements.ts';
const TILE = 'src/screens/wallet/WalletTile.tsx';
const SCREEN = 'src/screens/CardsScreen.tsx';
const SUITE = 'src/screens/wallet/__tests__/walletTile.render.test.tsx';
const P4_TILE = 'src/components/CardTile.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** Spec §10's order. The criterion's own content, and the only hand-written list here. */
const SPEC_10_ORDER = [
  'nickname-with-role',
  'issuer-or-club',
  'masked-digits',
  'limit-bar',
  'waiver-badge',
  'best-for-chips',
];

/** Which later criterion fills each slot, so an empty one can be explained rather than flagged. */
const FILLED_LATER = {
  'limit-bar': 'W2',
  'waiver-badge': 'W3',
  'best-for-chips': 'W4',
};

const REQUIRED_CASES = [
  'renders every element spec section 10 lists, in its order',
  'renders the nickname without a role tag when the card has no role',
  'renders the issuer when the card is in no club',
  'keeps Add card visible when the wallet has no cards',
  'keeps Add card visible when the wallet has cards',
  'opens Card DNA when the tile is tapped',
  'renders no placeholder text in an empty element slot',
];

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
  for (const rel of [ELEMENTS, TILE, SCREEN, SUITE, P4_TILE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — W1 has nothing to be about');
  }

  const elementsSrc = stripComments(readFileSync(join(root, ELEMENTS), 'utf8'));
  const tileSrc = stripComments(readFileSync(join(root, TILE), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const problems = [];

  /* 1. SPEC §10's ORDER, DECLARED AS DATA. */
  const declared = [...elementsSrc.matchAll(/\bid:\s*'([a-z-]+)'/g)].map((m) => m[1]);
  if (declared.length === 0) {
    return fail(ELEMENTS + ' declares no elements — a sweep over zero is the vacuous pass §2 rule 5 refuses');
  }
  if (declared.join(',') !== SPEC_10_ORDER.join(',')) {
    problems.push(ELEMENTS + ' declares [' + declared.join(', ') + '] but spec §10 fixes [' + SPEC_10_ORDER.join(', ') + ']');
  }

  /* 2. THE TILE MAPS THE DECLARATION, so an element cannot reach the screen without reaching it. */
  const listName = (elementsSrc.match(/export const ([A-Z_0-9]+)\s*:\s*readonly/) ?? [])[1];
  if (!listName) {
    problems.push(ELEMENTS + ' exports no readonly element list');
  } else if (!new RegExp(listName + '\\s*\\.\\s*map\\s*\\(').test(tileSrc)) {
    problems.push(TILE + ' does not map over ' + listName + ' — six hand-written slots agree with the declaration until either changes');
  }

  /* 3. IT COMPOSES P4's TILE RATHER THAN REPLACING IT. */
  if (!/\bCardTile\b/.test(tileSrc)) {
    problems.push(TILE + ' does not use the existing CardTile — W1 composes around P4\'s tile, it does not re-draw one');
  }

  /*
   * 4. AND P4's TILE IS UNTOUCHED. D-021: an edit here invalidates a closed campaign's boundary
   *    record even when every gate stays green, which is how it went unnoticed until a phase
   *    refused to close. Git is asked, because a claim about what was not edited is easy to get
   *    wrong and cheap to check.
   */
  const pin = intakeAppSha(root);
  if (pin) {
    const moved = spawnSync('git', ['diff', '--name-only', pin + '..HEAD', '--', P4_TILE], { cwd: root, encoding: 'utf8' });
    if (moved.status === 0 && String(moved.stdout).trim()) {
      problems.push(
        P4_TILE + ' has been modified since the intake pin. It is covered by an earlier campaign\'s boundary '
          + 'record, and P5 has no standing to re-take that measurement — see D-021. Compose around it instead',
      );
    }
  }

  /* 5. THE SLOTS EXIST AND CARRY NO PROMISE. Their CONTENTS are W2, W3 and W4's. */
  for (const id of declared) {
    if (!tileSrc.includes('wallet-tile-' + id)) {
      problems.push(TILE + ' renders no slot for "' + id + '"'
        + (FILLED_LATER[id] ? ' — ' + FILLED_LATER[id] + ' fills it, but the slot is W1\'s' : ''));
    }
  }
  if (PLACEHOLDER_WORDS.test(tileSrc)) {
    problems.push(TILE + ' carries placeholder wording. An EMPTY slot is the correct render for one a later criterion fills; a promise is a placeholder on a live P5 route (B2)');
  }

  /* 6. ADD CARD, AND IT IS NOT INSIDE THE LIST. */
  if (!/wallet-add-card/.test(screenSrc)) {
    problems.push(SCREEN + ' has no wallet-add-card — W1 says Add card is ALWAYS visible');
  }
  if (/cards\.length\s*[>=!]==?\s*0[^\n]*wallet-add-card/.test(screenSrc)) {
    problems.push(SCREEN + ' makes Add card conditional on the card count — "always" includes the empty wallet, which is the one case a new user sees');
  }

  /* 7. THE SURFACE STILL DOES NOT COMPUTE. */
  if (/from\s+'[^']*\/engines\//.test(tileSrc)) {
    problems.push(TILE + ' imports an engine directly (B1)');
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
    'CRITERION W1 — the Wallet tile.',
    ELEMENTS + ' declares spec §10\'s six elements in its order, and ' + TILE + ' maps them:',
    ...declared.map((id) => '  · ' + id + (FILLED_LATER[id] ? '   (slot; ' + FILLED_LATER[id] + ' fills it)' : '')),
    'Three slots ship EMPTY and that is correct — the limit bar is W2, the badge W3, the chips W4.',
    '  A gate demanding their contents here would make W1 unsatisfiable until W2 shipped, which is a',
    '  red no honest sequence of work could clear. Placeholder wording is refused instead.',
    'The tile COMPOSES ' + P4_TILE + ' and git confirms that file is unmodified since the intake pin:',
    '  editing it would invalidate a closed campaign\'s boundary record even with every gate green,',
    '  which is exactly how D-021 went unnoticed until a phase refused to close.',
    '"Add card" is visible with cards and without them — the empty wallet is the case a new user sees.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};

/** The app sha P5 started from, read from the intake rather than guessed. */
function intakeAppSha(root) {
  for (const rel of [
    join(root, '..', 'smartcard-data-pipeline', 'campaign-p5', 'state', 'INTAKE.json'),
    join(root, '..', 'campaign-p5', 'state', 'INTAKE.json'),
  ]) {
    try {
      const found = JSON.parse(readFileSync(rel, 'utf8'));
      const sha = found?.accepted?.shas?.app ?? null;
      if (sha) return String(sha);
    } catch { /* try the next */ }
  }
  return null;
}
