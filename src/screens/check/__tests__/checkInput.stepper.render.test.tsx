/**
 * C3's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §8: the installments stepper renders only in installments mode and its
 * monthly preview derives from the live amount.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckInputScreen } from '../CheckInputScreen';

const mount = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckInputScreen />
    </SafeAreaProvider>,
  );

describe('Check Input — C3: installments stepper and live monthly preview', () => {
  it('the stepper is absent in one-payment mode', () => {
    const { queryByTestId, getByTestId } = mount();
    expect(getByTestId('check-input-plan-one').props.accessibilityState.selected).toBe(true);
    expect(queryByTestId('check-input-stepper')).toBeNull();
    expect(queryByTestId('check-input-monthly-preview')).toBeNull();
  });

  it('the stepper appears only after installments is selected', () => {
    const { getByTestId, queryByTestId } = mount();
    fireEvent.press(getByTestId('check-input-plan-installments'));
    expect(getByTestId('check-input-stepper')).toBeTruthy();
    fireEvent.press(getByTestId('check-input-plan-one'));
    expect(queryByTestId('check-input-stepper')).toBeNull();
  });

  it('the monthly preview is the live amount divided by the installment count', () => {
    const { getByTestId, queryByTestId } = mount();
    fireEvent.press(getByTestId('check-input-plan-installments'));
    expect(queryByTestId('check-input-monthly-preview')).toBeNull();
    fireEvent.changeText(getByTestId('check-input-amount'), '1200');
    expect(getByTestId('check-input-monthly-preview').props.accessibilityValue?.text).toBe('600');
  });

  it('changing the amount updates the preview rather than freezing the first figure', () => {
    const { getByTestId } = mount();
    fireEvent.press(getByTestId('check-input-plan-installments'));
    fireEvent.changeText(getByTestId('check-input-amount'), '1200');
    fireEvent.press(getByTestId('check-input-stepper-plus'));
    expect(getByTestId('check-input-monthly-preview').props.accessibilityValue?.text).toBe('400');
  });
});
