import { evaluateSurfaceEngines } from '../surfaceEngines';
import type { SurfaceContext } from '../surfaceContext';
import { suggestedCommitmentCapIls } from '../commitmentCap';

const context = (monthlyIncome: number, strongWarningRatio?: number): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:commitment-cap',
    monthlyIncome,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [],
  installments: [],
  loans: [],
  purchases: [],
  ...(strongWarningRatio === undefined
    ? {}
    : {
        thresholds: {
          warningRatio: { value: 0.2, provenance: 'USER' },
          strongWarningRatio: { value: strongWarningRatio, provenance: 'USER' },
          blockedRatio: { value: 0.7, provenance: 'USER' },
        },
      }),
});

describe('commitment cap suggestion', () => {
  it('derives the suggested cap from the engine threshold and the income', () => {
    const results = evaluateSurfaceEngines(context(12_000));
    if (results.load === null || results.context.profile === null) {
      throw new Error('the cap fixture must produce a load result and profile');
    }

    expect(suggestedCommitmentCapIls(results)).toBe(
      results.context.profile.monthlyIncome
        * results.load.thresholds.strongWarningRatio.value,
    );
  });

  it('uses the engine threshold rather than a literal', () => {
    const results = evaluateSurfaceEngines(context(10_000, 0.41));

    expect(suggestedCommitmentCapIls(results)).toBe(4_100);
  });

  it('returns no suggestion when income is unknown', () => {
    const results = evaluateSurfaceEngines(context(0));

    expect(suggestedCommitmentCapIls(results)).toBeNull();
  });
});
