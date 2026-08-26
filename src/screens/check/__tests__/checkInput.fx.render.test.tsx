/**
 * C4's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §8: selecting a foreign currency auto-activates the FX lane and shows
 * the Bank of Israel reference line with the rate's date. The rate is supplied
 * as a prop (adapter/engine). The surface never invents one.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckInputScreen, type CheckInputFxReference } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';

const reference: CheckInputFxReference = {
  rateIlsPerQuoteUnit: 3.72,
  rateDate: '2026-08-24',
};

const mount = (fxReference?: CheckInputFxReference) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {fxReference ? (
        <CheckInputScreen fxReference={fxReference} />
      ) : (
        <CheckInputScreen />
      )}
    </SafeAreaProvider>,
  );

describe('Check Input — C4: foreign currency activates the FX lane', () => {
  it('the shekel omits the FX lane even when a reference is supplied', () => {
    const { queryByTestId, getByTestId } = mount(reference);
    expect(getByTestId('check-input-currency-ILS').props.accessibilityState.selected).toBe(true);
    expect(queryByTestId('check-input-fx-lane')).toBeNull();
  });

  it('selecting a foreign currency auto-activates the FX lane and paints the BOI rate and date', () => {
    const { getByTestId } = mount(reference);
    fireEvent.press(getByTestId(`check-input-currency-${Currency.EUR}`));
    expect(getByTestId('check-input-fx-lane')).toBeTruthy();
    expect(getByTestId('check-input-fx-rate').props.accessibilityValue?.text).toBe('3.72|2026-08-24');
  });

  it('a foreign currency without a reference invents no rate line', () => {
    const { getByTestId, queryByTestId } = mount();
    fireEvent.press(getByTestId(`check-input-currency-${Currency.USD}`));
    expect(queryByTestId('check-input-fx-lane')).toBeNull();
    expect(queryByTestId('check-input-fx-rate')).toBeNull();
  });

  it('the painted rate is the supplied reference, not a surface recomputation', () => {
    const { getByTestId } = mount(reference);
    fireEvent.press(getByTestId(`check-input-currency-${Currency.USD}`));
    expect(getByTestId('check-input-fx-rate').props.accessibilityValue?.text).toBe(
      `${reference.rateIlsPerQuoteUnit}|${reference.rateDate}`,
    );
  });
});
