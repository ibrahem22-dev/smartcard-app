/**
 * W4 — Add Card wizard provenance. Catalog prefills wear VERIFIED; unknowns wear ESTIMATE.
 * The vocabulary is the Data Contract's four states via authority/provenanceChip — never restated.
 */
import {
  PROVENANCE_CHIPS,
  type ProvenanceChip,
  type ProvenanceRecord,
} from '../../authority/provenanceChip';
import { catalogCardRows } from './catalogSearch';

const inVocabulary = (chip: ProvenanceChip): boolean =>
  (PROVENANCE_CHIPS as readonly string[]).includes(chip);

export function catalogPrefillChip(): ProvenanceChip {
  const chip: ProvenanceChip = 'VERIFIED';
  if (!inVocabulary(chip)) {
    throw new Error('catalog prefill chip is not in the Data Contract vocabulary');
  }
  return chip;
}

export function unknownFieldChip(): ProvenanceChip {
  const chip: ProvenanceChip = 'ESTIMATE';
  if (!inVocabulary(chip)) {
    throw new Error('unknown-field chip is not in the Data Contract vocabulary');
  }
  return chip;
}

export function userEnteredChip(): ProvenanceChip {
  const chip: ProvenanceChip = 'USER';
  if (!inVocabulary(chip)) {
    throw new Error('user-entered chip is not in the Data Contract vocabulary');
  }
  return chip;
}

export function catalogPrefillView(): ProvenanceRecord {
  return { chip: catalogPrefillChip(), stale: false };
}

export function unknownFieldView(): ProvenanceRecord {
  return { chip: unknownFieldChip(), stale: false };
}

export function userEnteredView(): ProvenanceRecord {
  return { chip: userEnteredChip(), stale: false };
}

/**
 * Pass through a pack field's chip. A VERIFIED catalog value stays VERIFIED —
 * remapping it to ESTIMATE is the W4 negative control.
 */
export function wizardViewForPackChip(chip: string | undefined): ProvenanceRecord {
  if (chip === 'VERIFIED') return catalogPrefillView();
  if (chip === 'USER') return userEnteredView();
  return unknownFieldView();
}

type CostField = {
  readonly chip?: unknown;
  readonly value?: unknown;
};

function asCostField(value: unknown): CostField | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  return value as CostField;
}

/** Prefill the wizard FX-fee field only when the pack itself stamped VERIFIED on a number. */
export function catalogFxPrefill(
  cardId: string,
): { readonly percentText: string; readonly view: ProvenanceRecord } | null {
  const row = catalogCardRows().find(candidate => candidate['cardId'] === cardId);
  if (row === undefined) return null;
  const costs = row['costs'];
  if (costs === null || typeof costs !== 'object') return null;
  const fx = asCostField((costs as Record<string, unknown>)['fxCommissionPct']);
  if (fx === undefined) return null;
  const chip = typeof fx.chip === 'string' ? fx.chip : undefined;
  if (chip !== 'VERIFIED') return null;
  if (typeof fx.value !== 'number' || !Number.isFinite(fx.value)) return null;
  return { percentText: String(fx.value), view: wizardViewForPackChip(chip) };
}
