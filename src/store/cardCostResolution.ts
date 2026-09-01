import type { ConflictAuthority } from '../authority/authorityValue';
import {
  cardCostConflictFrom,
} from '../authority/cardCostConflict';
import type { ProvenanceChip } from '../authority/provenanceChip';
import type { CardCostRowId } from '../screens/cardDna/costRows';
import type { EngineCard } from '../types/card.types';
import {
  cardCostOverrideKey,
  cardCostOverrideVault,
} from './cardOverrides';
import { resolveValue } from './storeAdapter';

export { renderPlanForCardCostConflict } from '../authority/cardCostConflict';

type CardCostStaleness =
  | { readonly stale?: false; readonly asOfDate?: never }
  | { readonly stale: true; readonly asOfDate: string };

export type CardCostReading =
  | ({
      readonly kind: 'known';
      readonly value: string;
      readonly chip: ProvenanceChip;
      readonly source: 'user' | 'catalog';
    } & CardCostStaleness)
  | ({
      readonly kind: 'conflict';
      readonly conflict: ConflictAuthority<string>;
    } & CardCostStaleness)
  | { readonly kind: 'unknown' };

/**
 * The pack set that holds catalog card-cost rows. The adapter reads it before `catalogReading()`
 * falls back to the transitional `EngineCard` catalog.
 */
export const CARD_COST_PACK_SET = 'catalog';

function catalogRatesChip(card: EngineCard): ProvenanceChip {
  return card.cardRates?.source === 'manual' ? 'USER' : 'ESTIMATE';
}

function catalogReading(
  card: EngineCard,
  rowId: CardCostRowId,
): CardCostReading {
  switch (rowId) {
    case 'annual-fee':
      // EngineCard cannot distinguish a catalog zero from missing, so it is not a claim that the card is free.
      return card.annualFee === 0
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            value: String(card.annualFee),
            chip: 'ESTIMATE',
            source: 'catalog',
          };
    case 'monthly-fee':
      return card.cardRates === undefined
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            value: String(card.cardRates.monthlyFee),
            chip: catalogRatesChip(card),
            source: 'catalog',
          };
    case 'fx-commission':
      // The required fraction has the same ambiguous-zero problem as annualFee.
      return card.foreignTransactionFee === 0
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            value: String(card.foreignTransactionFee * 100),
            chip: 'ESTIMATE',
            source: 'catalog',
          };
    case 'foreign-atm-fee':
      // EngineCard has no foreign-ATM-fee field.
      return { kind: 'unknown' };
    case 'interest-rates':
      return card.cardRates === undefined
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            value: [
              card.cardRates.creditInterestRate,
              card.cardRates.installmentInterestRate,
              card.cardRates.cardLoanInterestRate,
            ].join('|'),
            chip: catalogRatesChip(card),
            source: 'catalog',
          };
    case 'other-costs':
      // EngineCard has no general other-costs field.
      return { kind: 'unknown' };
  }
}

/** The one read path for Section A: adapter precedence first, honest catalog fallback second. */
export function readCardCost(
  card: EngineCard | undefined,
  rowId: CardCostRowId,
): CardCostReading {
  if (card === undefined) return { kind: 'unknown' };

  const resolved = resolveValue(
    cardCostOverrideVault,
    CARD_COST_PACK_SET,
    cardCostOverrideKey(card.cardId, rowId),
  );
  if (resolved !== null) {
    if (resolved.stale && (resolved.asOfDate === undefined || resolved.asOfDate.trim() === '')) {
      throw new Error('a stale card-cost reading requires asOfDate (Data Contract §2.3)');
    }
    if (resolved.source === 'pack') {
      const conflict = cardCostConflictFrom(resolved.value);
      if (conflict !== null) {
        return {
          kind: 'conflict',
          conflict,
          ...(resolved.stale
            ? { stale: resolved.stale, asOfDate: resolved.asOfDate }
            : {}),
        };
      }
    }
    // Unlike an ambiguous EngineCard catalog zero, USER 0 and an explicit pack zero are known.
    return {
      kind: 'known',
      value: resolved.value,
      chip: resolved.chip,
      source: resolved.source === 'vault' ? 'user' : 'catalog',
      ...(resolved.stale
        ? { stale: resolved.stale, asOfDate: resolved.asOfDate }
        : {}),
    };
  }

  // Nothing populates the pack store with card-cost rows in production yet, so EngineCard is the
  // catalog of last resort until it does. This transitional third source should disappear when
  // the pack store is fed.
  return catalogReading(card, rowId);
}
