/**
 * L1 measured on the rendered surface — contract §2 rule 9.
 *
 * The primary action "I made this purchase" writes to the activity store.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { keyVault } from '../../../security/keyVault';
import { MMKV_KEYS } from '../../../store/keys';
import { useActivityStore } from '../../../store/useActivityStore';
import { Currency } from '../../../types/purchase.types';

const PROFILE = '11111111-1111-4111-8111-111111111111';

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: 'card-a',
};

const result = runPurchaseCheck(draft, {
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [],
});

const mount = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckVerdictScreen
        contextLine={{
          amount: draft.amount,
          currencySymbol: '₪',
          categoryLabel: null,
          installmentCount: 1,
        }}
        logCardId="card-a"
        result={result}
      />
    </SafeAreaProvider>,
  );

describe('Check Verdict — L1: I made this purchase', () => {
  beforeEach(() => {
    keyVault.getEncryptedStorage().set(MMKV_KEYS.activeProfileId, PROFILE);
    useActivityStore.getState().clearActivity();
    useActivityStore.getState().hydrate();
  });

  it("'I made this purchase' writes the purchase to the activity store", () => {
    const { getByTestId } = mount();
    expect(useActivityStore.getState().purchases).toHaveLength(0);
    fireEvent.press(getByTestId('check-verdict-log-purchase'));
    const purchases = useActivityStore.getState().purchases;
    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.amountIls).toBe(1_500);
    expect(purchases[0]?.cardId).toBe('card-a');
    expect(purchases[0]?.activityId.startsWith('activity:')).toBe(true);
    expect(useActivityStore.getState().verdicts).toHaveLength(1);
    expect(useActivityStore.getState().verdicts[0]?.verdict).toBe(result.verdict);
  });
});
