/**
 * THE CARD SCORING ENGINE — criterion N1, roadmap §7.1 / §10 P3, product spec §20.1.
 *
 * The engine has one deliberately narrow opinion: rank available owned cards by effective cost.
 * It does not invent fee, FX, waiver or benefit facts; callers supply their already-resolved ILS
 * cost and, optionally, already-matched benefit values. A later benefits-pack publication therefore
 * widens the optional input without changing this engine's architecture (roadmap §7.1).
 *
 * Scores are relative within the supplied wallet: best cost = 100, worst cost = 0, with linear
 * interpolation between them. When every cost ties, every card earns 100 and the stable card-id
 * tie-break makes output deterministic. The money delta remains the primary explanation; the score
 * is only a compact secondary representation (product spec §9).
 */
import type { ProvenanceChip } from '../authority/provenanceChip';
import { provenanced, type ProvenancedNumber } from './provenance';
import { step, trace, type ReasonTrace } from './reasonTrace';

/** One owned card after fee/FX/waiver resolution by their owning engines and adapter. */
export interface ScoringCard {
  readonly cardId: string;
  readonly available: boolean;
  /**
   * ABSENT means the card's cost could not be resolved (unknown FX/ATM leg) — the same honesty
   * lane as fx.ts's unknownCards. An absent cost is never a zero and never a ranking position;
   * the card is reported in `unknownCostCards` so the surface can say WHY it is silent.
   */
  readonly costIls?: ProvenancedNumber;
}

/**
 * A benefit already matched and stack-resolved by the benefits lane. This engine only applies the
 * supplied effective ILS value; it never guesses applicability or combinability.
 */
export interface ScoringBenefit {
  readonly benefitId: string;
  readonly cardId: string;
  readonly effectiveValueIls: ProvenancedNumber;
}

export interface ScoringInput {
  readonly cards: readonly ScoringCard[];
  /** Optional by contract: omitted and an empty list have exactly the same scoring behaviour. */
  readonly benefits?: readonly ScoringBenefit[];
  /**
   * The FX comparison's D1 verdict (roadmap §5.3 interim behaviour), passed through when this
   * ranking prices a foreign purchase. THE RULE HAS ONE HOME — fx.ts decides it from the cited
   * threshold; this engine obeys it. When true, "costs X more" claims are OMITTED, not zeroed:
   * an unsuppressed delta here would contradict the engine that computed the very costs being
   * compared, which is the two-surfaces-two-numbers defect spec §20 exists to prevent.
   */
  readonly deltasSuppressed?: boolean;
}

export interface ScoredCard {
  readonly cardId: string;
  /** Relative 0–100 score. The sorted array, not this figure, is the authoritative rank. */
  readonly score: ProvenancedNumber;
  /** Cost after optional, already-resolved benefit value; never below zero. */
  readonly effectiveCostIls: ProvenancedNumber;
  /**
   * Additional ILS cost versus the best available card; zero for joint winners. OMITTED when the
   * input carries `deltasSuppressed` — an absent claim is honest, a suppressed-then-shown one is not.
   */
  readonly deltaFromBestIls?: ProvenancedNumber;
  /** Present only when at least one supplied benefit contributed to this card. */
  readonly benefitValueAppliedIls?: ProvenancedNumber;
  readonly appliedBenefitIds: readonly string[];
  readonly trace: ReasonTrace;
}

export interface ScoringResult {
  readonly ranked: readonly ScoredCard[];
  /** Unavailable cards are explicit and never receive a fabricated score. */
  readonly unavailableCards: readonly string[];
  /** Available cards whose cost could not be resolved — reported, never ranked, never guessed. */
  readonly unknownCostCards: readonly string[];
  readonly trace: ReasonTrace;
}

const DERIVED_PROVENANCE: Extract<ProvenanceChip, 'ESTIMATE'> = 'ESTIMATE';

function assertUsableNumber(label: string, number: ProvenancedNumber): void {
  if (!Number.isFinite(number.value) || number.value < 0) {
    throw new Error(label + ': refusing a negative or non-finite monetary input');
  }
  if (number.provenance === 'UNKNOWN') {
    throw new Error(label + ': UNKNOWN cannot accompany a calculable number');
  }
}

/** Rank available owned cards by effective cost, ascending, with stable card-id tie-breaking. */
export function scoreCards(input: ScoringInput): ScoringResult {
  const ids = new Set<string>();
  for (const card of input.cards) {
    if (!card.cardId.trim()) throw new Error('a scoring card must have a cardId');
    if (ids.has(card.cardId)) throw new Error(card.cardId + ': duplicate cardId in scoring input');
    ids.add(card.cardId);
    // A PRESENT cost with an UNKNOWN chip is a contradiction, not a fact — refuse it. An ABSENT
    // cost is the honest shape for "could not resolve" and takes the unknownCostCards lane below.
    if (card.costIls !== undefined) assertUsableNumber(card.cardId + ' costIls', card.costIls);
  }

  const benefitTotals = new Map<string, { value: number; ids: string[] }>();
  for (const benefit of input.benefits ?? []) {
    if (!ids.has(benefit.cardId)) {
      throw new Error(benefit.benefitId + ': matched benefit names a card outside the wallet');
    }
    assertUsableNumber(benefit.benefitId + ' effectiveValueIls', benefit.effectiveValueIls);
    const current = benefitTotals.get(benefit.cardId) ?? { value: 0, ids: [] };
    current.value += benefit.effectiveValueIls.value;
    current.ids.push(benefit.benefitId);
    benefitTotals.set(benefit.cardId, current);
  }

  const unavailableCards = input.cards.filter((card) => !card.available).map((card) => card.cardId);
  const unknownCostCards = input.cards
    .filter((card) => card.available && card.costIls === undefined)
    .map((card) => card.cardId);
  const priced = input.cards
    .filter((card): card is ScoringCard & { readonly costIls: ProvenancedNumber } =>
      card.available && card.costIls !== undefined)
    .map((card) => {
      const benefit = benefitTotals.get(card.cardId);
      // The predicate above + the UNKNOWN refusal in the loop mean costIls is a fact here.
      const resolved: ProvenancedNumber = card.costIls;
      return {
        card,
        resolved,
        benefitValue: benefit?.value ?? 0,
        benefitIds: benefit?.ids ?? [],
        effectiveCost: Math.max(0, resolved.value - (benefit?.value ?? 0)),
      };
    });
  priced.sort((a, b) => a.effectiveCost - b.effectiveCost
    || a.card.cardId.localeCompare(b.card.cardId, 'en'));

  const best = priced[0]?.effectiveCost;
  const worst = priced[priced.length - 1]?.effectiveCost;
  const spread = best === undefined || worst === undefined ? 0 : worst - best;
  const ranked = priced.map(({ card, resolved, benefitValue, benefitIds, effectiveCost }): ScoredCard => {
    const delta = effectiveCost - (best ?? effectiveCost);
    const relativeScore = spread === 0 ? 100 : ((worst! - effectiveCost) / spread) * 100;
    // ADR-013 §3 grades the DERIVATION, not the fact: an unmodified cost IS its input figure and
    // keeps the chip (and staleness) it arrived with; only a benefit-adjusted cost is a new,
    // derived figure and earns ESTIMATE.
    const modified = benefitValue > 0;
    const effectiveCostIls = modified ? provenanced(effectiveCost, DERIVED_PROVENANCE) : resolved;
    const cardTrace = trace('scoring', [
      step(
        'product spec §20.1 effective cost',
        'ranked the available owned card on its supplied ILS cost after optional matched benefits',
        ['costIls', ...(benefitIds.length ? ['benefits'] : [])],
      ),
      step(
        'roadmap §10 P3 card scoring',
        'computed the delta from the best effective cost and a relative 0–100 secondary score',
        ['effectiveCostIls', 'bestEffectiveCostIls', 'worstEffectiveCostIls'],
      ),
      ...(input.deltasSuppressed
        ? [step(
            'roadmap §5.3 Task D1 interim',
            'the comparison flagged small-amount ordering as advisory: savings claims are '
              + 'suppressed here too — one rule, one home (fx.ts), obeyed everywhere',
            ['deltasSuppressed'],
          )]
        : []),
    ]);
    return {
      cardId: card.cardId,
      score: provenanced(relativeScore, DERIVED_PROVENANCE),
      effectiveCostIls,
      ...(input.deltasSuppressed
        ? {}
        : { deltaFromBestIls: provenanced(delta, DERIVED_PROVENANCE) }),
      ...(benefitIds.length
        ? { benefitValueAppliedIls: provenanced(benefitValue, DERIVED_PROVENANCE) }
        : {}),
      appliedBenefitIds: [...benefitIds],
      trace: cardTrace,
    };
  });

  return {
    ranked,
    unavailableCards,
    unknownCostCards,
    trace: trace('scoring', [
      step(
        'product spec §20.1 ranked cards',
        'ranked available owned cards by one effective-cost path; unavailable and '
          + 'unknown-cost cards stayed out of the ranking and were named instead',
        ['cards', ...(input.benefits === undefined ? [] : ['benefits'])],
      ),
    ]),
  };
}
