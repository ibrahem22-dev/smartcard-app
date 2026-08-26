/**
 * D6's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §9 FX block when the purchase is foreign: BOI rate + date, card FX fee,
 * estimated real cost, ending in the compare-sheet link. Numbers come from
 * `compareAbroad` (N3). A shekel purchase omits the block rather than inventing one.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { compareAbroad } from '../../../engines/fx';
import { Currency } from '../../../types/purchase.types';

const rate = {
  currency: 'EUR',
  quoteUnit: 1,
  rateIlsPerQuoteUnit: 4.02,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED',
  provenance: 'ESTIMATE',
  rateBasis: 'BOI_REPRESENTATIVE',
} as const;

const comparison = compareAbroad({
  amount: 1_000,
  currency: 'EUR',
  mode: 'purchase',
  rate,
  cards: [{ cardId: 'cheapest', fxPercent: 2.0 }],
});

const quote = comparison.ranked[0]?.quote;
if (quote === undefined) {
  throw new Error('compareAbroad returned no ranked quote — D6 has nothing honest to paint');
}

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
};

const result = runPurchaseCheck(draft, {
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
});

const mount = (withFx: boolean) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {withFx ? (
        <CheckVerdictScreen result={result} fxBlock={{ quote }} />
      ) : (
        <CheckVerdictScreen result={result} />
      )}
    </SafeAreaProvider>,
  );

describe('Check Verdict — D6: FX block when the purchase is foreign', () => {
  it('omits the FX block when the purchase is not foreign', () => {
    const { queryByTestId } = mount(false);
    expect(queryByTestId('check-verdict-fx')).toBeNull();
    expect(queryByTestId('check-verdict-fx-compare-link')).toBeNull();
  });

  it('paints the compareAbroad quote: BOI rate, date, card fee and estimated ILS cost', () => {
    const { getByTestId } = mount(true);
    expect(getByTestId('check-verdict-fx-rate').props.accessibilityValue?.text).toBe(
      `${quote.rateUsed.rateIlsPerQuoteUnit}|${quote.rateUsed.rateDate}`,
    );
    expect(getByTestId('check-verdict-fx-fee').props.accessibilityValue?.text).toBe(
      String(quote.fxPercentApplied),
    );
    expect(getByTestId('check-verdict-fx-estimate').props.accessibilityValue?.text).toBe(
      String(quote.effectiveIls),
    );
  });

  it('the estimated cost is the engine quote, not a surface recomputation of amount × rate', () => {
    const invented = 1_000 * 4.02;
    expect(quote.effectiveIls).not.toBe(invented);
    const { getByTestId } = mount(true);
    expect(getByTestId('check-verdict-fx-estimate').props.accessibilityValue?.text).toBe(
      String(quote.effectiveIls),
    );
    expect(getByTestId('check-verdict-fx-estimate').props.accessibilityValue?.text).not.toBe(
      String(invented),
    );
  });

  it('the block ends in the compare-sheet link', () => {
    const { getByTestId } = mount(true);
    const link = getByTestId('check-verdict-fx-compare-link');
    expect(String(link.props.children).length).toBeGreaterThan(0);
    expect(link.props.accessibilityRole).toBe('link');
  });
});
