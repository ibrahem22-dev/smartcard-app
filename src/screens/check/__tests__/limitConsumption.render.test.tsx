/**
 * L2 measured on the rendered surface — the painted strip is the load-engine
 * field. After a logged purchase, the next strip is the new engine number.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import type { CheckVerdictScreenProps } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../runPurchaseCheck';
import { verdictPropsFromDraft } from '../checkLoop';
import {
  loadCardsFromVault,
  writeLoggedPurchase,
} from '../activityMapper';
import { evaluateFinancialLoad } from '../../../engines/load';
import type { CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';
import type { UserProfile } from '../../../types/user.types';

const profile: UserProfile = {
  id: 'user-1',
  monthlyIncome: 10_000,
  createdAt: 1,
  updatedAt: 1,
};

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

const logged = writeLoggedPurchase({
  activityId: 'activity:l2-render',
  amountIls: 1_500,
  at: '2026-08-27T10:00:00.000Z',
  cardId: 'card-a',
});

const cards = [{ cardId: 'card-a', creditLimit: 10_000 }] as const;

const beforeProps = verdictPropsFromDraft(draft, {
  profile,
  cards,
  purchases: [],
  todayIso: '2026-08-27',
});
const afterProps = verdictPropsFromDraft(draft, {
  profile,
  cards,
  purchases: [logged],
  todayIso: '2026-08-27',
});

const mount = (strip: NonNullable<CheckVerdictScreenProps['impactStrip']>) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckVerdictScreen
        impactStrip={strip}
        result={result}
      />
    </SafeAreaProvider>,
  );

describe('Check Verdict — L2: next impact strip reflects logged purchase', () => {
  it('paints the post-log load-engine availableAfterChangesIls, not a surface subtraction', () => {
    const loadCards = loadCardsFromVault(cards, [logged]);
    const load = evaluateFinancialLoad({
      monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
      commitments: [],
      cards: loadCards,
      prospectiveCommitment: {
        commitmentId: 'this-purchase',
        monthlyAmountIls: { value: 1_500, provenance: 'USER' },
        linkedCardId: 'card-a',
        remainingHoldIls: { value: 1_500, provenance: 'USER' },
      },
    });
    const position = load.cardLimits[0];
    if (position === undefined) {
      throw new Error('load engine returned no cardLimits');
    }
    const surfaceGuess = 10_000 - 1_500;
    expect(position.availableAfterChangesIls.value).not.toBe(surfaceGuess);
    const strip = afterProps.impactStrip;
    if (strip === undefined) {
      throw new Error('next verdict omitted the impact strip');
    }
    expect(strip.availableAfterPurchaseIls.value).toBe(position.availableAfterChangesIls.value);
    const { getByTestId } = mount(strip);
    expect(getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).toBe(
      String(position.availableAfterChangesIls.value),
    );
    expect(getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).not.toBe(
      String(surfaceGuess),
    );
  });

  it('the next strip is lower than the pre-log strip by the logged amount', () => {
    const before = beforeProps.impactStrip?.availableAfterPurchaseIls.value;
    const after = afterProps.impactStrip?.availableAfterPurchaseIls.value;
    if (before === undefined || after === undefined) {
      throw new Error('checkLoop omitted an impact strip');
    }
    expect(after).toBe(before - 1_500);
    const first = mount(beforeProps.impactStrip!);
    expect(first.getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).toBe(
      String(before),
    );
    first.unmount();
    const second = mount(afterProps.impactStrip!);
    expect(second.getByTestId('check-verdict-impact-strip').props.accessibilityValue?.text).toBe(
      String(after),
    );
  });
});
