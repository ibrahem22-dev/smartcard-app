/**
 * W1-AS-10 — Wave 1 integration and regression contract.
 *
 * End-to-end through the real modules and the real bundled dataset: a card the
 * user actually holds, resolved through the existing FX resolver, wrapped by
 * the authority bridge, classified, gated and presented.
 */

import { resolveFxAbroad } from '../../hooks/useFxAbroad';
import { CardIssuer } from '../../types/card.types';
import fxAbroadJson from '../../data/fxAbroad.v2.json';
import fxAbroadMapJson from '../../data/fxAbroadCardMap.json';

import { isCurrentAuthority } from '../authorityValue';
import { fxAbroadToAuthority } from '../nonAuthorityDataAccess';
import { admitClaim } from '../claimClassification';
import { presentAuthority, assertSafeRendering } from '../presentation';
import { evaluateFeatureRequirements } from '../featureDataRequirements';
import { getDataAuthorityAdapter } from '../DataAuthorityAdapter';

const FX_MAP = fxAbroadMapJson as unknown as {
  readonly map: Record<string, { readonly issuer: string; readonly cardName: string }>;
};
const FX = fxAbroadJson as unknown as {
  readonly cards: Record<string, { readonly tier: string }>;
};

const fmt = (n: number): string => `${n.toFixed(2)}%`;

/** A card that genuinely resolves in the shipped dataset. */
function firstResolvableCard(): { issuer: CardIssuer; displayName: string } | null {
  for (const [slug, entry] of Object.entries(FX_MAP.map)) {
    if (FX.cards[slug]?.tier !== 'A') {
      continue;
    }
    return {
      issuer: entry.issuer as CardIssuer,
      displayName: entry.cardName,
    };
  }
  return null;
}

describe('W1-AS-10 Wave 1 integration', () => {
  it('resolves a real bundled card end-to-end without granting it authority', () => {
    const card = firstResolvableCard();
    expect(card).not.toBeNull();
    if (card === null) {
      return;
    }

    const resolved = resolveFxAbroad(card);
    expect(resolved.status).toBe('verified');

    const wrapped = fxAbroadToAuthority(resolved);
    expect('state' in wrapped).toBe(false);
    if ('state' in wrapped) {
      return;
    }

    const fee = wrapped.fxPurchasePct;
    // The number exists and is shown -- the user paid for this comparison.
    const presented = presentAuthority(fee, fmt);
    expect(presented.amountText).not.toBeNull();
    // But it is bundled data, so no verified affordance and no financial-claim
    // admission.
    expect(isCurrentAuthority(fee)).toBe(false);
    expect(presented.mayShowAsVerified).toBe(false);
    expect(
      admitClaim(
        { claimId: 'fx', field: 'card.fx.foreignFeePercent', provenance: 'BUNDLED_DATASET' },
        fee,
      ).admitted,
    ).toBe(false);
  });

  it('keeps an uncovered card explicitly unavailable through every layer', () => {
    const resolved = resolveFxAbroad({
      issuer: CardIssuer.Cal,
      displayName: '__definitely_not_a_real_card__',
    });
    expect(resolved.status).toBe('unknown');

    const wrapped = fxAbroadToAuthority(resolved);
    expect('state' in wrapped && wrapped.state).toBe('UNKNOWN');
    if (!('state' in wrapped)) {
      return;
    }

    const presented = presentAuthority(wrapped, fmt);
    expect(presented.amountText).toBeNull();
    // The regression that matters: it must not render as 0%, free, or verified.
    for (const forbidden of ['0', '0%', '0.00%', 'free', 'verified']) {
      expect(() => assertSafeRendering(presented, forbidden)).toThrow();
    }
  });

  it('leaves an official-authority feature unavailable while integration is off', () => {
    const availability = evaluateFeatureRequirements(
      {
        featureId: 'OFFICIAL_FX_QUOTE',
        requirements: [
          { field: 'card.fx.foreignFeePercent', grade: 'OFFICIAL_AUTHORITY_REQUIRED' },
        ],
      },
      (field) => getDataAuthorityAdapter().lookupNumber({ field, entityId: 'any' }),
    );
    expect(availability.available).toBe(false);
    expect(availability.unmet[0]?.state).toBe('BLOCKED');
  });

  it('does not mutate the shipped datasets', () => {
    // The bridge is read-only over the bundle; W1-AS-07 requires the raw
    // datasets stay unchanged.
    const before = JSON.stringify(fxAbroadJson);
    const card = firstResolvableCard();
    if (card !== null) {
      fxAbroadToAuthority(resolveFxAbroad(card));
    }
    expect(JSON.stringify(fxAbroadJson)).toBe(before);
  });
});
