/**
 * GATE: ob3-ob6-prohibitions — criterion K2.  →  `OB3-OB6-PROHIBITIONS OK`
 *
 *   > **K2.** *"No local classifier exists in the application: `ob3-ob6-prohibitions` still refuses
 *   > one."*
 *
 *   > **OB-6.** *"This is the gap most likely to be mistaken for a working feature."*
 *
 *   > **OQ-3, the Owner's AMEND ruling.** *"BUILD IT IN P3. Implement disagreementAxis
 *   > classification as the pipeline-owned build-time mechanism defined by the accepted P2 handoff,
 *   > OB-6 and ADR-014 §3. Classification must remain evidence-driven..."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND WHAT DID NOT
 *
 * The classification now EXISTS — as a build-time gate in the PIPELINE
 * (smartcard-data-pipeline campaign-p3/bin/p3-conflict-axis.mjs), which is where ADR-014 §3 put it:
 * decide the judgement where the evidence lives, and ship the judgement. That ruling moved the
 * classifier's home; it did not move the prohibition. The application still:
 *
 *   - assigns `disagreementAxis` from nothing — a consumer may not infer it;
 *   - computes an `intervalRankability` instead of reading one off the adapter's value;
 *   - renders any non-rankable member as "temporarily unavailable" — nothing is coming, and
 *     "temporarily" turns a permanent refusal into a promise nobody made.
 *
 * The honest rendering of every non-rankable member is `COMPARISON_INCOMPLETE`, and the distinction
 * between the three non-rankable members is diagnostic, never permissive (OB-3).
 *
 * THREE CHECKS
 *
 *   1. **No local classifier.** Anything that assigns `disagreementAxis`, or computes an
 *      `intervalRankability` rather than reading one, is the classifier OB-6 forbids outright.
 *   2. **No "temporarily unavailable" reading** — in any of the three languages the app ships, and
 *      not only in English, because the sentence a Hebrew reader sees is the one that matters to
 *      them.
 *   3. **The three non-rankable members are not collapsed.** All three route to
 *      `COMPARISON_INCOMPLETE`; an app that treats one differently has invented a permission.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['K2'];
export const SENTINEL = 'OB3-OB6-PROHIBITIONS OK';

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
  [/\bdisagreementAxis\s*[:=](?!=)/g, 'assigns disagreementAxis — the field only the pipeline build-time gate may write'],
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
    problems.push(c.file + ':' + c.line + ' ' + c.what + '. OQ-3 AMEND put the classifier in the '
      + 'PIPELINE build (campaign-p3/bin/p3-conflict-axis.mjs), where the estate evidence lives; a '
      + 'classifier here infers semantics on a device, unobservably, per user — OB-6\'s hard '
      + 'prohibition, unchanged by the ruling');
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
    lines.push('The prohibition is in force before its subject arrives, which is the only order in');
    lines.push('                which a prohibition is ever obeyed.');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
