/**
 * C2's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §8: the screen completes in four taps plus the amount, with the currency
 * switcher, custom keypad, category chips and collapsed card picker.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckInputScreen, type CheckInputDraft } from '../CheckInputScreen';
import { PurchaseCategory } from '../../../types/purchase.types';

const mount = (onCheck?: (draft: CheckInputDraft) => void) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckInputScreen
        ownedCards={[{ cardId: 'max', displayName: 'Max' }]}
        {...(onCheck ? { onCheck } : {})}
      />
    </SafeAreaProvider>,
  );

describe('Check Input — C2: four taps plus the amount', () => {
  it('renders the currency switcher, custom keypad, category chips and collapsed card picker', () => {
    const { getByTestId, queryByTestId } = mount();
    expect(getByTestId('check-input-currency-ILS')).toBeTruthy();
    expect(getByTestId('check-input-keypad')).toBeTruthy();
    expect(getByTestId('check-input-key-1')).toBeTruthy();
    expect(getByTestId('check-input-categories')).toBeTruthy();
    expect(getByTestId('check-input-card-picker')).toBeTruthy();
    expect(queryByTestId('check-input-card-list')).toBeNull();
  });

  it('completes a check in four taps or fewer plus the amount', () => {
    const onCheck = jest.fn();
    const { getByTestId } = mount(onCheck);
    fireEvent.changeText(getByTestId('check-input-amount'), '250');
    fireEvent.press(getByTestId(`check-input-category-${PurchaseCategory.Groceries}`));
    fireEvent.press(getByTestId('check-input-plan-installments'));
    fireEvent.press(getByTestId('check-input-card-picker'));
    fireEvent.press(getByTestId('check-input-submit'));
    expect(onCheck).toHaveBeenCalledTimes(1);
    const draft = onCheck.mock.calls[0]?.[0] as CheckInputDraft;
    expect(draft.amount).toBe(250);
    expect(draft.category).toBe(PurchaseCategory.Groceries);
    expect(draft.installments).toBe(2);
    expect(draft.cardId).toBeNull();
  });

  it('category, plan and card remain optional — amount plus submit still produces a draft', () => {
    const onCheck = jest.fn();
    const { getByTestId } = mount(onCheck);
    fireEvent.changeText(getByTestId('check-input-amount'), '40');
    fireEvent.press(getByTestId('check-input-submit'));
    const draft = onCheck.mock.calls[0]?.[0] as CheckInputDraft;
    expect(draft.category).toBeNull();
    expect(draft.installments).toBeNull();
    expect(draft.cardId).toBeNull();
  });

  it('offers every category the type defines', () => {
    const { getByTestId } = mount();
    for (const category of Object.values(PurchaseCategory)) {
      expect(getByTestId(`check-input-category-${category}`)).toBeTruthy();
    }
  });
});
