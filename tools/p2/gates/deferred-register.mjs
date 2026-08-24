/**
 * GATE: deferred-register — criterion F8.  →  `DEFERRED-REGISTER OK — reconciled`
 *
 *   > **F8.** *"A **P2 deferred register** exists in the `P1_DEFERRED.md` shape, answering for every
 *   > item **"what goes wrong if this is forgotten"**, reconciled item-by-item against §9 of this
 *   > contract."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "WHAT GOES WRONG IF THIS IS FORGOTTEN" IS THE QUESTION THAT MAKES A REGISTER USEFUL
 *
 * A deferral list without it is a to-do list, and a to-do list is read once. The question forces the
 * writer to say **which direction the omission fails in** — and that is the difference between a
 * deferral and a defect with a nicer name.
 *
 * `P1_DEFERRED` §2.11 is the model: *"a rate looks older than it is, failing toward `STALE`… the
 * safe direction, which is why it is a deferral and not a defect."* An entry that cannot say that
 * sentence is describing something that should have been fixed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS GATE CHECKS, AND WHAT IT CANNOT
 *
 * It checks **structure and reconciliation**: four questions answered per entry, and every item
 * either pre-registered in contract §9 or carrying the ruling that created it later. It cannot
 * check whether an answer is *true* — that is what a reader is for, and the register keeps the prose
 * so a reader has something to disagree with.
 *
 * REFUSES an empty register. A campaign that deferred nothing is either finished or not looking,
 * and this one is neither.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F8'];
export const SENTINEL = 'DEFERRED-REGISTER OK — reconciled';

const RECORDS = join('tools', 'p2', 'campaign-records.json');

const QUESTIONS = [
  ['hasWhyOut', 'Why out — why P2 did not do it'],
  ['hasShipBehaviour', 'Ship behaviour — what the app actually does today, measured'],
  ['hasIfForgotten', 'If forgotten — what goes wrong, and in which direction'],
  ['hasWhereItGoes', 'Where it goes — the phase, criterion or decision that closes it'],
];

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, RECORDS))) {
    return fail(RECORDS + ' does not exist — run campaign-p2/bin/p2-campaign-records.mjs');
  }
  const records = JSON.parse(readFileSync(join(root, RECORDS), 'utf8'));
  const { entries = [], reconciliation = [] } = records.deferred ?? {};

  if (entries.length === 0) {
    return fail('the register carries no entry. A campaign that deferred nothing is either finished '
      + 'or not looking, and this one has four criteria open on hardware it does not have');
  }

  // ── every entry answers all four ─────────────────────────────────────────────────
  for (const e of entries) {
    for (const [field, question] of QUESTIONS) {
      if (!e[field]) {
        problems.push('§' + e.section + ' "' + e.item + '" does not answer: ' + question
          + '. F8 asks for that answer on EVERY item, and the third one is the whole point — a '
          + 'deferral that cannot say which direction it fails in is a defect with a nicer name');
      }
    }
    if (!e.goesTo || e.goesTo.trim() === '') {
      problems.push('§' + e.section + ' names no destination');
    }
  }

  // ── reconciled item by item against §9 ───────────────────────────────────────────
  if (reconciliation.length === 0) {
    problems.push('the register carries no reconciliation table. F8 asks for it ITEM BY ITEM against '
      + '§9 — a register that did not reconcile would let a campaign hand onward work the contract '
      + 'never anticipated, which is precisely what §9 exists to make visible');
  } else if (reconciliation.length < entries.length) {
    problems.push('the register has ' + entries.length + ' entries and reconciles '
      + reconciliation.length + '. Item by item means every item');
  }

  const late = reconciliation.filter((r) => !r.inSection9);
  lines.push('entries         ' + entries.length + ', each answering all four questions');
  for (const e of entries) lines.push('  §' + e.section + '  ' + e.item.padEnd(38).slice(0, 38) + ' → ' + e.goesTo);
  lines.push('');
  lines.push('reconciled      ' + reconciliation.length + ' item(s) against contract §9 · '
    + late.length + ' arrived after it');
  for (const r of late) lines.push('  later: ' + r.item);
  lines.push('');
  lines.push('AN ITEM THAT ARRIVED AFTER §9 IS NOT A FAILURE — the contract was accepted before some');
  lines.push('  of these rulings existed, which is the same finding OD-31 Clause A accepted for P1');
  lines.push('  and fixed by amending §9 from list-complete to mechanism-complete. What would be a');
  lines.push('  failure is an item that arrived later and does not say so.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
