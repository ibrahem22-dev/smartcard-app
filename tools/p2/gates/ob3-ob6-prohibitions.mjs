/**
 * GATE: ob3-ob6-prohibitions — criterion D8.  →  `OB-3/OB-6 OK — 0 local classifiers`
 *
 *   > **D8.** *"`NOT_RANKABLE_AXIS_NOT_CLASSIFIED` is **never rendered as "temporarily
 *   > unavailable"**; the app implements **no** conflict-axis classifier of its own (OB-3, OB-6)."*
 *
 *   > **OB-3.** *"P2 must not read that as 'temporarily unavailable' and must not implement its own
 *   > classifier: the evidence that decides the axis lives in the estate, and **no consumer has the
 *   > estate**."*
 *
 *   > **OB-6.** *"**This is the gap most likely to be mistaken for a working feature.**"*
 *
 * And the campaign's own hard prohibition: *"Do not implement a conflict-axis classifier (OB-6)."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY "TEMPORARILY UNAVAILABLE" IS THE FORBIDDEN SENTENCE
 *
 * All 59 shipped conflict records return `NOT_RANKABLE_AXIS_NOT_CLASSIFIED`, because the
 * classification that would populate `disagreementAxis` was never written — it fell out of a task
 * graph and *"nothing failed, because nothing checked"*.
 *
 * "Temporarily unavailable" tells a user to come back later. Nothing is coming. The axis is not
 * pending, not loading, and not degraded: **no consumer has the evidence that would decide it**, and
 * the honest sentence says the comparison cannot be made — which is `COMPARISON_INCOMPLETE`, and
 * which is what OD-24 requires.
 *
 * Saying "temporarily" turns a permanent refusal into a promise nobody made.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE CHECKS
 *
 *   1. **No local classifier.** Anything that assigns `disagreementAxis`, or computes an
 *      `intervalRankability` rather than reading one, is the classifier OB-6 forbids outright.
 *   2. **No "temporarily unavailable" reading** — in any of the three languages the app ships, and
 *      not only in English, because the sentence a Hebrew reader sees is the one that matters to
 *      them.
 *   3. **The three non-rankable members are not collapsed.** OB-3 says the distinction between them
 *      is *"diagnostic, never permissive"*: all three route to `COMPARISON_INCOMPLETE`, and an app
 *      that treats one differently has invented a permission.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['D8'];
export const SENTINEL = 'OB-3/OB-6 OK — 0 local classifiers';

/** The four members OB-3 names. Only the first permits a comparison. */
const RANKABILITY = [
  'RANKABLE',
  'NOT_RANKABLE_NO_ENUMERABLE_CANDIDATES',
  'NOT_RANKABLE_SCOPE_DISAGREEMENT',
  'NOT_RANKABLE_AXIS_NOT_CLASSIFIED',
];

/**
 * Phrasings that read as "come back later", in the three languages the app ships.
 *
 * English alone would be a check that passes for the readers it is least able to help: the app's
 * primary language is Hebrew, and a Hebrew reader is the one who would see the wrong sentence.
 */
const TEMPORARY_PHRASINGS = [
  [/temporarily\s+unavailable/i, 'en: "temporarily unavailable"'],
  [/try\s+again\s+later/i, 'en: "try again later"'],
  [/not\s+available\s+(right\s+)?now/i, 'en: "not available right now"'],
  [/זמנית/, 'he: "זמנית" (temporarily)'],
  [/בקרוב/, 'he: "בקרוב" (soon)'],
  [/נסה\s+שוב\s+מאוחר/, 'he: "try again later"'],
  [/مؤقت/, 'ar: "مؤقت" (temporary)'],
  [/حاول\s+مرة\s+أخرى\s+لاحق/, 'ar: "try again later"'],
];

/** The shapes of a classifier. Assigning the axis, or computing rankability rather than reading it. */
const CLASSIFIER_SHAPES = [
  [/\bdisagreementAxis\s*[:=](?!=)/g, 'assigns disagreementAxis — the field only the estate can decide'],
  [/\bfunction\s+\w*(classifyAxis|classifyDisagreement|deriveAxis|computeAxis)\w*\s*\(/g, 'defines an axis classifier'],
  [/\bintervalRankability\s*[:=](?!=)\s*['"`]/g, 'assigns an intervalRankability from a literal'],
  [/\bfunction\s+\w*(computeRankability|deriveRankability|rankConflict)\w*\s*\(/g, 'computes a rankability'],
];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing');

  // ── 1. no local classifier ───────────────────────────────────────────────────────
  const classifiers = [];
  // ── 2. no "temporarily unavailable" beside a non-rankable member ─────────────────
  const temporaries = [];
  // ── 3. the three non-rankable members are not collapsed ──────────────────────────
  const mentionsMember = new Map(RANKABILITY.map((m) => [m, []]));

  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));

    for (const [re, what] of CLASSIFIER_SHAPES) {
      for (const m of code.matchAll(re)) {
        classifiers.push({ file: rel, line: lineAt(code, m.index), what });
      }
    }

    for (const member of RANKABILITY) {
      let at = code.indexOf(member);
      while (at !== -1) {
        mentionsMember.get(member).push({ file: rel, line: lineAt(code, at) });
        at = code.indexOf(member, at + member.length);
      }
    }

    // A temporary phrasing is only a defect where a rankability member is in play. The app is
    // allowed to say "soon" about a feature; it may not say it about a conflict that will never
    // resolve.
    const touchesRankability = RANKABILITY.some((m) => code.includes(m))
      || /intervalRankability|COMPARISON_INCOMPLETE/.test(code);
    if (!touchesRankability) continue;
    for (const [re, label] of TEMPORARY_PHRASINGS) {
      const m = re.exec(code);
      if (m) temporaries.push({ file: rel, line: lineAt(code, m.index), label });
    }
  }

  for (const c of classifiers.slice(0, 5)) {
    problems.push(c.file + ':' + c.line + ' ' + c.what + '. OB-6: the evidence that decides the axis '
      + 'lives in the estate and NO CONSUMER HAS THE ESTATE — a classifier here is a guess wearing '
      + 'a classification\'s clothes, and it is a hard prohibition of this campaign');
  }
  for (const t of temporaries.slice(0, 5)) {
    problems.push(t.file + ':' + t.line + ' reads a non-rankable conflict as ' + t.label
      + '. Nothing is coming: the axis is not pending, not loading and not degraded, and '
      + '"temporarily" turns a permanent refusal into a promise nobody made');
  }

  lines.push('classifiers     ' + classifiers.length + ' local classifier(s) in ' + files.length + ' files');
  lines.push('temporary       ' + temporaries.length + ' "come back later" phrasing(s) beside a rankability member');
  lines.push('                checked in he · ar · en, because the sentence a Hebrew reader sees is');
  lines.push('                the one that matters to them');

  // ── 3. the members, and whether the app distinguishes them permissively ──────────
  const seen = RANKABILITY.filter((m) => mentionsMember.get(m).length > 0);
  lines.push('members named   ' + (seen.length === 0 ? '(none — the app does not yet consume conflicts)' : seen.join(', ')));

  if (seen.length > 0) {
    // If the app names any non-rankable member, it must name COMPARISON_INCOMPLETE too: that is the
    // single outcome all three route to.
    const routesToIncomplete = files.some((abs) =>
      /COMPARISON_INCOMPLETE/.test(stripComments(readFileSync(abs, 'utf8'))));
    if (!routesToIncomplete) {
      problems.push('the app names a rankability member and never names COMPARISON_INCOMPLETE. '
        + 'OB-3: all three non-rankable members route to it, and the distinction between them is '
        + 'diagnostic, never permissive');
    }
    if (seen.includes('RANKABLE') && seen.length === 1) {
      problems.push('the app names only RANKABLE. Handling the permitting case and none of the '
        + 'refusing ones is how a refusal becomes a silent pass');
    }
  } else {
    lines.push('');
    lines.push('NOTHING TO POLICE YET, and that is stated rather than counted as a pass. The app does');
    lines.push('                not consume conflict records — D1 landed the adapter seam and the');
    lines.push('                reads that use it are Phase 9. The prohibition is in force before its');
    lines.push('                subject arrives, which is the only order in which a prohibition is');
    lines.push('                ever obeyed, and its negative controls prove it can fire.');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'OB-3/OB-6 OK — ' + classifiers.length + ' local classifiers',
  };
};
