/**
 * THE PURCHASE COST LANE — what a specific purchase actually costs on each of the user's cards.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS CLOSES, WHICH IS NOT THE ONE THE ARCHITECTURE ALREADY FIXED
 *
 * Owner ruling OQ-P5-002 repaired the COMPOSITION: `checkLoop` calls `scoreFromVault` and
 * `composeRecommendation`, the Verdict receives a recommendation and a runner-up from the same
 * canonical derivation Wallet's chips rank from, and `recommendedCard` is no longer decided by the
 * loop's silence. All of that is true at HEAD and none of it is re-done here.
 *
 * What was still true at HEAD is that **nothing supplied a cost**. `scoringInput.ts` says so in as
 * many words: *"No production path populates `scoringCosts` — the FX/cost lane that would is not
 * built — so in the shipped app the ranking is honestly empty."* An engine handed no priced card
 * ranks none, so `ranked[0]` was `undefined` on every real device and the recommendation block was
 * omitted every time. The architecture was right and the answer was always absent.
 *
 * This file is that missing lane, for the shekel spine.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT IS HONEST TO PRICE, AND WHAT IT IS NOT
 *
 * A domestic single-payment purchase in shekels costs the SAME on every card the user holds. There
 * is no per-transaction fee in the Israeli model, and the card's monthly fee is a cost of HOLDING
 * the card rather than of making this purchase. Pricing that difference at zero and letting the
 * engine's alphabetical tie-break crown a winner would manufacture a recommendation out of a
 * tie — precisely what OQ-P5-002 forbids and what `?? 0` did in an earlier life. So the lane
 * returns `NOT_PRICEABLE`, the ranking stays empty, and the Verdict says why.
 *
 * An INSTALLMENT purchase is different, and it is different from a real, sourced, per-card fact:
 * `cardRates.installmentInterestRate` is the card's own published installment rate, and
 * `calculateInstallmentInterest` is the Spitzer engine the app already ships. Total interest over
 * the plan is a genuine marginal cost of putting THIS purchase on THAT card, it differs between
 * cards, and it is arithmetic on a published rate rather than an opinion about one.
 *
 * A card with no published rate is not priced at zero. It goes unpriced, the scoring engine
 * reports it in `unknownCostCards`, and no surface may paint it as a winner — the honesty lane
 * `scoring.ts` already owns.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE PRICES. IT DOES NOT RANK.
 *
 * No ordering happens here, no score, no tie-break, no comparison between cards. It produces the
 * `scoringCosts` map `scoreFromVault` already takes, and `scoreCards` remains the only thing in
 * the app that decides which card is best — the same separation `runPurchaseCheck` states for the
 * verdict and `scoringInput.ts` states for the ranking.
 */
import { calculateInstallmentInterest } from '../engines/interestCalculator';
import {
  CONSUMER_CREDIT_ANNUAL_RATE_MIN_PCT,
  CONSUMER_CREDIT_ANNUAL_RATE_MAX_PCT,
} from '../config/financial';
import type { EngineCard } from '../types/card.types';
import { Currency } from '../types/purchase.types';
import type { CheckInputDraft } from '../screens/check/CheckInputScreen';

/**
 * What priced the ranking — carried to the surface so it can say what the recommendation is about.
 *
 * `NOT_PRICEABLE` is a first-class answer and not a failure: "these cards cost the same for this
 * purchase" is a true and useful sentence, and it is a different sentence from "we could not work
 * it out".
 */
export type PurchaseCostBasis = 'INSTALLMENT_INTEREST' | 'NOT_PRICEABLE';

export interface PurchaseCostReading {
  readonly basis: PurchaseCostBasis;
  /** ILS cost of THIS purchase on each card the lane could price, keyed by cardId. */
  readonly costs: Readonly<Record<string, number>>;
  /** Available cards the lane could not price, and the reason it could not. Never a zero. */
  readonly unpricedCardIds: readonly string[];
}

const NOT_PRICEABLE: PurchaseCostReading = {
  basis: 'NOT_PRICEABLE',
  costs: {},
  unpricedCardIds: [],
};

/** The statutory band the interest engine itself validates against. One home, cited not copied. */
function usableRate(rate: number | undefined): rate is number {
  return (
    typeof rate === 'number'
    && Number.isFinite(rate)
    && rate >= CONSUMER_CREDIT_ANNUAL_RATE_MIN_PCT
    && rate <= CONSUMER_CREDIT_ANNUAL_RATE_MAX_PCT
  );
}

/**
 * Price one purchase across the wallet.
 *
 * Foreign currency is not this lane's: the FX comparison owns it, and pricing a foreign purchase
 * from a shekel installment rate would be an answer to a question nobody asked.
 */
export function purchaseCosts(
  draft: CheckInputDraft,
  cards: readonly EngineCard[],
): PurchaseCostReading {
  if (draft.currency !== Currency.ILS) return NOT_PRICEABLE;
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) return NOT_PRICEABLE;

  const months = draft.installments;
  if (months === null || !Number.isInteger(months) || months < 2) return NOT_PRICEABLE;

  const available = cards.filter((card) => card.isActive);
  if (available.length === 0) return NOT_PRICEABLE;

  const costs: Record<string, number> = {};
  const unpricedCardIds: string[] = [];
  for (const card of available) {
    const rate = card.cardRates?.installmentInterestRate;
    if (!usableRate(rate)) {
      unpricedCardIds.push(card.cardId);
      continue;
    }
    try {
      costs[card.cardId] = calculateInstallmentInterest(draft.amount, months, rate).totalInterest;
    } catch {
      /* The engine refuses an input it cannot honestly amortise — a term past 360 months, an
         amount it will not take. An unpriced card is the honest outcome; a caught exception must
         never become a zero. */
      unpricedCardIds.push(card.cardId);
    }
  }

  /* A lane that priced nothing has not priced this purchase, and saying INSTALLMENT_INTEREST over
     an empty map would tell the surface a basis it cannot show. */
  if (Object.keys(costs).length === 0) {
    return { basis: 'NOT_PRICEABLE', costs: {}, unpricedCardIds };
  }

  return { basis: 'INSTALLMENT_INTEREST', costs, unpricedCardIds };
}
