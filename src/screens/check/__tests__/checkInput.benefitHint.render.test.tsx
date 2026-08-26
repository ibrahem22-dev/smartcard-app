/**
 * C5's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §8: the benefit-hint chip appears only when a real match exists.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckInputScreen, type CheckInputBenefitHint } from '../CheckInputScreen';

const mount = (benefitHint?: CheckInputBenefitHint) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {benefitHint ? (
        <CheckInputScreen benefitHint={benefitHint} />
      ) : (
        <CheckInputScreen />
      )}
    </SafeAreaProvider>,
  );

describe('Check Input — C5: benefit-hint chip only on a real match', () => {
  it('omitting the hint paints no chip', () => {
    const { queryByTestId } = mount();
    expect(queryByTestId('check-input-benefit-hint')).toBeNull();
  });

  it('a supplied match paints that label', () => {
    const { getByTestId } = mount({ label: '5% at the grocer on Max' });
    expect(String(getByTestId('check-input-benefit-hint').props.children)).toBe(
      '5% at the grocer on Max',
    );
  });

  it('the hint is the supplied match, not a surface invention', () => {
    const hint = { label: 'club dining 8%' };
    const { getByTestId } = mount(hint);
    expect(String(getByTestId('check-input-benefit-hint').props.children)).toBe(hint.label);
  });

  it('an empty mount does not invent a match to fill the slot', () => {
    const { queryByTestId } = mount();
    expect(queryByTestId('check-input-benefit-hint')).toBeNull();
  });
});
