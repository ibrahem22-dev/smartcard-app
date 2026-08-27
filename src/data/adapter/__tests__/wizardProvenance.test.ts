/**
 * W4 — wizard chips come from the Data Contract vocabulary, never a local restatement.
 */
import { PROVENANCE_CHIPS } from '../../../authority/provenanceChip';
import { currentCatalogProducts } from '../catalogSearch';
import {
  catalogFxPrefill,
  catalogPrefillChip,
  unknownFieldChip,
  userEnteredChip,
  wizardViewForPackChip,
} from '../wizardProvenance';

describe('W4 wizard provenance — adapter vocabulary, not a local restatement', () => {
  it('catalog prefills are the VERIFIED member of the Data Contract vocabulary', () => {
    const chip = catalogPrefillChip();
    expect(chip).toBe('VERIFIED');
    expect(PROVENANCE_CHIPS).toContain(chip);
    expect(chip).not.toBe('ESTIMATE');
  });

  it('unknowns are the ESTIMATE member of the Data Contract vocabulary', () => {
    const chip = unknownFieldChip();
    expect(chip).toBe('ESTIMATE');
    expect(PROVENANCE_CHIPS).toContain(chip);
    expect(userEnteredChip()).toBe('USER');
    expect(PROVENANCE_CHIPS).toContain(userEnteredChip());
  });

  it('a VERIFIED pack chip is not remapped to ESTIMATE', () => {
    const view = wizardViewForPackChip('VERIFIED');
    expect(view.chip).toBe('VERIFIED');
    expect(view.chip).not.toBe('ESTIMATE');
    const products = currentCatalogProducts();
    const withFx = products.find(product => catalogFxPrefill(product.cardId) !== null);
    expect(withFx).toBeDefined();
    const prefill = catalogFxPrefill(withFx?.cardId ?? '');
    expect(prefill?.view.chip).toBe('VERIFIED');
    expect(prefill?.view.chip).not.toBe('ESTIMATE');
  });
});
