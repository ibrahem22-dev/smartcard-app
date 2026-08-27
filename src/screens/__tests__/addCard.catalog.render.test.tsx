/**
 * W2's rendered evidence — search is the primary path; the generic path is available
 * for anything the catalog does not contain. Population reach is proven in
 * catalogSearch.test.ts; this suite measures the wizard surface.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { currentCatalogProducts } from '../../data/adapter/catalogSearch';
import { renderScreen } from '../../../tools/p2/jest/renderScreen';
import { AddCardScreen } from '../AddCardScreen';

describe('Add Card wizard — W2 catalog search on the rendered surface', () => {
  it('opens as a search surface, not a three-issuer picker', () => {
    const { getByTestId, queryByTestId } = renderScreen(AddCardScreen);
    expect(getByTestId('add-card-search-path')).toBeTruthy();
    expect(getByTestId('add-card-search')).toBeTruthy();
    expect(getByTestId('add-card-generic-path')).toBeTruthy();
    expect(queryByTestId('add-card-generic-form')).toBeNull();
    expect(queryByTestId('add-card-issuer-max')).toBeNull();
  });

  it("can't-find-it opens the fully-capable generic path", () => {
    const { getByTestId, queryByTestId } = renderScreen(AddCardScreen);
    fireEvent.press(getByTestId('add-card-generic-path'));
    expect(getByTestId('add-card-generic-form')).toBeTruthy();
    expect(getByTestId('add-card-issuer-max')).toBeTruthy();
    expect(getByTestId('add-card-last4')).toBeTruthy();
    expect(queryByTestId('add-card-search-path')).toBeNull();
  });

  it('searching a derived product id shows that hit', () => {
    const sample = currentCatalogProducts()[0];
    if (sample === undefined) {
      throw new Error('no CURRENT products derived — catalog search has no population');
    }
    const { getByTestId } = renderScreen(AddCardScreen);
    fireEvent.changeText(getByTestId('add-card-search'), sample.cardId);
    expect(getByTestId(`add-card-hit-${sample.cardId}`)).toBeTruthy();
  });
});
