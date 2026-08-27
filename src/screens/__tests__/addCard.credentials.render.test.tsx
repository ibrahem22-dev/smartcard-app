/**
 * W6 rendered — CardProduct reference plus at most four digits. No credentials.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderScreen } from '../../../tools/p2/jest/renderScreen';
import { AddCardScreen } from '../AddCardScreen';

describe('Add Card wizard — W6 no card credentials on the rendered surface', () => {
  it('the digits field accepts exactly four and no sixteen-digit card-number field exists', () => {
    const { getByTestId, queryByTestId } = renderScreen(AddCardScreen);
    fireEvent.press(getByTestId('add-card-generic-path'));
    const last4 = getByTestId('add-card-last4');
    expect(last4.props.maxLength).toBe(4);
    fireEvent.changeText(last4, '1234567890123456');
    expect(getByTestId('add-card-last4').props.value).toBe('1234');
    expect(queryByTestId('add-card-card-number')).toBeNull();
    expect(queryByTestId('add-card-pan')).toBeNull();
  });

  it('the wizard paints no CVV, CVC, PIN or expiry secret field', () => {
    const { getByTestId, queryByTestId } = renderScreen(AddCardScreen);
    fireEvent.press(getByTestId('add-card-generic-path'));
    expect(queryByTestId('add-card-cvv')).toBeNull();
    expect(queryByTestId('add-card-cvc')).toBeNull();
    expect(queryByTestId('add-card-pin')).toBeNull();
    expect(queryByTestId('add-card-expiry')).toBeNull();
    expect(queryByTestId('add-card-expiration')).toBeNull();
  });
});
