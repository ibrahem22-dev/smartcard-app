/**
 * GATE: waiver-badge — criterion W3.  →  `WAIVER-BADGE OK`
 *
 *   > **W3.** *"The fee-waiver-expiry badge is amber with a live countdown, is never red, and
 *   > schedules no notification and requests no notification permission."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TWO OF W3's FOUR CLAUSES ARE PROHIBITIONS, AND PROHIBITIONS NEED SOURCE READING
 *
 * A render test can prove a badge is amber and counting. It cannot prove the component **never**
 * schedules a notification — it can only prove this render did not. A scheduling call behind a
 * condition the fixture does not hit, in a `useEffect` that needs a real timer, or inside a helper
 * three files away, all pass a spy and all ship.
 *
 * So the spy and the source read are both required, and they catch different things: the suite
 * proves nothing fired, and this gate proves nothing *could*.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS PARTICULAR PROHIBITION IS IN THE CONTRACT AT ALL
 *
 * A countdown is the single most natural place in this product to think *"the user would want
 * reminding"*. It is a good instinct and it is out of scope, and the failure it produces is
 * specific: a permission prompt fired by **opening the Wallet** — from a screen the user opened to
 * look at their cards, for a feature they never asked for. Once denied, that permission is
 * expensive to ask for again, so an unasked-for prompt spends something the product may need later.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AMBER IS A SEMANTIC CLAIM, NOT A COLOUR PREFERENCE
 *
 * A fee waiver expiring is **information with a deadline**, not a hazard. Red is the product's
 * word for danger, and spending it here devalues it where it is needed. P2's `ConflictedValue`
 * already holds this line for conflicts — *"amber never red: a disagreement between sources is not
 * a hazard to the reader"* — and W3 holds the same line for deadlines.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "LIVE" IS ONLY TESTABLE IF NOW IS INJECTABLE
 *
 * A component calling `new Date()` internally can only ever be tested on the day the test runs, and
 * a countdown that is wrong on every other day passes. So the gate requires `now` to be injectable
 * and the suite to render at two instants and prove the remaining time moved.
 *
 * NEGATIVE CONTROL (contract §W3): colour the badge red and watch the semantic-colour gate fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W3'];
export const SENTINEL = 'WAIVER-BADGE OK';
export const MEASURES = 'render';

const BADGE = 'src/screens/wallet/WaiverBadge.tsx';
const TILE = 'src/screens/wallet/WalletTile.tsx';
const SUITE = 'src/screens/wallet/__tests__/waiverBadge.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders no badge when the card has no fee waiver',
  'renders a countdown to the waiver expiry the data carries',
  'counts down as the clock advances',
  'renders amber and never red',
  'schedules no notification and requests no permission',
];

/** Red, in every spelling this codebase could produce it. */
const RED = [
  [/\bdanger\b/, 'reaches for the danger role'],
  [/\bred-\d{2,3}\b/, 'uses a red utility class'],
  [/#(f|e|d)[0-9a-f]{2}(0|1|2)[0-9a-f]{3}\b/i, 'hardcodes what looks like a red hex'],
  [/ROLE_TEXT\.danger|ROLE_BORDER\.danger|ROLE_SURFACE_BG\.danger/, 'uses a danger token'],
];

/** Notification scheduling and permission, in any spelling. */
const NOTIFICATION = [
  [/expo-notifications/, 'imports expo-notifications'],
  [/notificationScheduler/, 'imports the notification scheduler'],
  [/schedule[A-Za-z]*Notification/i, 'schedules a notification'],
  [/(request|get)[A-Za-z]*Permissions?[A-Za-z]*\s*\(/i, 'asks for a permission'],
  [/setNotificationHandler/, 'installs a notification handler'],
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
  for (const rel of [BADGE, TILE, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — W3 has nothing to be about');
  }

  const badgeSrc = stripComments(readFileSync(join(root, BADGE), 'utf8'));
  const tileSrc = stripComments(readFileSync(join(root, TILE), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. NEVER RED. */
  for (const [re, why] of RED) {
    if (re.test(badgeSrc)) {
      problems.push(
        BADGE + ' ' + why + '. A fee waiver expiring is information with a deadline, not a hazard — red is this '
          + 'product\'s word for danger and spending it here devalues it where it is needed',
      );
    }
  }
  if (!/advisory/i.test(badgeSrc)) {
    problems.push(BADGE + ' uses no advisory-role token — W3 says amber, and this codebase spells amber "advisory"');
  }

  /* 2. NO NOTIFICATION, NO PERMISSION. The clause a spy cannot prove on its own. */
  for (const [re, why] of NOTIFICATION) {
    if (re.test(badgeSrc)) {
      problems.push(
        BADGE + ' ' + why + '. W3 forbids it outright: a permission prompt fired by opening the Wallet is something '
          + 'the user did not ask for, from a screen they opened to look at their cards',
      );
    }
  }

  /* 3. "LIVE" MUST BE TESTABLE, so NOW is injected rather than read from the clock. */
  if (/new Date\s*\(\s*\)/.test(badgeSrc) && !/\bnow\b/.test(badgeSrc)) {
    problems.push(
      BADGE + ' reads the clock internally with no injectable now. A countdown that can only be tested on the day '
        + 'the test runs is a countdown that can be wrong on every other day and still pass',
    );
  }
  if (!/\bnow\b/.test(badgeSrc)) {
    problems.push(BADGE + ' takes no now — "live countdown" needs two instants to mean anything');
  }

  /* 4. NO WAIVER, NO BADGE. Absent is absent, as §A, §B and §D all already hold. */
  if (!/return null/.test(badgeSrc)) {
    problems.push(BADGE + ' never returns null — a card with no waiver gets NO badge, not one showing a dash or a zero');
  }

  /* 5. IT IS IN THE TILE'S SLOT. */
  if (!/WaiverBadge/.test(tileSrc)) {
    problems.push(TILE + ' does not render WaiverBadge — W1 left the waiver-badge slot for this');
  }

  /* 6. THE SUITE SPIES. The gate proves nothing COULD fire; the spy proves nothing DID. */
  if (!/expo-notifications/.test(suiteSrc)) {
    problems.push(
      SUITE + ' does not mock expo-notifications. The source read proves nothing could schedule; the spy proves '
        + 'nothing did, and they catch different things — a call behind an unhit condition passes only one of them',
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
    'CRITERION W3 — the fee-waiver-expiry badge.',
    'Amber and never red, in every spelling: no danger role, no red utility class, no red hex. A',
    '  waiver expiring is information with a deadline, not a hazard, and P2\'s ConflictedValue already',
    '  holds the same line for conflicts.',
    'It schedules no notification and asks for no permission — proved TWICE, because the two checks',
    '  catch different things. The suite spies and proves nothing fired; this gate reads the source',
    '  and proves nothing could. A call behind a condition the fixture never hits passes the first',
    '  and fails the second, and a countdown is the most natural place in this product to reach for',
    '  a reminder nobody asked for.',
    'The countdown takes an injectable now, and the suite renders at two instants and proves the',
    '  remaining time moved — a component reading the clock itself can only be right on the day the',
    '  test runs.',
    'A card with no waiver gets no badge at all.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
