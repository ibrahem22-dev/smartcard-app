import {
  evaluateAgainstAdapter,
  evaluateFeatureRequirements,
  isStaleSubstitution,
  type FeatureRequirementSpec,
} from '../featureDataRequirements';
import { blocked, historical, known, unknown } from '../authorityValue';
import { makeDisabledAdapter } from '../../../tools/p2/jest/disabledAdapter';

const SPEC: FeatureRequirementSpec = {
  featureId: 'FX_COMPARISON',
  requirements: [
    { field: 'card.fx.foreignFeePercent', grade: 'OFFICIAL_AUTHORITY_REQUIRED' },
    { field: 'card.name', grade: 'ANY_KNOWN_VALUE' },
    { field: 'card.logo', grade: 'OPTIONAL' },
  ],
};

describe('W1-AS-05 feature data requirements', () => {
  it('is available only when every requirement is met at its grade', () => {
    const result = evaluateFeatureRequirements(SPEC, (field) =>
      field === 'card.fx.foreignFeePercent'
        ? known(2.8, 'VERIFIED', '2026-01-01')
        : known('x', 'ESTIMATE', '2026-01-01'),
    );
    expect(result.available).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it('blocks when official authority is missing, naming the field', () => {
    const result = evaluateFeatureRequirements(SPEC, (field) =>
      field === 'card.fx.foreignFeePercent'
        ? blocked('integration_off')
        : known('x', 'ESTIMATE', '2026-01-01'),
    );
    expect(result.available).toBe(false);
    expect(result.unmet).toHaveLength(1);
    expect(result.unmet[0]?.field).toBe('card.fx.foreignFeePercent');
    expect(result.unmet[0]?.state).toBe('BLOCKED');
  });

  it('refuses a bundled value where official authority is required', () => {
    const result = evaluateFeatureRequirements(SPEC, () =>
      known(2.8, 'ESTIMATE', '2026-01-01'),
    );
    expect(result.available).toBe(false);
  });

  it('never accepts a historical value for ANY_KNOWN_VALUE', () => {
    // The stale-substitution trap: a historical number has a `value`, so a
    // naive "do we have a number?" check would accept it.
    const result = evaluateFeatureRequirements(SPEC, (field) =>
      field === 'card.fx.foreignFeePercent'
        ? known(2.8, 'VERIFIED', '2026-01-01')
        : historical('old name', 'VERIFIED', '2019-01-01'),
    );
    expect(result.available).toBe(false);
    expect(result.unmet[0]?.field).toBe('card.name');
    expect(isStaleSubstitution('ANY_KNOWN_VALUE', historical(1, 'VERIFIED', '2019-01-01'))).toBe(true);
    expect(isStaleSubstitution('OPTIONAL', historical(1, 'VERIFIED', '2019-01-01'))).toBe(false);
  });

  it('reports degraded when only optional data is missing', () => {
    const result = evaluateFeatureRequirements(SPEC, (field) => {
      if (field === 'card.fx.foreignFeePercent') {
        return known(2.8, 'VERIFIED', '2026-01-01');
      }
      if (field === 'card.name') {
        return known('x', 'ESTIMATE', '2026-01-01');
      }
      return unknown('no_logo');
    });
    expect(result.available).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('is unavailable against an adapter that supplies nothing, which is the honest answer', () => {
    // The adapter is supplied explicitly since D3 removed the singleton default.
    const result = evaluateAgainstAdapter(SPEC, 'cal-365-vip', makeDisabledAdapter());
    expect(result.available).toBe(false);
    // Both non-optional requirements fail; the optional one passes.
    expect(result.unmet.map((u) => u.state)).toEqual(['BLOCKED', 'BLOCKED']);
  });
});
