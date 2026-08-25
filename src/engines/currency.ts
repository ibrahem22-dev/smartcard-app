import type { FxRate } from '@smartcard/data-authority-adapter';
import { step, trace, type ReasonTrace } from './reasonTrace';

/**
 * THE ENGINE'S CONVERSION ARITHMETIC — OD-23b, ADR-013 §2–§4, criteria X1–X3.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DIVIDE LIVES HERE AND NOWHERE ELSE
 *
 *   > *"JPY is quoted per 100 and LBP per 10… 50,000 JPY is 934.85 ILS correctly and 93,485.00 if
 *   > the unit is ignored."*
 *
 * The pipeline refuses to normalise at ingest because a silent ÷100 becomes indistinguishable from
 * a correct value; the artifact refuses to carry a per-one field so the wrong number is not
 * reachable by accident. P3 makes it reachable ON PURPOSE, here, once: `perOne` divides the
 * published figure by its own published unit, and every other function reads the result through it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT A DERIVED FIGURE IS WORTH — X3, ADR-013 §3
 *
 * *"Any derived ILS figure is graded ESTIMATE, regardless of the grade of its inputs."* The tariff
 * may be VERIFIED_OFFICIAL; what the user will actually be charged depends on a representative rate
 * on a date that had not happened yet when the tariff was written. So `convertToIls` returns
 * provenance `ESTIMATE` as a TYPE, never inheriting the input's grade, and carries rate, rateDate
 * and markup in its reason trace so the estimate can be reconstructed rather than believed.
 */

/**
 * ILS per ONE unit of currency — the only place a quotation unit is ever divided out.
 *
 * Takes the narrow shape it needs so a caller cannot hand it something pre-divided by mistake: the
 * published number and the unit it was published against, together or not at all.
 */
export function perOne(rate: Pick<FxRate, 'quoteUnit' | 'rateIlsPerQuoteUnit'>): number {
  return rate.rateIlsPerQuoteUnit / rate.quoteUnit;
}

export interface ConversionInput {
  /** The amount IN ITS OWN CURRENCY, as the adapter returned it (OD-23a: the native fact). */
  readonly amount: number;
  readonly currency: string;
}

export interface CardFxMarkup {
  /** The card's FX percentage, e.g. 2.75 for 2.75%. Absent means the card charges none. */
  readonly percent?: number;
  /** Fixed fee charged on a foreign-currency transaction, in ILS. */
  readonly fixedFeeIls?: number;
}

export type ConvertedAmount = {
  readonly currency: string;
  readonly nativeAmount: number;
  /** amount × rate-per-one alone — the reference figure ADR-013 §2 defines. */
  readonly referenceIls: number;
  /** referenceIls plus the card's FX percentage plus its fixed fee — what the user is charged. */
  readonly effectiveIls: number;
  readonly fxPercentApplied: number;
  readonly fixedFeeIlsApplied: number;
  /** The rate used, and the date it is FOR — carried for the reason trace, never re-derived. */
  readonly rateUsed: { readonly rateIlsPerQuoteUnit: number; readonly quoteUnit: number; readonly rateDate: string };
  /** ALWAYS 'ESTIMATE'. A type, so inheriting the input's grade does not compile. */
  readonly provenance: 'ESTIMATE';
  /** T1: the account of this computation, travelling with it as an engine output. */
  readonly trace: ReasonTrace;
};

/**
 * Convert a native-currency amount to ILS at the BOI representative rate plus the card's markup,
 * ranking on the result (OD-23b).
 *
 * Refuses a non-positive/non-finite amount: arithmetic that would produce nonsense downstream is
 * refused at the door, in the same spirit as the lane's ingest refusals.
 */
export function convertToIls(
  input: ConversionInput,
  rate: FxRate,
  markup: CardFxMarkup = {},
): ConvertedAmount {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error(
      `${input.currency}: refusing to convert ${String(input.amount)} — a non-positive or `
        + 'non-finite amount is not a purchase to price',
    );
  }
  const one = perOne(rate);
  const fxPercent = markup.percent ?? 0;
  const referenceIls = input.amount * one;
  const effectiveIls = referenceIls * (1 + fxPercent / 100) + (markup.fixedFeeIls ?? 0);
  return {
    currency: input.currency,
    nativeAmount: input.amount,
    referenceIls,
    effectiveIls,
    fxPercentApplied: fxPercent,
    fixedFeeIlsApplied: markup.fixedFeeIls ?? 0,
    rateUsed: {
      rateIlsPerQuoteUnit: rate.rateIlsPerQuoteUnit,
      quoteUnit: rate.quoteUnit,
      rateDate: rate.rateDate,
    },
    // The grade of a DERIVATION. Never the input's grade, whatever it earned.
    provenance: 'ESTIMATE',
    trace: trace('currency', [
      step(
        'quoteUnit divide',
        'divided the published ILS figure by its own quotation unit to reach a rate per one '
          + 'unit (' + rate.quoteUnit + ')',
        ['rateIlsPerQuoteUnit', 'quoteUnit'],
      ),
      step(
        'ADR-013 s2 reference',
        'referenceIls = amount x rate-per-one: the representative-rate figure before any card cost',
        ['amount', 'rateUsed.rateIlsPerQuoteUnit', 'rateUsed.quoteUnit'],
      ),
      step(
        'card FX markup',
        'effectiveIls = referenceIls x (1 + FX%) + fixed fee, with FX% = ' + fxPercent
          + ' and fixed fee = ' + (markup.fixedFeeIls ?? 0),
        ['fxPercentApplied', 'fixedFeeIlsApplied'],
      ),
    ]),
  };
}
