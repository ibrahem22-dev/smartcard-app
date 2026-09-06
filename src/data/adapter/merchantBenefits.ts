/**
 * THE MERCHANT → BENEFIT → CARD EDGE, AS THE ESTATE PUBLISHED IT — and mostly as it did not.
 *
 * `AdapterBenefit.eligibleMerchantIds` is the only evidenced link between a shop and a benefit in
 * the shipped corpus. Its own adapter comment states the population: *"13 of 843 estate rows
 * declare the pair"*, and the shipped `benefits` pack carries the pair on **6 of 700** rows.
 * Merchant Radar therefore answers "is there a verified benefit at this shop?" with **no** almost
 * everywhere, and this module is where that no is produced from the data rather than assumed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE ANSWER CARRIES A REASON AND NOT JUST AN EMPTY LIST
 *
 * Three different facts all render as "no merchant-specific recommendation", and a consumer that
 * cannot tell them apart will eventually word one of them as another:
 *
 *   · `NO_EVIDENCED_BENEFIT`  — the estate links no benefit to this merchant at all;
 *   · `NOT_LINKED_TO_A_CARD`  — a benefit names the merchant and names no card, so it cannot be
 *                                attached to anything in the user's wallet;
 *   · `NOT_IN_THIS_WALLET`    — the benefit names cards, and none of them is one the user holds.
 *
 * The third is the only one where the user could act by acquiring a card; the first is a statement
 * about the corpus. Collapsing them would let the app say "your cards do not qualify" when the
 * truth is "nobody recorded a benefit here".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NOTHING IS INFERRED FROM CATEGORY
 *
 * A merchant's `canonicalCategory` is returned for context, never as a benefit. A benefit derived
 * from "this is a GROCERY shop and that card rewards groceries" would be an inference the estate
 * did not make, and `canonicalCategoryBasis` on most rows literally reads
 * `CARRIED_FROM_THE_DISCOVERY_REGISTRY_NOT_RE_CONFIRMED`.
 */
import { allBenefits, type BenefitView } from './benefitEligibility';

export type MerchantBenefitView = BenefitView;

/**
 * ONE READ OF THE BENEFITS PACK, IN ONE MODULE — addendum §9.
 *
 * This file used to open the pack itself. It now asks `benefitEligibility.ts`, which is the single
 * eligibility layer the Benefits Hub and Merchant Radar share, so the two surfaces cannot end up
 * holding different opinions about whether a benefit reaches a wallet. What stays here is the one
 * thing that is genuinely merchant-shaped: classifying WHICH kind of nothing an empty answer is.
 */
function readBenefits(): readonly MerchantBenefitView[] {
  return allBenefits();
}

/** Why a merchant produced no benefit this wallet can use. Never collapsed into one another. */
export type MerchantBenefitAbsence =
  | 'NO_EVIDENCED_BENEFIT'
  | 'NOT_LINKED_TO_A_CARD'
  | 'NOT_IN_THIS_WALLET';

export interface MerchantBenefitReading {
  /** Benefits the estate links to this merchant AND to at least one card the user holds. */
  readonly usable: readonly MerchantBenefitView[];
  /** Every benefit the estate links to this merchant, wallet or not. */
  readonly evidencedForMerchant: readonly MerchantBenefitView[];
  /** Present exactly when `usable` is empty, and it says which kind of empty this is. */
  readonly absence?: MerchantBenefitAbsence;
}

/**
 * A benefit is only usable if the estate itself both named the merchant AND named a card.
 *
 * `cardIds` is documented as the cards a benefit is *evidenced for*, with excluded and absent ids
 * counted rather than dropped. An empty `cardIds` therefore means the estate linked the benefit to
 * no product at all — not that it applies to every card.
 */
export function merchantBenefitsFor(
  merchantId: string,
  walletCardProductIds: readonly string[],
): MerchantBenefitReading {
  const evidencedForMerchant = readBenefits().filter((benefit) =>
    (benefit.eligibleMerchantIds ?? []).includes(merchantId),
  );
  if (evidencedForMerchant.length === 0) {
    return { usable: [], evidencedForMerchant, absence: 'NO_EVIDENCED_BENEFIT' };
  }

  const linked = evidencedForMerchant.filter((benefit) => benefit.cardIds.length > 0);
  if (linked.length === 0) {
    return { usable: [], evidencedForMerchant, absence: 'NOT_LINKED_TO_A_CARD' };
  }

  const held = new Set(walletCardProductIds);
  const usable = linked.filter((benefit) => benefit.cardIds.some((id) => held.has(id)));
  return usable.length === 0
    ? { usable, evidencedForMerchant, absence: 'NOT_IN_THIS_WALLET' }
    : { usable, evidencedForMerchant };
}

/** Merchant ids the shipped benefits pack links to at least one benefit. Usually a very short list. */
export function merchantsWithEvidencedBenefits(): readonly string[] {
  const ids = new Set<string>();
  for (const benefit of readBenefits()) {
    for (const id of benefit.eligibleMerchantIds ?? []) ids.add(id);
  }
  return [...ids].sort();
}
