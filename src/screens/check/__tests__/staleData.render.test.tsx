import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CardTileProps } from '../../../components/CardTile';
import type { DaySheetProps } from '../../calendar/DaySheet';
import type { SectionACostsProps } from '../../cardDna/SectionACosts';
import type { SectionDActiveNowProps } from '../../cardDna/SectionDActiveNow';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { Currency } from '../../../types/purchase.types';
import {
  CheckInputScreen,
  type CheckInputFxReference,
  type CheckInputScreenProps,
} from '../CheckInputScreen';

// These type-only imports define the production import closure the stale-data gate scans. The
// runtime proof below drives the one affected figure that has both an aging policy and an injected
// clock; the other surfaces must still expose no hard-coded staleness verdict.
export type StaleDataSurfacePopulation = readonly [
  CardTileProps,
  DaySheetProps,
  SectionACostsProps,
  SectionDActiveNowProps,
  CheckInputScreenProps,
];

const reference: CheckInputFxReference = {
  rateIlsPerQuoteUnit: 3.72,
  rateDate: '2026-08-24',
};

function mount(asOfDate: string) {
  const tree = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <CheckInputScreen asOfDate={asOfDate} fxReference={reference} />
    </SafeAreaProvider>,
  );
  fireEvent.press(tree.getByTestId(`check-input-currency-${Currency.EUR}`));
  return tree;
}

describe('C10 — stale data uses a controlled clock', () => {
  beforeEach(() => {
    useLanguageStore.setState({
      languageChoice: 'en',
      resolvedLanguage: 'en',
    });
  });

  it('renders the same FX figure fresh before the threshold', () => {
    const tree = mount('2026-08-30');
    const chip = tree.getByTestId('check-input-fx-rate-chip');

    expect(tree.getByTestId('check-input-fx-rate').props.accessibilityValue?.text)
      .toBe('3.72|2026-08-24');
    expect(within(chip).getByText('Estimate')).toBeTruthy();
    expect(within(chip).queryByTestId('provenance-chip-stale')).toBeNull();
    expect(within(chip).queryByTestId('provenance-chip-as-of-date')).toBeNull();
  });

  it('renders the same FX figure Stale after the threshold', () => {
    const tree = mount('2026-09-01');
    const chip = tree.getByTestId('check-input-fx-rate-chip');

    expect(tree.getByTestId('check-input-fx-rate').props.accessibilityValue?.text)
      .toBe('3.72|2026-08-24');
    expect(within(chip).getByText('Stale')).toBeTruthy();
    expect(within(chip).getByTestId('provenance-chip-stale')).toBeTruthy();
  });

  it('renders asOfDate whenever the FX figure is Stale', () => {
    const tree = mount('2026-09-01');
    const chip = tree.getByTestId('check-input-fx-rate-chip');

    expect(within(chip).getByTestId('provenance-chip-as-of-date'))
      .toHaveTextContent(reference.rateDate);
  });

  it('keeps the Estimate chip unchanged across the staleness transition', () => {
    const freshChip = mount('2026-08-30').getByTestId('check-input-fx-rate-chip');
    const staleChip = mount('2026-09-01').getByTestId('check-input-fx-rate-chip');

    expect(within(freshChip).getByText('Estimate')).toBeTruthy();
    expect(within(staleChip).getByText('Estimate')).toBeTruthy();
    expect(staleChip.props.accessibilityLabel).toBe('Estimate · Stale');
  });
});
