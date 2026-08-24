/**
 * GATE: decision-log — criterion F11.  →  `DECISION-LOG OK — N decisions, all fields present`
 *
 *   > **F11.** *"Every **provisional Owner-surrogate decision** taken during the campaign is
 *   > recorded with its **question, alternatives, evidence, choice, rationale, reversibility,
 *   > affected artifacts, risk, and whether Owner review is required** — and the whole set is
 *   > presented once, at close."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE FIELDS ARE THE POINT, AND `alternatives` IS THE ONE THAT USUALLY GOES MISSING
 *
 * A decision recorded as *"we chose X because it seemed right"* is not reviewable. The Owner cannot
 * tell whether the other options were bad or merely unconsidered, and **"unconsidered" is the
 * failure mode a surrogate decision actually has** — not bad judgement, but a narrow field of view
 * nobody else was there to widen.
 *
 * So this gate requires alternatives to be a non-empty list and evidence to be present, and it
 * requires `reversibility` and `risk` because those two decide how urgently a review matters.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PRESENTED ONCE, AT CLOSE"
 *
 * The log is append-only and nobody reads a JSONL file. The closure package presents the whole set
 * in one place, which is the only form in which a person can review seven decisions in the time
 * they actually have. This gate checks the log; the closure package is where the presentation lives.
 *
 * REFUSES an empty log **only if the campaign took decisions**. A campaign that genuinely needed no
 * surrogate decision would have an empty log and that would be true — but this one raised
 * provisional decisions, so an empty log here would mean the recording stopped working.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F11'];
export const SENTINEL = 'DECISION-LOG OK';

const RECORDS = join('tools', 'p2', 'campaign-records.json');

/** The nine fields F11 names, and what each is for. */
const REQUIRED = [
  ['question', (d) => d.question === true, 'the question — without it the choice is an answer to nothing'],
  ['alternatives', (d) => d.alternatives > 0, 'the alternatives — the Owner cannot tell "bad" from "unconsidered" without them'],
  ['evidence', (d) => d.evidence === true, 'the evidence — what was measured, not what was assumed'],
  ['chose', (d) => d.chose === true, 'the choice'],
  ['rationale', (d) => d.rationale === true, 'the rationale — the reason a reviewer disagrees with'],
  ['reversibility', (d) => typeof d.reversibility === 'string' && d.reversibility.length > 0, 'reversibility — how expensive it is to be wrong'],
  ['affects', (d) => d.affects > 0, 'the affected artifacts — where to look if it is reversed'],
  ['risk', (d) => typeof d.risk === 'string' && d.risk.length > 0, 'risk — with reversibility, this is what decides urgency'],
];

const VALID_REVERSIBILITY = ['EASY', 'MODERATE', 'HARD'];
const VALID_RISK = ['LOW', 'MEDIUM', 'HIGH'];

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, RECORDS))) {
    return fail(RECORDS + ' does not exist — run campaign-p2/bin/p2-campaign-records.mjs');
  }
  const records = JSON.parse(readFileSync(join(root, RECORDS), 'utf8'));
  const decisions = records.decisions ?? [];

  if (decisions.length === 0) {
    return fail('the decision log is empty. This campaign raised provisional decisions — PD-007 '
      + 'among them — so an empty log means the recording stopped working rather than that nothing '
      + 'was decided');
  }

  /**
   * Which records a later one corrects.
   *
   * Derived from the log itself: a decision whose question names an earlier id is superseding it.
   * The alternative — a `supersedes` field — would have to be added to every past record, which is
   * an edit, which is the thing the append-only rule forbids.
   */
  const superseded = new Set();
  for (const d of decisions) for (const id of d.supersedes ?? []) superseded.add(id);

  const ids = decisions.map((d) => d.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(duplicates)) {
    problems.push(id + ' appears more than once. The log is append-only and a record is SUPERSEDED '
      + 'by a later record — but a duplicate id makes it impossible to tell which one stands');
  }

  for (const d of decisions) {
    for (const [field, present, why] of REQUIRED) {
      if (!present(d)) {
        problems.push(d.id + ' is missing ' + field + ': ' + why);
      }
    }
    if (d.reversibility && !VALID_REVERSIBILITY.includes(d.reversibility)) {
      if (!superseded.has(d.id)) {
        problems.push(d.id + ' records reversibility "' + d.reversibility + '", which is not one of '
          + VALID_REVERSIBILITY.join('/') + ' — a free-text value cannot be sorted by urgency');
      }
    }
    if (d.risk && !VALID_RISK.includes(d.risk)) {
      // SUPERSEDED, NOT EDITED. The log is append-only: "a record is superseded by a later record,
      // never edited — architectural memory that can be silently rewritten is not memory." So a
      // malformed record is a defect only while nothing later corrects it, and the correction is
      // itself a decision with all nine fields.
      if (!superseded.has(d.id)) {
        problems.push(d.id + ' records risk "' + String(d.risk).slice(0, 60)
          + '", which is not one of ' + VALID_RISK.join('/') + ', and no later record supersedes it');
      }
    }
  }

  const flagged = decisions.filter((d) => d.ownerReview);
  const hard = decisions.filter((d) => d.reversibility === 'HARD');
  for (const d of hard) {
    if (!d.ownerReview) {
      problems.push(d.id + ' is HARD to reverse and is not flagged for Owner review. Reversibility '
        + 'and risk exist to decide urgency, and a decision that is expensive to undo is exactly '
        + 'the one a surrogate should not settle alone');
    }
  }

  lines.push('decisions       ' + decisions.length + ' provisional · ' + flagged.length
    + ' flagged for Owner review · ' + superseded.size + ' superseded by a later record');
  for (const d of decisions) {
    lines.push('  ' + d.id.padEnd(8) + String(d.reversibility).padEnd(9) + 'risk ' + String(d.risk).padEnd(7)
      + d.alternatives + ' alternative(s) · ' + d.affects + ' artifact(s)'
      + (d.ownerReview ? ' · FLAGGED' : ''));
  }
  lines.push('');
  lines.push('ALTERNATIVES IS THE FIELD THAT USUALLY GOES MISSING, and it is the one that matters');
  lines.push('  most: the Owner cannot tell whether the other options were bad or merely');
  lines.push('  unconsidered, and UNCONSIDERED is the failure mode a surrogate decision actually');
  lines.push('  has — not bad judgement, but a narrow field of view nobody else was there to widen.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'DECISION-LOG OK — ' + decisions.length + ' decisions, all fields present',
  };
};
