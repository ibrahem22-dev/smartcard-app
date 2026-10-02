/**
 * X1's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * One canonical FX Compare component. Two entry points. A second implementation
 * for one entry is the defect this gate exists to catch.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { compareAbroad } from '../../../engines/fx';
import { CheckVerdictScreen } from '../../check/CheckVerdictScreen';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../../check/CheckInputScreen';
import { Currency } from '../../../types/purchase.types';
import { FxCompareSheet } from '../FxCompareSheet';
import { FxCompareFromCardDna } from '../FxCompareFromCardDna';
import { FxCompareFromCheckVerdict } from '../FxCompareFromCheckVerdict';

const rate = {
  currency: 'EUR',
  quoteUnit: 1,
  rateIlsPerQuoteUnit: 4.02,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED' as const,
  provenance: 'ESTIMATE' as const,
  rateBasis: 'BOI_REPRESENTATIVE' as const,
};

const comparison = compareAbroad({
  amount: 1_000,
  currency: 'EUR',
  mode: 'purchase',
  rate,
  cards: [{ cardId: 'cheapest', fxPercent: 2 }],
});

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
};

const result = runPurchaseCheck(draft, {
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [],
});

const wrap = (node: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {node}
    </SafeAreaProvider>,
  );

describe('FX Compare — X1: one component, two entry points', () => {
  it('both entry points are the canonical FxCompareSheet function', () => {
    expect(FxCompareFromCheckVerdict).toBe(FxCompareSheet);
    expect(FxCompareFromCardDna).toBe(FxCompareSheet);
    expect(FxCompareFromCheckVerdict).toBe(FxCompareFromCardDna);
  });

  it('Check Verdict mounts the Check-Verdict entry when a comparison is supplied', () => {
    const { getByTestId, queryByTestId } = wrap(
      <CheckVerdictScreen result={result} fxComparison={comparison} />,
    );
    expect(getByTestId('check-verdict-fx-compare-sheet')).toBeTruthy();
    expect(getByTestId('fx-compare-title')).toBeTruthy();
    expect(queryByTestId('fx-compare-row-cheapest')).toBeTruthy();
  });

  it('omitting fxComparison does not mount the sheet on Check Verdict', () => {
    const { queryByTestId } = wrap(<CheckVerdictScreen result={result} />);
    expect(queryByTestId('check-verdict-fx-compare-sheet')).toBeNull();
    expect(queryByTestId('fx-compare-title')).toBeNull();
  });

  it('the Card DNA entry paints the same sheet for the same comparison', () => {
    const { getByTestId } = wrap(<FxCompareFromCardDna comparison={comparison} />);
    expect(getByTestId('fx-compare-title')).toBeTruthy();
    expect(getByTestId('fx-compare-row-cheapest')).toBeTruthy();
  });
});
