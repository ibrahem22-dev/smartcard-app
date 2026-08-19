import { admitClaim, classifyClaim } from '../claimClassification';
import { blocked, historical, known, unknown } from '../authorityValue';

describe('W1-AS-04 business rules vs financial data claims', () => {
  it('classifies issuer monetary fields as financial claims', () => {
    for (const field of [
      'card.fee.annual',
      'card.fx.foreignFeePercent',
      'card.interest.apr',
      'card.cashback.rate',
    ]) {
      const c = classifyClaim({ claimId: 'c', field, provenance: 'BUNDLED_DATASET' });
      expect(c.kind).toBe('FINANCIAL_DATA_CLAIM');
      expect(c.requiresOfficialAuthority).toBe(true);
    }
  });

  it('classifies app behaviour as business rules needing no authority', () => {
    for (const field of ['ui.showBadge', 'feature.installmentGate', 'display.order']) {
      const c = classifyClaim({ claimId: 'c', field, provenance: 'DERIVED_CALCULATION' });
      expect(c.kind).toBe('BUSINESS_RULE');
      expect(c.requiresOfficialAuthority).toBe(false);
    }
  });

  it('cannot be talked out of the financial classification by provenance', () => {
    // A caller claiming "this is just a derived UI value" does not change what
    // the field asserts.
    const c = classifyClaim({
      claimId: 'c',
      field: 'card.fx.foreignFeePercent',
      provenance: 'DERIVED_CALCULATION',
    });
    expect(c.kind).toBe('FINANCIAL_DATA_CLAIM');
    expect(c.requiresOfficialAuthority).toBe(true);
  });

  it('fails closed on an unrecognised field', () => {
    const c = classifyClaim({
      claimId: 'c',
      field: 'something.unmapped',
      provenance: 'BUNDLED_DATASET',
    });
    expect(c.kind).toBe('UNCLASSIFIED');
    expect(c.requiresOfficialAuthority).toBe(true);
  });

  it('admits a financial claim only on current official authority', () => {
    const claim = {
      claimId: 'c',
      field: 'card.fx.foreignFeePercent',
      provenance: 'OFFICIAL_AUTHORITY' as const,
    };
    expect(
      admitClaim(claim, known(2.8, 'OFFICIAL_AUTHORITY', '2026-01-01')).admitted,
    ).toBe(true);
    // Bundled, stale, unknown and blocked all fail.
    expect(admitClaim(claim, known(2.8, 'BUNDLED_DATASET', '2026-01-01')).admitted).toBe(false);
    expect(admitClaim(claim, historical(2.8, 'OFFICIAL_AUTHORITY', '2019-01-01')).admitted).toBe(false);
    expect(admitClaim(claim, unknown('none')).admitted).toBe(false);
    expect(admitClaim(claim, blocked('off')).admitted).toBe(false);
  });

  it('admits a business rule without authority but never calls it verified', () => {
    const admission = admitClaim(
      { claimId: 'c', field: 'ui.showBadge', provenance: 'DERIVED_CALCULATION' },
      unknown('no authority needed'),
    );
    expect(admission.admitted).toBe(true);
    expect(admission.classification.kind).toBe('BUSINESS_RULE');
    expect(admission.classification.requiresOfficialAuthority).toBe(false);
  });
});
