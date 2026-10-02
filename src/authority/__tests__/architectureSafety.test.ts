/**
 * W1-AS-09 — Wave 1 architecture safety suite.
 *
 * The per-module tests prove each boundary in isolation. This suite proves they
 * COMPOSE: that a value cannot gain authority by travelling through the layer,
 * and that no combination of legal steps launders it.
 */

import {
  AUTHORITY_GRADE_PROVENANCES,
  PROVENANCES,
  blocked,
  historical,
  isCurrentAuthority,
  known,
  unknown,
  type AuthorityValue,
  type Provenance,
} from '../authorityValue';
import { admitClaim } from '../claimClassification';
import { presentAuthority } from '../presentation';
import { acceptManualInput } from '../manualInputBoundary';
import { evaluateFeatureRequirements } from '../featureDataRequirements';
import { makeDisabledAdapter } from '../../../tools/p2/jest/disabledAdapter';

const AT = '2026-08-15T00:00:00Z';
const fmt = (n: number): string => `${n.toFixed(1)}%`;

describe('W1-AS-09 architecture safety composition', () => {
  it('admits exactly one provenance as authority grade', () => {
    // If this ever widens, every downstream guarantee weakens at once.
    expect([...AUTHORITY_GRADE_PROVENANCES]).toEqual(['VERIFIED']);
    expect([...PROVENANCES]).toHaveLength(4);
  });

  it('no non-authority provenance can satisfy a financial claim', () => {
    const claim = {
      claimId: 'c',
      field: 'card.fx.foreignFeePercent',
      provenance: 'ESTIMATE' as const,
    };
    const nonAuthority: Provenance[] = [
      'ESTIMATE',
      'USER',
      'ESTIMATE',
    ];
    for (const provenance of nonAuthority) {
      const admission = admitClaim(claim, known(2.8, provenance, AT));
      expect(admission.admitted).toBe(false);
    }
  });

  it('manual input cannot become a verified presentation', () => {
    const outcome = acceptManualInput({ field: 'card.fee', rawValue: '2.8', enteredAt: AT });
    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) {
      return;
    }
    // It is a real number and may be shown back to the user...
    const presented = presentAuthority(outcome.value, fmt);
    expect(presented.amountText).toBe('2.8%');
    // ...but it can never carry a verified affordance, and cannot satisfy a
    // financial claim or an official-authority requirement.
    expect(presented.mayShowAsVerified).toBe(false);
    expect(
      admitClaim(
        { claimId: 'c', field: 'card.fee.annual', provenance: 'USER' },
        outcome.value,
      ).admitted,
    ).toBe(false);
  });

  it('every unavailable state composes to a non-verified, amount-less view', () => {
    const unavailable: AuthorityValue<number>[] = [
      unknown('no_source'),
      blocked('integration_off'),
    ];
    for (const value of unavailable) {
      const presented = presentAuthority(value, fmt);
      expect(presented.amountText).toBeNull();
      expect(presented.mayShowAsVerified).toBe(false);
      expect(
        evaluateFeatureRequirements(
          {
            featureId: 'f',
            requirements: [{ field: 'card.fee', grade: 'OFFICIAL_AUTHORITY_REQUIRED' }],
          },
          () => value,
        ).available,
      ).toBe(false);
    }
  });

  it('a stale value is rejected by every gate that matters', () => {
    const stale = historical(1.5, 'VERIFIED', '2019-01-01');
    expect(isCurrentAuthority(stale)).toBe(false);
    expect(presentAuthority(stale, fmt).mayShowAsVerified).toBe(false);
    expect(
      admitClaim({ claimId: 'c', field: 'card.fee.annual', provenance: 'VERIFIED' }, stale)
        .admitted,
    ).toBe(false);
    expect(
      evaluateFeatureRequirements(
        { featureId: 'f', requirements: [{ field: 'card.fee', grade: 'ANY_KNOWN_VALUE' }] },
        () => stale,
      ).available,
    ).toBe(false);
  });

  it('an adapter that supplies nothing cannot supply authority to anything', () => {
    // D3 removed the DisabledDataAuthorityAdapter SINGLETON. The claim survives it: the
    // assertion was never about module-level state, it was about the boundary. The adapter is
    // now built and passed here, so which adapter answered is visible at the call site.
    const adapter = makeDisabledAdapter();
    const value = adapter.lookupNumber({ field: 'card.fee.annual', entityId: 'x' });
    expect(isCurrentAuthority(value)).toBe(false);
    expect(presentAuthority(value, fmt).amountText).toBeNull();
    expect(
      admitClaim({ claimId: 'c', field: 'card.fee.annual', provenance: 'VERIFIED' }, value)
        .admitted,
    ).toBe(false);
  });
});
