/**
 * GATE: analytics-barrier — criterion U3.  →  `ANALYTICS-BARRIER OK`
 *
 *   > **U3.** *"Nothing on a P5 surface reaches the analytics boundary carrying a vault type, a
 *   > currency amount, a card identity or last4, and P5 adds no `track` call site at all."*
 *
 * MEASURES: 'source'. The claim is about what the code CAN send, and a runtime test can only prove
 * what one render did send.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SECOND HALF IS ABSOLUTE, WHICH MAKES IT MEASURABLE
 *
 * *"P5 adds no `track` call site at all."* Not "sends nothing sensitive" — **none**. That is
 * unusually strong for a privacy rule and unusually easy to check, and the strength is the point: a
 * boundary that permits a few careful call sites requires every future author to be careful, while a
 * boundary that permits none requires only that someone notice a new one.
 *
 * So the population is **derived from git** — the files P5 created since the intake pin — and the
 * rule is that not one of them calls `track`. A sweep over a hand-listed set would miss the file
 * added tomorrow, which is exactly the file this rule is for.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE FIRST HALF NAMES FOUR THINGS, EACH FOR A DIFFERENT REASON
 *
 *   · a **vault type** — the shapes that exist because the data is the user's;
 *   · a **currency amount** — a single ₪ figure is a fact about someone's finances;
 *   · a **card identity** — which card someone holds is an identity, not a preference;
 *   · **last4** — the fragment people believe is anonymous, and which P4 already fenced with its
 *     own gate because it is not.
 *
 * P2's `analytics-boundary` gate polices the boundary itself. U3 polices the P5 side of it, and the
 * two are different questions: the boundary can be perfectly built and a surface can still hand it
 * something it should never have been offered.
 *
 * NEGATIVE CONTROL (contract §U3): pass a `UserCard` carrying `last4` to `track` and watch the
 * boundary refuse it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['U3'];
export const SENTINEL = 'ANALYTICS-BARRIER OK';
export const MEASURES = 'source';

const TRACK = 'src/analytics/track.ts';

/** What may never reach the boundary from a P5 surface, and why each is named. */
const FORBIDDEN_PAYLOAD = [
  [/\bUserCard\b|\bEngineCard\b|\bUserProfile\b/, 'a vault type — a shape that exists because the data is the user\'s'],
  [/\blast4\b/i, 'last4 — the fragment people believe is anonymous, which P4 already fenced because it is not'],
  [/\bcardId\b|\bcardProductId\b/, 'a card identity — which card someone holds is an identity, not a preference'],
  [/\bIls\b|\bmonthlyIls\b|\bamountIls\b/, 'a currency amount — one ₪ figure is a fact about someone\'s finances'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The app sha P5 started from, read from the intake rather than guessed. */
const intakeAppSha = (root) => {
  for (const rel of [
    join(root, '..', 'smartcard-data-pipeline', 'campaign-p5', 'state', 'INTAKE.json'),
    join(root, '..', 'campaign-p5', 'state', 'INTAKE.json'),
  ]) {
    try {
      const found = JSON.parse(readFileSync(rel, 'utf8'));
      const sha = found?.accepted?.shas?.app ?? null;
      if (sha) return String(sha);
    } catch { /* next */ }
  }
  return null;
};

export const run = async ({ root }) => {
  if (!existsSync(join(root, TRACK))) return fail(TRACK + ' does not exist — U3 has no boundary to be about');

  /*
   * THE POPULATION IS EVERY FILE P5 CREATED, FROM GIT. §2 rule 4, and the reason is specific: "P5
   * adds no track call site" is a claim about files that do not exist yet as much as ones that do,
   * and a hand-listed sweep would miss the one added tomorrow.
   */
  const pin = intakeAppSha(root);
  if (!pin) {
    return fail('the intake app sha could not be read, so the set of files P5 created cannot be derived — and a sweep that cannot derive its population is not running');
  }
  const listed = spawnSync('git', ['diff', '--name-only', '--diff-filter=A', pin + '..HEAD', '--', 'src/'], { cwd: root, encoding: 'utf8' });
  if (listed.status !== 0) return fail('git could not list the files P5 created since ' + pin.slice(0, 12));
  const created = String(listed.stdout).split('\n').map((l) => l.trim()).filter(Boolean);
  if (created.length === 0) {
    return fail('no file under src/ was created after the intake pin — P5 has built five surfaces, so an empty set means the derivation is broken, not that the work is absent');
  }

  const problems = [];
  let callSites = 0;

  for (const rel of created) {
    let src;
    try { src = stripComments(readFileSync(join(root, rel), 'utf8')); } catch { continue; }

    /*
     * THE ABSOLUTE HALF — AND A CALL NEEDS AN IMPORT.
     *
     * The first version matched `track(` anywhere, and flagged src/store/p5UserState.ts, whose
     * U1 rows explain IN PROSE that vault state "may never reach track()". Quoting the rule is
     * not breaking it, and a gate that cannot tell a call from a sentence about a call would
     * punish the file for documenting itself.
     *
     * A file that never imports the boundary cannot call it. So the import is the precondition,
     * and it is also checked on its own below — reaching for the boundary at all is the step
     * before using it.
     */
    const importsBoundary = /from\s+'[^']*analytics\/track'/.test(src);
    const calls = importsBoundary ? [...src.matchAll(/(?<![A-Za-z0-9_])track\s*\(/g)] : [];
    if (calls.length > 0) {
      callSites += calls.length;
      problems.push(
        rel + ' calls track(). U3 says P5 adds NO call site at all — not "none that send anything sensitive". A '
          + 'boundary permitting a few careful call sites needs every future author to be careful; one permitting none '
          + 'needs only that somebody notice a new one',
      );
      /* And say what it would have carried, which is the more useful half of the message. */
      for (const [re, why] of FORBIDDEN_PAYLOAD) {
        if (re.test(src)) problems.push('  …and ' + rel + ' names ' + why);
      }
    }

    /* Importing the boundary is the step before calling it. */
    if (/from\s+'[^']*analytics\/track'/.test(src)) {
      problems.push(rel + ' imports the analytics boundary — P5 has no reason to reach it at all');
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION U3 — the analytics barrier, over ' + created.length + ' file(s) P5 created since the intake pin.',
    'The population is derived from git rather than listed, because "P5 adds no track call site" is a',
    '  claim about the file added tomorrow as much as the ones here today — and a hand-listed sweep',
    '  would miss exactly that file.',
    'Zero call sites found, and nothing imports ' + TRACK + '.',
    'The rule is absolute rather than careful, and that is what makes it hold: a boundary permitting a',
    '  few well-reviewed call sites needs every future author to be careful; one permitting none needs',
    '  only that somebody notice a new one.',
    'The four things U3 names are named for different reasons — a vault type is a shape that exists',
    '  because the data is the user\'s; one ₪ figure is a fact about their finances; which card someone',
    '  holds is an identity; and last4 is the fragment people believe is anonymous, which P4 already',
    '  fenced because it is not.',
  ].join('\n'));
};
