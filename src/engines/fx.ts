/**
 * THE FX ENGINE — criterion N3, roadmap §10 P3 / §7.3, ADR-013.
 *
 *   > *"The FX engine computes amount x rate x (1 + FX%) + fixed fees on the original currency's
 *   > representative rate, resolves card-level exceptions longest-name-first, marks D1 advisory on
 *   > small amounts and labels a minor-currency ATM figure a floor."*
 *
 * THE FOUR NAMED BEHAVIOURS, AND WHERE EACH RULE COMES FROM
 *
 * 1. THE ARITHMETIC has exactly one implementation: `convertToIls` in currency.ts (OD-23b put the
 *    quoteUnit divide there once). This engine ranks its outputs; it never re-derives a shekel.
 * 2. CARD-LEVEL EXCEPTIONS resolve most-specific-first: an exact issuer x operator row beats the
 *    issuer default, and an issuer default does NOT reach an operator it explicitly excepts
 *    (`appliesToAllOperatorsExcept`, shipped on the catalog's fx rows). Where two candidate names
 *    could claim a card, the LONGER name wins — the more specific scope is the narrower promise,
 *    which is what §7.3 means by matched longest-name-first.
 * 3. THE D1 ADVISORY (roadmap §5.3): until minimum-fee floors exist in the data, ordering on small
 *    amounts can be inverted by an unmodelled issuer minimum fee. Below the cited threshold the
 *    engine flags the comparison advisory and SUPPRESSES delta claims ("saves X") — a suppressed
 *    claim is honest; a wrong one is not.
 * 4. THE ATM FLOOR (roadmap §7.3 limitation b): outside the major settlement currencies the double
 *    conversion is unpriced, so a foreign-ATM figure is a FLOOR — the true cost is this or more,
 *    and the label travels on the number itself.
 */
import type { FxRate } from '../data/adapter/vocabulary';
import { convertToIls, type ConvertedAmount } from './currency';
import { step, trace, type ReasonTrace } from './reasonTrace';
import { stalenessReading, type StalenessReading } from '../data/adapter/fxStaleness';

/** Cited constant — roadmap §5.3 (Task D1 interim behaviour): "suggest 150 ILS equivalent". */
export const SMALL_AMOUNT_ADVISORY_THRESHOLD_ILS = 150;

/** Cited constant — roadmap §7.3 limitation (b): double conversion outside these is unpriced. */
export const MAJOR_SETTLEMENT_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;

export type FxMode = 'purchase' | 'atm';

/** The shape of a shipped catalog fx row this engine resolves against (structurally, no import). */
export interface FxRowLike {
  readonly pairId: string;
  readonly appliesToAllOperatorsExcept?: readonly string[];
}

/**
 * Resolve the fx row for one card: exact pair first; then the issuer default, unless this operator
 * is excepted from it. Candidates are ordered longest-matched-name-first, so a narrower scope that
 * names the card more specifically outranks a broader one (roadmap §7.3).
 */
export function resolveFxRow(
  rows: readonly FxRowLike[],
  issuerOrgId: string,
  operatorId: string,
): FxRowLike | undefined {
  const matchingRows = rows.filter((r) => {
    if (r.pairId === `fx:${issuerOrgId}|${operatorId}`) return true;
    if (r.pairId === `fx:${issuerOrgId}|*`) {
      return !(r.appliesToAllOperatorsExcept ?? []).includes(operatorId);
    }
    return false;
  });
  if (matchingRows.length === 0) return undefined;
  // Longest-name-first: the exact pair's id always carries both names, so it wins ties by length
  // before any explicit sort matters; among defaults there is one per issuer.
  return matchingRows.slice().sort((a, b) => b.pairId.length - a.pairId.length)[0];
}

export interface CardFxQuote {
  readonly cardId: string;
  /** FX percent for this leg as read through the adapter (USABLE legs only). Absent = unknown. */
  readonly fxPercent?: number;
  readonly fixedFeeIls?: number;
}

export interface FxFloor {
  readonly reason: 'MINOR_CURRENCY_DOUBLE_CONVERSION_UNPRICED';
  readonly citation: 'roadmap §7.3 limitation (b)';
}

export interface FxEntry {
  readonly cardId: string;
  readonly quote: ConvertedAmount;
  /** True when the figure is a floor, not a point estimate (minor-currency foreign ATM). */
  readonly floor?: FxFloor;
}

export interface FxComparisonInput {
  readonly amount: number;
  /** The transaction's ORIGINAL currency — the rate is its representative rate (ADR-013). */
  readonly currency: string;
  readonly mode: FxMode;
  readonly cards: readonly CardFxQuote[];
  /** The representative rate, resolved upstream (the lane owns live/bundled/refusals). */
  readonly rate: FxRate;
  /** Overrides the cited default; a configured product choice, never a magic inline number. */
  readonly smallAmountThresholdIls?: number;
  /** Pinned evaluation date. Callers rendering a current result must pass today's local ISO date. */
  readonly asOfDate?: string;
}

export interface FxComparison {
  readonly currency: string;
  readonly mode: FxMode;
  readonly amountNative: number;
  /** Ranked ascending by effective ILS. Cards with unknown legs are absent from this list. */
  readonly ranked: readonly FxEntry[];
  /** Cards whose leg is unknown: shown separately by the surface, ranked by nothing. */
  readonly unknownCards: readonly string[];
  /** D1 interim behaviour: ordering may be inverted by unmodelled issuer minimum fees. */
  readonly smallAmountAdvisory: boolean;
  readonly smallAmountThresholdIls: number;
  /** True when "saves X" claims must be suppressed (advisory active). */
  readonly deltasSuppressed: boolean;
  readonly rateFreshness: StalenessReading & { readonly asOfDate: string };
  readonly trace: ReasonTrace;
}

export function compareAbroad(input: FxComparisonInput): FxComparison {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error(
      `${input.currency}: refusing to compare ${String(input.amount)} — a non-positive or `
        + 'non-finite amount is not a purchase to price',
    );
  }

  const asOfDate = input.asOfDate ?? input.rate.fetchDate;
  const freshness = stalenessReading(input.rate.rateDate, asOfDate);
  const ranked: FxEntry[] = [];
  const unknownCards: string[] = [];
  for (const card of input.cards) {
    if (card.fxPercent === undefined) {
      unknownCards.push(card.cardId);
      continue;
    }
    // exactOptionalPropertyTypes: an absent fee is OMITTED, never passed as undefined.
    const markup = card.fixedFeeIls === undefined
      ? { percent: card.fxPercent }
      : { percent: card.fxPercent, fixedFeeIls: card.fixedFeeIls };
    const quote = convertToIls(
      { amount: input.amount, currency: input.currency },
      input.rate,
      markup,
    );
    const isAtm = input.mode === 'atm';
    const minorCurrency = !(MAJOR_SETTLEMENT_CURRENCIES as readonly string[]).includes(input.currency);
    const steps = [
      step('engine fx rank', 'ranked ascending by effectiveIls from convertToIls — one conversion path'),
    ];
    if (isAtm && minorCurrency) {
      steps.push(step(
        'roadmap s7.3 limitation (b)',
        'foreign ATM on a minor settlement currency: the double conversion is unpriced, so this '
          + 'figure is a FLOOR — the true cost is this or more',
        ['currency'],
      ));
    }
    // T2, enforced here and not assumed: a ranked figure always leaves with its Data Contract
    // state attached, and a conversion that stopped grading itself fails loudly instead of
    // ranking an unlabelled number.
    if (quote.provenance !== 'ESTIMATE') {
      throw new Error(card.cardId + ': conversion returned provenance ' + quote.provenance
        + ' - a derived ILS figure is ALWAYS ESTIMATE (ADR-013 s3); refusing to rank it');
    }
    const traced: FxEntry = {
      cardId: card.cardId,
      quote: {
        ...quote,
        ...(freshness.stale ? { stale: true as const } : {}),
        trace: trace('currency', [...quote.trace.steps, ...steps]),
      },
      ...(isAtm && minorCurrency
        ? { floor: { reason: 'MINOR_CURRENCY_DOUBLE_CONVERSION_UNPRICED' as const, citation: 'roadmap §7.3 limitation (b)' as const } }
        : {}),
    };
    ranked.push(traced);
  }
  ranked.sort((a, b) => a.quote.effectiveIls - b.quote.effectiveIls);

  const threshold = input.smallAmountThresholdIls ?? SMALL_AMOUNT_ADVISORY_THRESHOLD_ILS;
  const cheapest = ranked[0]?.quote.referenceIls;
  // The advisory reads the REFERENCE figure (before card markup): the risk D1 names is about the
  // amount itself being small relative to any issuer minimum fee, whichever card wins.
  const smallAmountAdvisory = cheapest !== undefined && cheapest < threshold;

  return {
    currency: input.currency,
    mode: input.mode,
    amountNative: input.amount,
    ranked,
    unknownCards,
    smallAmountAdvisory,
    smallAmountThresholdIls: threshold,
    deltasSuppressed: smallAmountAdvisory,
    rateFreshness: { ...freshness, asOfDate },
    trace: trace('fx', [
      step(
        'engine fx compare',
        'compared ' + ranked.length + ' card(s) on ' + input.currency + ' ' + input.mode
          + ' against one representative rate',
        ['amount', 'currency', 'mode'],
      ),
      ...(smallAmountAdvisory
        ? [step(
            'roadmap s5.3 Task D1 interim',
            'reference figure below the cited threshold (' + threshold
              + ' ILS): ordering may be inverted by unmodelled issuer minimum fees; savings '
              + 'claims are suppressed',
            ['smallAmountThresholdIls'],
          )]
        : []),
    ]),
  };
}
