/**
 * GATE: home-no-suggestions — criterion H6.  →  `HOME-NO-SUGGESTIONS OK`
 *
 *   > **H6.** *"The contextual-suggestion slot ships empty and Home is complete without it, because
 *   > suggestions are V1.x."*
 *
 * MEASURES: 'source'. There is nothing to render, which is the point.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A CRITERION WRITTEN TO REFUSE WORK, AND ITS SECOND CLAUSE IS THE HARD ONE
 *
 * *"ships empty"* is easy to satisfy: build nothing. **"Home is complete without it"** is the claim
 * that costs something — it says the screen must not look like it is waiting for a part that has not
 * arrived. No empty card with a heading. No skeleton. No *"suggestions coming soon"*. A gap where a
 * feature will go is a feature announcement, and `B2` refuses those on a live P5 route.
 *
 * So this gate looks for the slot's own absence AND for the wording that would announce it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE STATE TABLE ALREADY RECORDS THE REFUSAL, AND THAT IS NOT AN ACCIDENT
 *
 * `src/store/p5UserState.ts` carries a row for `homeSuggestionDismissed`, classified **prohibited**,
 * with the reason written out: contract §12 lists dismissal flags among P5's new state, H6 requires
 * the slot to ship empty, *"there is nothing to dismiss, and a dismissal flag would be the first
 * half of a feature §17 sends to a later phase."*
 *
 * `U1`'s gate already enforces that the field does not exist in code. This gate checks that the ROW
 * is still there — because if someone deletes the row, U1 goes green (nothing to check) and the
 * refusal stops being on the record. A table that lists only what exists cannot tell a reader that
 * something was considered and declined.
 *
 * NEGATIVE CONTROL (contract §H6): add a suggestion card and watch the scope gate refuse it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['H6'];
export const SENTINEL = 'HOME-NO-SUGGESTIONS OK';
export const MEASURES = 'source';

const HOME_DIR = 'src/screens/home';
const SCREEN = 'src/screens/HomeScreen.tsx';
const STATE_TABLE = 'src/store/p5UserState.ts';

/** A suggestion feature, in the shapes it would arrive in. */
const SUGGESTION = [
  [/\bsuggestionCard\b|\bSuggestionCard\b/, 'renders a suggestion card'],
  [/\bcontextualSuggestion\w*/i, 'builds a contextual suggestion'],
  [/\bsuggestions?\s*[:=]\s*\[/i, 'assembles a list of suggestions'],
  [/\bdismissSuggestion\b|\bonDismissSuggestion\b/i, 'lets a suggestion be dismissed'],
  [/\bhomeSuggestionDismissed\b/, 'persists a suggestion dismissal — the field U1 classified prohibited'],
];

/** A gap announcing itself, which B2 refuses on a live route. */
const ANNOUNCES_A_GAP = [
  [/\b(coming soon|not yet|placeholder|בקרוב)\b/i, 'announces something that has not arrived'],
  [/suggestion[^\n]{0,40}(soon|later|v1|V1)/i, 'promises suggestions'],
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

export const run = async ({ root }) => {
  const files = walk(join(root, HOME_DIR));
  if (existsSync(join(root, SCREEN))) files.push(join(root, SCREEN));
  if (files.length === 0) {
    return fail('no Home modules found — a refusal checked over zero files passes silently and proves nothing (§2 rule 5)');
  }

  const problems = [];
  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));

    for (const [re, why] of SUGGESTION) {
      const hit = src.match(re);
      if (hit) {
        problems.push(rel + ' ' + why + ' ("' + hit[0] + '") — spec §5 marks suggestions V1.x and §19 puts them at feature 43');
        break;
      }
    }
    for (const [re, why] of ANNOUNCES_A_GAP) {
      const hit = src.match(re);
      if (hit) {
        problems.push(
          rel + ' ' + why + ' ("' + hit[0] + '"). H6 says Home is COMPLETE without the slot — a gap where a feature will '
            + 'go is a feature announcement, and B2 refuses those on a live P5 route',
        );
        break;
      }
    }
  }

  /* The refusal must stay ON THE RECORD, not merely be true. */
  if (!existsSync(join(root, STATE_TABLE))) {
    problems.push(STATE_TABLE + ' does not exist — U1\'s table is where H6\'s refusal is recorded');
  } else {
    const table = readFileSync(join(root, STATE_TABLE), 'utf8');
    if (!/homeSuggestionDismissed/.test(table) || !/prohibited/.test(table)) {
      problems.push(
        STATE_TABLE + ' no longer carries the homeSuggestionDismissed row classified prohibited. Deleting it makes U1 '
          + 'go green — there is nothing left to check — and the refusal stops being on the record. A table that lists '
          + 'only what exists cannot tell a reader that something was considered and declined',
      );
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION H6 — Home ships without a contextual-suggestion slot, over ' + files.length + ' module(s).',
    '"Ships empty" is the easy half: build nothing. "Home is complete without it" is the half that',
    '  costs something — the screen must not look like it is waiting for a part that has not arrived.',
    '  No empty card with a heading, no skeleton, no "coming soon". A gap where a feature will go is',
    '  a feature announcement, and B2 refuses those on a live route.',
    'And the refusal is still ON THE RECORD: ' + STATE_TABLE + ' keeps the homeSuggestionDismissed row',
    '  classified prohibited. Deleting that row would make U1 go green — nothing left to check — and',
    '  the decision would quietly become an absence. A table listing only what exists cannot say that',
    '  something was considered and declined.',
  ].join('\n'));
};
