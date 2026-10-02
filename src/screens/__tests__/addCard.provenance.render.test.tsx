/**
 * W4 rendered — catalog prefills wear Verified chips; unknowns wear Estimate chips.
 */
import React from 'react';
import { fireEvent, within } from '@testing-library/react-native';

import { catalogFxPrefill, currentCatalogProducts } from '../../authority/addCardCatalog';
import { renderScreen } from '../../../tools/p2/jest/renderScreen';
import { AddCardScreen } from '../AddCardScreen';

describe('Add Card wizard — W4 provenance chips on the rendered surface', () => {
  it('catalog name and issuer wear Verified chips, not Estimate', () => {
    const sample = currentCatalogProducts().find(product => {
      const raw = product.operatingCardCompanyId ?? product.issuerOrgId;
      return raw === 'org:max' || raw === 'org:cal' || raw === 'org:isracard' || raw === 'org:amex-il';
    });
    if (sample === undefined) {
      throw new Error('no CURRENT product maps onto a wizard issuer — catalog prefills have no population');
    }
    const { getByTestId } = renderScreen(AddCardScreen);
    fireEvent.changeText(getByTestId('add-card-search'), sample.cardId);
    fireEvent.press(getByTestId(`add-card-hit-${sample.cardId}`));

    const name = within(getByTestId('add-card-field-displayName'));
    expect(name.getByTestId('provenance-chip-VERIFIED')).toBeTruthy();
    expect(name.queryByTestId('provenance-chip-ESTIMATE')).toBeNull();

    const issuer = within(getByTestId('add-card-field-issuer'));
    expect(issuer.getByTestId('provenance-chip-VERIFIED')).toBeTruthy();
    expect(issuer.queryByTestId('provenance-chip-ESTIMATE')).toBeNull();
  });

  it('empty unknown fields wear Estimate chips', () => {
    const { getByTestId } = renderScreen(AddCardScreen);
    fireEvent.press(getByTestId('add-card-generic-path'));

    const name = within(getByTestId('add-card-field-displayName'));
    expect(name.getByTestId('provenance-chip-ESTIMATE')).toBeTruthy();
    expect(name.queryByTestId('provenance-chip-VERIFIED')).toBeNull();

    const billing = within(getByTestId('add-card-field-billingDay'));
    expect(billing.getByTestId('provenance-chip-ESTIMATE')).toBeTruthy();
    expect(billing.queryByTestId('provenance-chip-VERIFIED')).toBeNull();
  });

  it('a catalog-prefilled FX fee keeps the pack Verified chip', () => {
    const withFx = currentCatalogProducts().find(
      product => catalogFxPrefill(product.cardId) !== null,
    );
    if (withFx === undefined) {
      throw new Error('no CURRENT product carries a VERIFIED FX commission to prefill');
    }
    const { getByTestId } = renderScreen(AddCardScreen);
    fireEvent.changeText(getByTestId('add-card-search'), withFx.cardId);
    fireEvent.press(getByTestId(`add-card-hit-${withFx.cardId}`));

    const fx = within(getByTestId('add-card-field-fxFee'));
    expect(fx.getByTestId('provenance-chip-VERIFIED')).toBeTruthy();
    expect(fx.queryByTestId('provenance-chip-ESTIMATE')).toBeNull();
  });
});
