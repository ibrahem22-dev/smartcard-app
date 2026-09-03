/**
 * GATE: deferral — every lawfully DEFERRED criterion.  →  `DEFERRAL OK`
 *
 * Owner ruling **OQ-MDC-025 option 3**. This gate is SUBSTITUTED for the implementation gate of a
 * criterion the Owner has lawfully deferred. It is not a way of skipping that criterion; it is the
 * check that the deferral is real.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY A DEFERRED CRITERION KEEPS A GATE AT ALL
 *
 * Contract §9.1 accepts *"lawfully DEFERRED (fence + ruling + register row written in the same
 * act)"* as a terminal state, and `stage --close` already honours it. But the required-gates
 * generator read only the fence, so a deferred criterion went on demanding an implementation gate
 * that — by the very ruling deferring it — nobody would ever write. `mdc:all` called it MISSING,
 * X1 went red, and the close that accepted DEFERRED was refused by the same function.
 *
 * The fix could have been to drop the row from the required set. It was not, and the reason is
 * the one H6 recorded when it kept a `prohibited` row alive: **a table listing only what exists
 * cannot say that something was considered and declined.** A required set that silently shrank
 * would turn a decision into an absence, and the next reader would find nothing at all.
 *
 * So the obligation keeps a gate. The gate simply measures a different thing: not whether the
 * work was done, but whether the deferral is lawful and still true.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * DEFERRED IS NOT SATISFIED, AND CLAUSE 6 IS WHERE THAT IS ENFORCED
 *
 * A deferred row must carry no receipt and must not be SATISFIED. Without that clause this gate
 * would happily go green over a row that had been quietly marked satisfied on the strength of a
 * deferral — which is exactly the confusion the ruling exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * UNDEFERRAL IS SELF-CORRECTING
 *
 * Clause 7 compares the substitution recorded in `required-gates.json` against the ledger as it
 * is NOW. If a row leaves DEFERRED while this gate is still substituted for it, the file is stale
 * and the gate says so — so an undeferral cannot go on being covered by a deferral check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'DEFERRAL OK';
export const FAILURE_SENTINEL = 'DEFERRAL FAILED';
export const MEASURES = 'source';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CAMPAIGN_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master');
const LEDGER = join(CAMPAIGN_DIR, 'state', 'MDC_LEDGER.json');
const CONTRACT = join(CAMPAIGN_DIR, 'MDC_COMPLETION_CONTRACT.md');
const REGISTER = join(CAMPAIGN_DIR, 'MDC_DEFERRED.md');
const REQUIRED = join(ROOT, 'tools', 'mdc', 'required-gates.json');
const RULINGS_LIB = join(CAMPAIGN_DIR, 'bin', 'lib', 'rulings.mjs');

const read = (p) => readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(read(p));

/** The fence is the contract's own copy — the ledger's row could have drifted from it. */
const loadFenceCriteria = () => {
  const m = read(CONTRACT).match(/```criteria\r?\n([\s\S]*?)```/);
  if (!m) throw new Error('no ```criteria fence in the contract');
  return JSON.parse(m[1]).criteria;
};

export const run = async () => {
  const problems = [];
  const clauses = [];

  for (const [label, p] of [['ledger', LEDGER], ['contract', CONTRACT], ['register', REGISTER], ['required-gates', REQUIRED]]) {
    if (!existsSync(p)) return fail(`${label} not found at ${p} — a deferral cannot be verified without it`);
  }

  const ledger = readJson(LEDGER);
  const register = read(REGISTER);
  const required = readJson(REQUIRED);
  const fenceCriteria = loadFenceCriteria();

  /* The rulings resolver is REUSED, not reimplemented — it is the same isRuled that OQ-MDC-024
     taught to see an Owner queue answer, so this gate and `mc.mjs defer` agree by construction
     rather than by two readers happening to match. */
  let isRuled;
  try {
    ({ isRuled } = await import(pathToFileURL(RULINGS_LIB).href));
  } catch (err) {
    return fail(`the campaign rulings resolver could not be loaded from ${RULINGS_LIB}: ${err?.message ?? String(err)}`);
  }

  const deferredRows = ledger.criteria.filter((c) => c.state === 'DEFERRED');

  /* 7. THE SUBSTITUTION MUST STILL DESCRIBE THE LEDGER. Checked first, because every other clause
        below is about rows this file claims are deferred. */
  const substituted = (required.gates || []).find((g) => g.gate === 'deferral');
  const claimed = new Set(substituted ? substituted.criteria : []);
  const actual = new Set(deferredRows.map((c) => c.id));
  for (const id of claimed) {
    if (!actual.has(id)) {
      const row = ledger.criteria.find((c) => c.id === id);
      problems.push(
        `required-gates.json substitutes this gate for ${id}, but ${id} is ${row ? row.state : 'absent'} in the ledger, not DEFERRED. `
        + 'An undeferred criterion may not go on being covered by a deferral check — regenerate the required set.',
      );
    }
  }
  for (const id of actual) {
    if (!claimed.has(id)) {
      problems.push(`${id} is DEFERRED in the ledger but required-gates.json does not list it under the deferral gate — regenerate the required set`);
    }
  }
  if ((required.deferred || []).length !== deferredRows.length) {
    problems.push(`required-gates.json declares ${(required.deferred || []).length} deferred criteria; the ledger has ${deferredRows.length}`);
  }

  for (const row of deferredRows) {
    const id = row.id;

    /* 1. The row really is DEFERRED — asserted rather than assumed from the filter, because this
          loop is what the failure messages below name. */
    if (row.state !== 'DEFERRED') { problems.push(`${id}: state is ${row.state}, not DEFERRED`); continue; }

    /* 2. The criterion is deferrable UNDER ITS FENCE, read from the contract rather than the
          ledger's copy, so a hand-edited ledger row cannot grant itself a fence. */
    const fenceRow = fenceCriteria.find((c) => c.id === id);
    if (!fenceRow) { problems.push(`${id}: no such criterion in the contract fence`); continue; }
    const fence = fenceRow.deferrableUnder;
    if (!fence || !fence.ruling || !Array.isArray(fence.authorises)) {
      problems.push(`${id}: the contract fence carries no deferrableUnder block, so this criterion is not deferrable at all`);
      continue;
    }

    /* 3. The named Owner ruling exists and resolves. */
    const verdict = isRuled(fence.ruling);
    if (!verdict.ruled) {
      problems.push(`${id}: its fence defers under ${fence.ruling}, which does not resolve (${verdict.why})`);
      continue;
    }

    /* 4. The ruling AUTHORISES this deferral — a ruled question is not the same as a question
          ruled the way the fence requires. */
    const opt = String(verdict.ruling).trim();
    if (!fence.authorises.includes(opt)) {
      problems.push(
        `${id}: ${fence.ruling} was ruled '${opt}', but its fence authorises deferral only under ${fence.authorises.join(', ')}`,
      );
      continue;
    }

    /* 4b. The row records the authority it was actually deferred under. */
    if (row.deferredBy && row.deferredBy !== fence.ruling) {
      problems.push(`${id}: the ledger says it was deferred by ${row.deferredBy}, but its fence names ${fence.ruling}`);
    }

    /* 5. The register row exists — rule 1 of MDC_DEFERRED.md: the fence, the ruling and the
          register entry are ONE act, so pre-registration can never be satisfied retroactively. */
    /* A ROW, NOT A MENTION. The first version of this clause asked whether the register
       CONTAINED the criterion id, and a falsification trial deleting C8's row still passed —
       because "C8" also appears in the prose explaining the row. A check satisfied by a
       criterion being talked about somewhere is the gate-checked-citation-not-currency
       failure. So the id and its ruling must share one table row. */
    const registerRows = register.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
    const row5 = registerRows.find((line) => line.includes(id) && line.includes(fence.ruling));
    if (!row5) {
      const mentioned = registerRows.some((line) => line.includes(id));
      problems.push(
        mentioned
          ? `${id}: MDC_DEFERRED.md has a row naming it but not the ruling ${fence.ruling} that defers it`
          : `${id}: no table row in MDC_DEFERRED.md names it — a deferral without a register entry is missing behaviour wearing a polite name`,
      );
    }

    /* 6. NO IMPLEMENTATION EVIDENCE IS BEING CLAIMED. DEFERRED is not SATISFIED. */
    if (row.receipt) {
      problems.push(`${id}: a DEFERRED row carries a receipt — deferral is not evidence, and evidence is not deferral`);
    }
    const receiptFile = join(CAMPAIGN_DIR, 'evidence', 'receipts', `${id}.json`);
    if (existsSync(receiptFile)) {
      problems.push(`${id}: a receipt file exists at evidence/receipts/${id}.json for a DEFERRED criterion`);
    }
    const history = row.history || [];
    if (history.some((h) => h.to === 'SATISFIED') && history[history.length - 1]?.to !== 'DEFERRED') {
      problems.push(`${id}: the row's history ends in something other than DEFERRED after having been SATISFIED`);
    }

    clauses.push(`${id} deferred under ${fence.ruling}='${opt}' (${verdict.source || 'rulings'}), register row present, no receipt`);
  }

  if (problems.length > 0) return fail(problems.join('; '), { population: deferredRows.length });
  return okOverPopulation({
    population: deferredRows.length,
    unit: 'lawfully deferred criterion/criteria',
    detail: clauses.join(' · '),
  });
};
