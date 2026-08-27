/**
 * D7's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §9 impact strip: available limit after the purchase, read from the load
 * engine's `CardLimitPosition` (`availableAfterChangesIls`). Freshness footer
 * carries the informational-only disclaimer. The surface never subtracts
 * limit − holds − logged itself.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { evaluateFinancialLoad } from '../../../engines/load';
import { Currency } from '../../../types/purchase.types';

const load = evaluateFinancialLoad({
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [
    {
      commitmentId: 'plan',
      monthlyAmountIls: { value: 500, provenance: 'USER' },
      linkedCardId: 'card-a',
      remainingHoldIls: { value: 4_000, provenance: 'USER' },
    },
  ],
  cards: [
    {
      cardId: 'card-a',
      creditLimitIls: { value: 10_000, provenance: 'USER' },
      loggedThisCyclePurchasesIls: { value: 1_000, provenance: 'USER' },
    },
  ],
  prospectiveCommitment: {
    commitmentId: 'this-purchase',
    monthlyAmountIls: { value: 200, provenance: 'USER' },
    linkedCardId: 'card-a',
    remainingHoldIls: { value: 1_500, provenance: 'USER' },
  },
});

const position = load.cardLimits[0];
if (position === undefined) {
  throw new Error('evaluateFinancialLoad returned no cardLimits — D7 has nothing honest to paint');
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

const mount = (withStrip: boolean) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {withStrip ? (
        <CheckVerdictScreen
          result={result}
          impactStrip={{ availableAfterPurchaseIls: position.availableAfterChangesIls }}
        />
      ) : (
        <CheckVerdictScreen result={result} />
      )}
    </SafeAreaProvider>,
  );

describe('Check Verdict — D7: impact strip and freshness footer', () => {
  it('paints availableAfterChangesIls from the load engine, not a surface subtraction', () => {
    const surfaceGuess =
      position.creditLimitIls.value
      - position.activeInstallmentHoldsIls.value
      - position.loggedThisCyclePurchasesIls.value;
    expect(position.availableAfterChangesIls.value).not.toBe(surfaceGuess);
    const { getByTestId } = mount(true);
    expect(getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).toBe(
      String(position.availableAfterChangesIls.value),
    );
    expect(getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).not.toBe(
      String(surfaceGuess),
    );
  });

  it('the freshness footer carries the informational-only disclaimer', () => {
    const { getByTestId } = mount(true);
    const footer = String(getByTestId('check-verdict-freshness').props.children);
    expect(footer.length).toBeGreaterThan(0);
    expect(footer).toMatch(/informational only/i);
  });

  it('omitting the strip omits the available-limit row rather than inventing one', () => {
    const { queryByTestId, getByTestId } = mount(false);
    expect(queryByTestId('check-verdict-impact-strip')).toBeNull();
    expect(getByTestId('check-verdict-freshness')).toBeTruthy();
  });

  it('the claimed available limit is the engine field availableAfterChangesIls', () => {
    expect(position.availableAfterChangesIls.value).toBe(3_500);
    const { getByTestId } = mount(true);
    expect(getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).toBe('3500');
  });
});
