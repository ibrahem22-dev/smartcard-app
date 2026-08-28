import type {
  BlockedAuthority,
  ConflictAuthority,
  HistoricalAuthority,
  KnownAuthority,
  UnknownAuthority,
} from '../../authority/authorityValue';
import type { ProvenanceChip } from '../../authority/provenanceChip';
import { Currency } from '../../types/purchase.types';

export type TileAuthorityShape =
  | Pick<KnownAuthority<unknown>, 'state' | 'provenance'>
  | Pick<UnknownAuthority, 'state'>
  | Pick<BlockedAuthority, 'state'>
  | Pick<ConflictAuthority<unknown>, 'state'>
  | Pick<HistoricalAuthority<unknown>, 'state' | 'provenance'>;

/**
 * W5 deliberately differs from N9: Card DNA exposes every conflicting reading,
 * while a glanceable wallet tile carries the unresolved fact only as an Estimate.
 */
export function tileChipFor(value: TileAuthorityShape): ProvenanceChip {
  switch (value.state) {
    case 'KNOWN':
    case 'HISTORICAL':
      return value.provenance;
    case 'UNKNOWN':
    case 'BLOCKED':
      return 'UNKNOWN';
    case 'CONFLICT':
      return 'ESTIMATE';
  }
}

/** A card-denominated amount is genuinely foreign only when its declared currency is not ILS. */
export function isForeignAmount(currency: Currency): boolean {
  switch (currency) {
    case Currency.ILS:
      return false;
    case Currency.USD:
    case Currency.EUR:
      return true;
  }
}
