/**
 * MERCHANT RADAR — "where are you shopping today?", answered from the estate or not at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE MAPS AND JOINS. IT DOES NOT RANK AND IT DOES NOT INVENT.
 *
 * The Check surfaces may not hold recommendation logic in either direction (criterion B1), so the
 * merchant answer is composed here and rendered there. What "composed" means is narrow: read the
 * merchant the user chose, read the benefits the ESTATE links to that merchant, keep the ones the
 * estate also links to a card this user holds, and say which of the three different nothings is
 * left when none survive. No ordering happens here; where a general ranking is shown it is
 * `scoreFromVault`'s, unchanged, which is the same derivation Wallet's chips and the Verdict's
 * recommendation come from — a second ranking path is A1's declared negative control.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE SHIPPED CORPUS ACTUALLY SUPPORTS, STATED PLAINLY
 *
 * The benefits pack carries `eligibleMerchantIds` on **6 of 700** rows, and of the five merchants
 * the Owner named for the checkout chips exactly one — Super-Pharm — is named by any benefit at
 * all, by a row that links to no card. So for every quick chip the truthful answer today is *"no
 * verified merchant-specific recommendation is currently available"*, and this module's job is to
 * produce that answer from the data rather than to work around it.
 *
 * A CATEGORY IS NOT A BENEFIT. `canonicalCategory` is returned for context and never converted
 * into a recommendation: most rows carry `canonicalCategoryBasis:
 * CARRIED_FROM_THE_DISCOVERY_REGISTRY_NOT_RE_CONFIRMED`, and inferring "this is a grocery shop, so
 * the grocery card wins" would be an inference nobody in the estate made.
 */
import {
  merchantBenefitsFor,
  merchantById,
  type MerchantBenefitAbsence,
  type MerchantBenefitView,
  type MerchantView,
} from '../authority/merchantAuthority';
import type { ScoringResult } from '../engines/scoring';
import { scoreFromVault } from './scoringInput';
import type { EngineCard } from '../types/card.types';

/** What the radar can say about a merchant. Three answers, and they are not interchangeable. */
export type MerchantAdviceKind =
  /** The estate links a benefit to this merchant AND to a card this user holds. */
  | 'VERIFIED_MERCHANT_BENEFIT'
  /** No verified merchant-specific benefit. `absence` says which kind of no this is. */
  | 'NO_VERIFIED_MERCHANT_BENEFIT';

export interface MerchantAdvice {
  readonly merchant: MerchantView;
  readonly kind: MerchantAdviceKind;
  /** Present exactly when `kind` is NO_VERIFIED_MERCHANT_BENEFIT. */
  readonly absence?: MerchantBenefitAbsence;
  /** Benefits the estate links to BOTH this merchant and a held card. Empty on the absent lane. */
  readonly usableBenefits: readonly MerchantBenefitView[];
  /** Benefits the estate links to this merchant at all — context, never a claim about this wallet. */
  readonly evidencedForMerchant: readonly MerchantBenefitView[];
  /**
   * The wallet-level ranking, UNCHANGED, from the one canonical derivation.
   *
   * Shown only where a surface can label it GENERAL rather than merchant-specific. It is `null`
   * whenever `scoreFromVault` returns null and its `ranked` array is empty whenever nothing priced
   * the wallet — which, with no purchase amount and no installment plan, it does not.
   */
  readonly generalRanking: ScoringResult | null;
}

/**
 * The radar's answer for one merchant, or `null` when the id names no merchant the pack holds.
 *
 * `null` and "no benefit" are deliberately different returns: an unknown id is a defect in the
 * caller, and an absent benefit is a fact about the corpus.
 */
export function merchantAdvice(
  merchantId: string,
  cards: readonly EngineCard[],
): MerchantAdvice | null {
  const merchant = merchantById(merchantId);
  if (merchant === undefined) return null;

  /* The estate keys a benefit to a CATALOG PRODUCT id, and a vault card carries that id as
     `cardProductId`. A fixture card without one falls back to its own id, which will simply match
     nothing — the honest outcome, and never a wildcard. */
  const productIds = cards.map((card) => card.cardProductId ?? card.cardId);
  const reading = merchantBenefitsFor(merchantId, productIds);
  const generalRanking = scoreFromVault({ cards });

  if (reading.usable.length > 0) {
    return {
      merchant,
      kind: 'VERIFIED_MERCHANT_BENEFIT',
      usableBenefits: reading.usable,
      evidencedForMerchant: reading.evidencedForMerchant,
      generalRanking,
    };
  }

  return {
    merchant,
    kind: 'NO_VERIFIED_MERCHANT_BENEFIT',
    ...(reading.absence === undefined ? {} : { absence: reading.absence }),
    usableBenefits: [],
    evidencedForMerchant: reading.evidencedForMerchant,
    generalRanking,
  };
}

export type { MerchantBenefitAbsence, MerchantView };
