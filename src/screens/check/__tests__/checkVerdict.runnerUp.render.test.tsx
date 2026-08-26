/**
 * D5's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §9 runner-up: "Also good: … · saves ₪14 less". The delta is
 * `deltaFromBestIls` from `scoreCards`. When the engine omits it, the row
 * names the card and carries NO delta. The surface never subtracts two costs.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { scoreCards } from '../../../engines/scoring';
import { Currency } from '../../../types/purchase.types';

const NAMES: { readonly [cardId: string]: string } = {
  best: 'Max',
  middle: 'Club',
  worst: 'Basic',
};

const cards = [
  { cardId: 'middle', available: true as const, costIls: { value: 110, provenance: 'VERIFIED' as const } },
  { cardId: 'best', available: true as const, costIls: { value: 100, provenance: 'VERIFIED' as const } },
  { cardId: 'worst', available: true as const, costIls: { value: 120, provenance: 'VERIFIED' as const } },
];

const withDeltas = scoreCards({ cards });
const suppressed = scoreCards({ cards, deltasSuppressed: true });

const best = withDeltas.ranked[0];
const second = withDeltas.ranked[1];
const secondSuppressed = suppressed.ranked[1];
if (best === undefined || second === undefined || secondSuppressed === undefined) {
  throw new Error('scoreCards returned no runner-up — D5 has nothing honest to paint');
}

const recommendation = {
  displayName: NAMES[best.cardId] ?? best.cardId,
  matchScore: best.score,
};

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

const mount = (runnerUp: React.ComponentProps<typeof CheckVerdictScreen>['runnerUp']) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {runnerUp ? (
        <CheckVerdictScreen result={result} recommendation={recommendation} runnerUp={runnerUp} />
      ) : (
        <CheckVerdictScreen result={result} recommendation={recommendation} />
      )}
    </SafeAreaProvider>,
  );

describe('Check Verdict — D5: runner-up delta from the scoring engine', () => {
  it("paints the scoring engine's deltaFromBestIls when the engine supplies it", () => {
    expect(second.cardId).toBe('middle');
    const delta = second.deltaFromBestIls;
    if (delta === undefined) {
      throw new Error('scoreCards omitted deltaFromBestIls on the runner-up — this case needs a supplied field');
    }
    expect(delta.value).toBe(10);
    const { getByTestId } = mount({
      displayName: NAMES[second.cardId] ?? second.cardId,
      deltaFromBestIls: delta,
    });
    expect(getByTestId('check-verdict-runner-up').props.accessibilityValue?.text).toBe(String(delta.value));
    expect(String(getByTestId('check-verdict-runner-up').props.children)).toContain('Club');
  });

  it('paints no delta at all when the engine omits it', () => {
    expect(secondSuppressed.deltaFromBestIls).toBeUndefined();
    const { getByTestId } = mount({
      displayName: NAMES[secondSuppressed.cardId] ?? secondSuppressed.cardId,
    });
    const node = getByTestId('check-verdict-runner-up');
    expect(node.props.accessibilityValue?.text).toBeUndefined();
    expect(String(node.props.children)).toContain('Club');
    expect(String(node.props.children)).not.toContain('10');
  });

  it('omits the runner-up row when there is no second ranked card', () => {
    const { queryByTestId } = mount(undefined);
    expect(queryByTestId('check-verdict-runner-up')).toBeNull();
  });

  it('the claimed delta is the engine field, never a surface subtraction of two costs', () => {
    const delta = second.deltaFromBestIls;
    if (delta === undefined) {
      throw new Error('scoreCards omitted deltaFromBestIls on the runner-up — this case needs a supplied field');
    }
    const { getByTestId } = mount({
      displayName: NAMES[second.cardId] ?? second.cardId,
      deltaFromBestIls: delta,
    });
    expect(getByTestId('check-verdict-runner-up').props.accessibilityValue?.text).toBe(String(delta.value));
    expect(delta.value).not.toBe(second.effectiveCostIls.value);
  });
});
