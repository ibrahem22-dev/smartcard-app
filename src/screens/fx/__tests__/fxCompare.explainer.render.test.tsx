/**
 * X4's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §17 expander: base + markup + fixed = total, from the engine's own
 * reason trace. The surface paints ConvertedAmount fields and trace.steps;
 * it does not subtract a markup ILS.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { compareAbroad } from '../../../engines/fx';
import { FxCompareSheet } from '../FxCompareSheet';

const rate = (currency: string, quoteUnit: number, rateIlsPerQuoteUnit: number) => ({
  currency,
  quoteUnit,
  rateIlsPerQuoteUnit,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED' as const,
  provenance: 'ESTIMATE' as const,
  rateBasis: 'BOI_REPRESENTATIVE' as const,
});

const mount = (comparison: ReturnType<typeof compareAbroad>) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <FxCompareSheet comparison={comparison} />
    </SafeAreaProvider>,
  );

describe('FX Compare — X4: how this is calculated from the engine trace', () => {
  const comparison = compareAbroad({
    amount: 1_000,
    currency: 'EUR',
    mode: 'purchase',
    rate: rate('EUR', 1, 4.02),
    cards: [{ cardId: 'cheapest', fxPercent: 2, fixedFeeIls: 3 }],
  });

  it('omits the expander when no ranked quote exists', () => {
    const unknownOnly = compareAbroad({
      amount: 1_000,
      currency: 'EUR',
      mode: 'purchase',
      rate: rate('EUR', 1, 4.02),
      cards: [{ cardId: 'unknown' }],
    });
    const { queryByTestId } = mount(unknownOnly);
    expect(queryByTestId('fx-compare-explainer')).toBeNull();
  });

  it('paints base, markup, fixed fee and total from the winner quote, not a surface recomputation', () => {
    const { getByTestId, queryByTestId } = mount(comparison);
    expect(queryByTestId('fx-compare-explainer-body')).toBeNull();
    fireEvent.press(getByTestId('fx-compare-explainer-toggle'));
    const quote = comparison.ranked[0]?.quote;
    expect(quote).toBeDefined();
    expect(getByTestId('fx-compare-explainer-base').props.accessibilityValue?.text).toBe(
      String(quote!.referenceIls),
    );
    expect(getByTestId('fx-compare-explainer-markup').props.accessibilityValue?.text).toBe(
      String(quote!.fxPercentApplied),
    );
    expect(getByTestId('fx-compare-explainer-fixed').props.accessibilityValue?.text).toBe(
      String(quote!.fixedFeeIlsApplied),
    );
    expect(getByTestId('fx-compare-explainer-total').props.accessibilityValue?.text).toBe(
      String(quote!.effectiveIls),
    );
    expect(queryByTestId('fx-compare-explainer-markup-ils')).toBeNull();
  });

  it('paints every step of the winner quote reason trace', () => {
    const { getByTestId } = mount(comparison);
    fireEvent.press(getByTestId('fx-compare-explainer-toggle'));
    const steps = comparison.ranked[0]?.quote.trace.steps ?? [];
    expect(steps.length).toBeGreaterThan(0);
    steps.forEach((item, index) => {
      expect(getByTestId(`fx-compare-explainer-step-${index}`).props.children).toBe(item.detail);
    });
  });

  it('the painted identity is the engine quote, not amount times rate on the surface', () => {
    const jpy = compareAbroad({
      amount: 10_000,
      currency: 'JPY',
      mode: 'purchase',
      rate: rate('JPY', 100, 186.97),
      cards: [{ cardId: 'cheapest', fxPercent: 2.9 }],
    });
    const { getByTestId } = mount(jpy);
    fireEvent.press(getByTestId('fx-compare-explainer-toggle'));
    const quote = jpy.ranked[0]?.quote;
    expect(quote).toBeDefined();
    const naive = String(jpy.amountNative * quote!.rateUsed.rateIlsPerQuoteUnit);
    expect(String(quote!.referenceIls)).not.toBe(naive);
    expect(getByTestId('fx-compare-explainer-base').props.accessibilityValue?.text).toBe(
      String(quote!.referenceIls),
    );
    expect(getByTestId('fx-compare-explainer-base').props.accessibilityValue?.text).not.toBe(naive);
  });
});
