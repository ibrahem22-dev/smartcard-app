import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFLICT_RENDER_PLAN, CostModelAdapter } from '@smartcard/data-authority-adapter';

import { EXPECTED_DATASET_ID } from '../datasetId';
import { describePlan, renderPlanFor } from '../conflictRender';

/**
 * CRITERION A4 — both render plans, DEMONSTRATED BY RECORD ID, against the real shipped pack.
 *
 *   > **A4.** *"`conflictRenderPlan`'s **both** members render correctly, demonstrated **by record
 *   > id**: `DISPUTED_WITHOUT_CANDIDATES` on `term:one-zero|research:FX_COMMISSION_PCT:4` renders
 *   > *"This figure is disputed"* and nothing further; empty `conflictIds` produces neither
 *   > spinner, error, nor fallback."*
 *
 *   > **OB-1.** *"Exactly **one** shipped row carries this today —
 *   > `term:one-zero|research:FX_COMMISSION_PCT:4`."*
 *
 * "By record id" is the whole instruction. A test that constructed a conflict with no candidates
 * would prove the code path and prove nothing about the estate — and OB-1's claim is about the
 * estate: one row, named, and the count is re-measured here rather than quoted.
 */

const PACK = join(__dirname, '..', 'packs', 'catalog', 'pack.json');

/** The record OB-1 names. Written once, because a test about a named record names it. */
const ADJ_005_ROW = 'term:one-zero|research:FX_COMMISSION_PCT:4';

interface FeeRow {
  readonly termId: string;
  readonly consumability?: { readonly verdict?: string };
}

const openCostModel = (): { adapter: CostModelAdapter; fees: FeeRow[] } => {
  const pack = JSON.parse(readFileSync(PACK, 'utf8'));
  const adapter = CostModelAdapter.open(
    {
      datasetId: pack.datasetId,
      datasetVersion: pack.datasetVersion,
      feeTerms: pack.units.fees,
      fxPairs: pack.units.fx,
      conflicts: pack.conflicts,
    },
    { expectedDatasetId: EXPECTED_DATASET_ID },
  );
  return { adapter, fees: pack.units.fees as FeeRow[] };
};

describe('A4 — the ADJ-005 row, by record id', () => {
  const { adapter, fees } = openCostModel();

  it('the named row is in the shipped pack', () => {
    // If this ever fails, the criterion's example moved and A4 must be re-derived rather than
    // re-measured against a row that no longer exists.
    expect(fees.some((f) => f.termId === ADJ_005_ROW)).toBe(true);
    expect(adapter.feeTerm(ADJ_005_ROW)).toBeDefined();
  });

  it('carries NO_RECORDED_COUNTERPARTY, and therefore DISPUTED_WITHOUT_CANDIDATES', () => {
    const { availability, plan, candidateCount } = renderPlanFor(adapter.conflictsFor(ADJ_005_ROW));
    expect(availability).toBe('NO_RECORDED_COUNTERPARTY');
    expect(plan).toBe('DISPUTED_WITHOUT_CANDIDATES');
    expect(candidateCount).toBe(0);
  });

  it('renders the disputed mark and NOTHING FURTHER', () => {
    const shape = describePlan('DISPUTED_WITHOUT_CANDIDATES');
    expect(shape.showsDisputedMark).toBe(true);
    expect(shape.showsCandidates).toBe(false);
  });

  it('produces NEITHER SPINNER, ERROR, NOR FALLBACK — each asserted as a value', () => {
    // The prohibitions are fields rather than comments, so a test can hold them to account.
    const shape = describePlan('DISPUTED_WITHOUT_CANDIDATES');
    expect(shape.showsSpinner).toBe(false);
    expect(shape.showsError).toBe(false);
    expect(shape.hidesTheFact).toBe(false);
  });

  it('EXACTLY ONE shipped row is in this state — re-measured, not quoted', () => {
    // OB-1 says one. The count is derived from the pack, so a second row appearing is a failure
    // here rather than a sentence in a document that stopped being true.
    const disputed = fees
      .filter((f) => f.consumability?.verdict === 'CONFLICTED')
      .filter((f) => renderPlanFor(adapter.conflictsFor(f.termId)).plan === 'DISPUTED_WITHOUT_CANDIDATES')
      .map((f) => f.termId);

    expect(disputed).toEqual([ADJ_005_ROW]);
  });
});

describe('A4 — the other member, also by record id', () => {
  const { adapter, fees } = openCostModel();

  const withCandidates = (): string[] =>
    fees
      .filter((f) => f.consumability?.verdict === 'CONFLICTED')
      .filter((f) => renderPlanFor(adapter.conflictsFor(f.termId)).plan === 'RENDER_ALL_CANDIDATES')
      .map((f) => f.termId);

  it('RENDER_ALL_CANDIDATES is reached by real rows — the control', () => {
    // Without this, every assertion above would pass in a build where the plan was always
    // DISPUTED_WITHOUT_CANDIDATES, which is the failure mode a one-sided test cannot see.
    const rows = withCandidates();
    expect(rows.length).toBeGreaterThan(1);
  });

  it('a row with records renders every candidate, and no winner', () => {
    const id = withCandidates()[0];
    expect(id).toBeDefined();
    if (id === undefined) return;

    const { availability, plan, candidateCount } = renderPlanFor(adapter.conflictsFor(id));
    expect(availability).toBe('RECORDS_AVAILABLE');
    expect(plan).toBe('RENDER_ALL_CANDIDATES');
    expect(candidateCount).toBeGreaterThan(0);

    const shape = describePlan(plan);
    expect(shape.showsCandidates).toBe(true);
    expect(shape.showsDisputedMark).toBe(true);
  });

  it('BOTH members of the closed domain are reached by the real pack', () => {
    // The domain is the adapter's, and every member of it is exercised by a shipped row. A member
    // nothing reaches is a member nobody has tested.
    const reached = new Set(
      fees
        .filter((f) => f.consumability?.verdict === 'CONFLICTED')
        .map((f) => renderPlanFor(adapter.conflictsFor(f.termId)).plan),
    );
    expect([...reached].sort()).toEqual([...CONFLICT_RENDER_PLAN].sort());
  });

  it('an unknown plan THROWS rather than rendering nothing', () => {
    // The undeclared state ADJ-005 was blocked on, one level up: a new member falling through a
    // switch would produce a screen that silently says nothing.
    expect(() => describePlan('SOMETHING_NEW' as never)).toThrow(/domain is closed/);
  });
});
