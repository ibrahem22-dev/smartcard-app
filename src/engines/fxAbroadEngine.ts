// /src/engines/fxAbroadEngine.ts
//
// "Best card abroad" ranking. Enforces the tier gate from
// DATA_READINESS_TIERS_AND_MVP_PATH_PROPOSAL: only Tier-A verified cards enter
// the ranking; cards with no verified FX triple are surfaced separately as
// unknown and contribute to no calculation (no silent default).

import { resolveFxAbroad } from '../hooks/useFxAbroad';
import type { CardInput } from '../types/card.types';
import type {
  AbroadMode,
  AbroadRankEntry,
  CardFxTriple,
  FxLeg,
} from '../types/fxAbroad.types';

export interface AbroadRanking {
  /** Tier-A cards for this mode, cheapest fee first. Only these may rank. */
  readonly ranked: readonly AbroadRankEntry[];
  /** Cards with no verified FX data — show as "not yet confirmed", never rank. */
  readonly unknown: readonly CardInput[];
}

function legForMode(triple: CardFxTriple, mode: AbroadMode): FxLeg {
  return mode === 'purchase'
    ? triple.fxPurchasePct
    : triple.fxCashWithdrawalForeign;
}

/**
 * Rank the user's cards for a foreign transaction in the given mode.
 *
 * A mode selects one leg type, so all ranked legs share a unit (percentage for
 * purchase and foreign cash withdrawal) and are directly comparable. Ties keep
 * input order (stable sort). Uncovered cards never enter `ranked`.
 */
export function rankCardsAbroad(
  cards: readonly CardInput[],
  mode: AbroadMode,
): AbroadRanking {
  const ranked: AbroadRankEntry[] = [];
  const unknown: CardInput[] = [];

  for (const card of cards) {
    const resolved = resolveFxAbroad(card);
    if (resolved.status === 'verified') {
      ranked.push({
        card,
        triple: resolved.triple,
        leg: legForMode(resolved.triple, mode),
      });
    } else {
      unknown.push(card);
    }
  }

  ranked.sort(
    (a: AbroadRankEntry, b: AbroadRankEntry): number =>
      a.leg.value - b.leg.value,
  );

  return { ranked, unknown };
}
