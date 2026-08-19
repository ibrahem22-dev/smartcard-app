import { resolveFxAbroad } from '../../hooks/useFxAbroad';
import { CardIssuer } from '../../types/card.types';
import { isCurrentAuthority } from '../authorityValue';
import {
  BUNDLED_DATASET_PROVENANCE,
  fxAbroadToAuthority,
} from '../nonAuthorityDataAccess';
import {
  evaluateFeatureRequirements,
  type FeatureRequirementSpec,
} from '../featureDataRequirements';
import fxAbroadJson from '../../data/fxAbroad.v2.json';

const FX = fxAbroadJson as unknown as {
  readonly cards: Record<string, { readonly tier: string }>;
};

describe('W1-AS-08 bundled data can never satisfy official authority', () => {
  it('classifies bundled provenance outside authority grade', () => {
    expect(BUNDLED_DATASET_PROVENANCE).toBe('BUNDLED_DATASET');
  });

  it('maps every bundled Tier-A card to non-authority values', () => {
    const tierA = Object.keys(FX.cards).filter(
      (slug) => FX.cards[slug]?.tier === 'A',
    );
    // The dataset must actually contain Tier-A cards, or this proves nothing.
    expect(tierA.length).toBeGreaterThan(0);

    for (const slug of tierA) {
      const resolved = resolveFxAbroad({
        issuer: CardIssuer.Cal,
        displayName: slug,
      });
      const wrapped = fxAbroadToAuthority(resolved);
      if ('state' in wrapped) {
        // Unresolved is fine -- it is explicitly unavailable.
        expect(wrapped.state).toBe('UNKNOWN');
        continue;
      }
      // Resolved bundled data is KNOWN but NOT current official authority.
      expect(wrapped.fxPurchasePct.state).toBe('KNOWN');
      expect(isCurrentAuthority(wrapped.fxPurchasePct)).toBe(false);
      expect(isCurrentAuthority(wrapped.fxCashWithdrawalForeign)).toBe(false);
      expect(isCurrentAuthority(wrapped.withdrawalSameCurrency)).toBe(false);
    }
  });

  it('leaves an unresolved card explicitly unknown, never defaulted', () => {
    const resolved = resolveFxAbroad({
      issuer: CardIssuer.Cal,
      displayName: '__no_such_card_anywhere__',
    });
    expect(resolved.status).toBe('unknown');
    const wrapped = fxAbroadToAuthority(resolved);
    expect('state' in wrapped && wrapped.state).toBe('UNKNOWN');
  });

  it('fails a feature that demands official authority for an FX field', () => {
    const spec: FeatureRequirementSpec = {
      featureId: 'FX_ABROAD_OFFICIAL',
      requirements: [
        { field: 'card.fx.foreignFeePercent', grade: 'OFFICIAL_AUTHORITY_REQUIRED' },
      ],
    };
    const resolved = resolveFxAbroad({
      issuer: CardIssuer.Cal,
      displayName: Object.keys(FX.cards)[0] ?? 'unknown',
    });
    const wrapped = fxAbroadToAuthority(resolved);
    const value = 'state' in wrapped ? wrapped : wrapped.fxPurchasePct;

    const availability = evaluateFeatureRequirements(spec, () => value);
    expect(availability.available).toBe(false);
    expect(availability.unmet).toHaveLength(1);
  });
});
