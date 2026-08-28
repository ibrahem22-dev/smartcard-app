import type { ProvenanceChip } from '../authority/provenanceChip';
import type { CardCostRowId } from '../screens/cardDna/costRows';
import type { EngineCard } from '../types/card.types';
import {
  cardCostOverrideKey,
  cardCostOverrideVault,
  readCardCostOverride,
} from './cardOverrides';
import { resolveValue } from './storeAdapter';

export type CardCostReading =
  | {
      readonly kind: 'known';
      readonly value: string;
      readonly chip: ProvenanceChip;
      readonly source: 'user' | 'catalog';
    }
  | { readonly kind: 'unknown' };

/**
 * The pack set that holds catalog card-cost rows. `catalogReading()` does not currently consult
 * the pack store: it reads only `EngineCard` fields, so importing a pack cannot change Section A
 * today. Wiring the catalog path to the pack store belongs to N4; until then, a durability claim
 * measured through this module would be vacuous.
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

  // Avoid opening the pack database for the overwhelmingly common no-override read. When a vault
  // value exists, the adapter still performs the only precedence comparison against pack data.
  if (readCardCostOverride(card.cardId, rowId) !== null) {
    const resolved = resolveValue(
      cardCostOverrideVault,
      CARD_COST_PACK_SET,
      cardCostOverrideKey(card.cardId, rowId),
    );
    if (resolved?.source === 'vault') {
      // Unlike an ambiguous catalog zero, USER 0 is known: somebody asserted that their card is free.
      return {
        kind: 'known',
        value: resolved.value,
        chip: resolved.chip,
        source: 'user',
      };
    }
  }

  return catalogReading(card, rowId);
}
