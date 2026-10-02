// /src/engines/fxAbroadEngine.ts
//
// "Best card abroad" ranking. Enforces the tier gate from
// DATA_READINESS_TIERS_AND_MVP_PATH_PROPOSAL: only Tier-A verified cards enter
// the ranking; cards with no verified FX triple are surfaced separately as
// unknown and contribute to no calculation (no silent default).

import type { CardInput } from '../types/card.types';
import type {
  AbroadMode,
  AbroadRankEntry,
  CardFxTriple,
  ResolvedFxAbroad,
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
/**
 * THE RESOLVER ARRIVES AS AN ARGUMENT, and that is not a style choice.
 *
 * This function used to `import { resolveFxAbroad } from '../authority/noSource'` and call it. The
 * E1 boundary lint's R1 flagged it: *"an engine may reach types and pure utils only — calculation
 * must not depend on presentation or app state."* Today `resolveFxAbroad` is a constant refusal, so
 * the import cost nothing; when D1 lands in Phase 7 it becomes a real adapter call, and an engine
 * that reaches into the data layer is an engine nobody can test from a fixture. The rule exists to
 * be obeyed BEFORE the thing it warns about arrives — which is the only order that ever works.
 *
 * The caller passes the resolver. The engine ranks.
 */
export function rankCardsAbroad(
  cards: readonly CardInput[],
  mode: AbroadMode,
  resolveFxAbroad: (card: CardInput) => ResolvedFxAbroad,
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
