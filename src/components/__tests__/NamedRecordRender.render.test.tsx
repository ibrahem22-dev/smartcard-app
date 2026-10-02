import React from 'react';
import { render } from '@testing-library/react-native';

import { ConflictedValue } from '../ConflictedValue';
import type { ConflictAuthority } from '../../authority/authorityValue';

/**
 * CRITERION A4's RENDER HALF — the ADJ-005 row on screen.
 *
 *   > **A4.** *"`DISPUTED_WITHOUT_CANDIDATES` on `term:one-zero|research:FX_COMMISSION_PCT:4`
 *   > renders *"This figure is disputed"* and nothing further; empty `conflictIds` produces neither
 *   > spinner, error, nor fallback."*
 *
 * The plan and the count are measured against the real pack in `namedRecords.test.ts`. This is what
 * a person actually sees: the sentence, and nothing after it.
 */

const ADJ_005_ROW = 'term:one-zero|research:FX_COMMISSION_PCT:4';

const disputedWithoutCandidates: ConflictAuthority<number> = {
  state: 'CONFLICT',
  candidates: [],
  reason: '',
};

const withTwoCandidates: ConflictAuthority<number> = {
  state: 'CONFLICT',
  candidates: [
    { value: 1, provenance: 'VERIFIED', sourceId: 'src:a', scope: 'card', observedAt: '2026-07-01' },
    { value: 2, provenance: 'VERIFIED', sourceId: 'src:b', scope: 'issuer', observedAt: '2026-07-02' },
  ],
  reason: 'two tariff documents disagree',
};

describe(`A4 — ${ADJ_005_ROW} renders disputed and nothing further`, () => {
  it('shows the disputed mark', () => {
    const { getByTestId } = render(
      <ConflictedValue
        conflict={disputedWithoutCandidates}
        format={(v) => `${String(v)}%`}
        plan="DISPUTED_WITHOUT_CANDIDATES"
      />,
    );
    expect(getByTestId('conflicted-value')).toBeTruthy();
  });

  it('shows NOTHING FURTHER — no candidate block at all', () => {
    const { queryByTestId } = render(
      <ConflictedValue
        conflict={disputedWithoutCandidates}
        format={(v) => `${String(v)}%`}
        plan="DISPUTED_WITHOUT_CANDIDATES"
      />,
    );
    expect(queryByTestId('conflicted-value-candidates')).toBeNull();
    expect(queryByTestId('conflicted-value-candidate-0')).toBeNull();
  });

  it('DOES NOT HIDE THE FACT — the component renders, it does not return null', () => {
    // "The fact is not hidden, and no reading is invented." Hiding would delete information the
    // estate does have.
    const { toJSON } = render(
      <ConflictedValue
        conflict={disputedWithoutCandidates}
        format={(v) => `${String(v)}%`}
        plan="DISPUTED_WITHOUT_CANDIDATES"
      />,
    );
    expect(toJSON()).not.toBeNull();
  });

  it('renders the SAME whether the empty list arrives with a reason or without one', () => {
    // An empty conflictIds is an answer the pipeline gave. A reason string is commentary on it, and
    // its presence must not change whether candidates appear.
    const withReason = render(
      <ConflictedValue
        conflict={{ state: 'CONFLICT', candidates: [], reason: 'no counterparty recorded' }}
        format={(v) => `${String(v)}%`}
        plan="DISPUTED_WITHOUT_CANDIDATES"
      />,
    );
    expect(withReason.queryByTestId('conflicted-value-candidates')).toBeNull();
  });

  it('the OTHER plan does render candidates — the control', () => {
    // Without this, "no candidates" would be indistinguishable from a component that never renders
    // candidates at all.
    const { getByTestId } = render(
      <ConflictedValue
        conflict={withTwoCandidates}
        format={(v) => `${String(v)}%`}
        plan="RENDER_ALL_CANDIDATES"
      />,
    );
    expect(getByTestId('conflicted-value-candidates')).toBeTruthy();
    expect(getByTestId('conflicted-value-candidate-0')).toBeTruthy();
    expect(getByTestId('conflicted-value-candidate-1')).toBeTruthy();
  });

  it('the PLAN decides, not the candidate count', () => {
    // Handed candidates but told the ADJ-005 plan, the component obeys the plan. That is what makes
    // this a switch on the state rather than on a symptom of it — and it is the same discipline A5
    // requires with labelState.
    const { queryByTestId } = render(
      <ConflictedValue
        conflict={withTwoCandidates}
        format={(v) => `${String(v)}%`}
        plan="DISPUTED_WITHOUT_CANDIDATES"
      />,
    );
    expect(queryByTestId('conflicted-value-candidates')).toBeNull();
  });
});
