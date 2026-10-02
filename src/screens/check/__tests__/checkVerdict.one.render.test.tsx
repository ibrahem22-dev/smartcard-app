/**
 * D2's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * The pill and the Financial Impact panel come from ONE engine computation. The
 * Stitch sample ("Good to go" at 41% vs a 35% threshold) must be impossible on
 * this surface: the screen paints `result.verdict` and `result.financialImpact`
 * from the same `runPurchaseCheck` object, and the rendered pair is what is
 * asserted. A grep of the source for "one computation" would prove the comment.
 *
 * This suite does not invent a pill or a panel. Every result came from the B1 seam.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck, type PurchaseCheckContext } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';
import type { ImpactBullet, PurchaseVerdict, PurchaseVerdictResult } from '../../../engines/verdict';

const VERDICTS: readonly PurchaseVerdict[] = [
  'good_to_go',
  'caution',
  'dont_buy_now',
  'wait_until_billing_passes',
];

const draft = (amount: number): CheckInputDraft => ({
  amount,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
});

const context = (overrides: Partial<PurchaseCheckContext> = {}): PurchaseCheckContext => ({
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
  ...overrides,
});

/** Spec §9 Stitch sample: 41% load, 35% safe threshold. Engine must say caution. */
const stitch = runPurchaseCheck(draft(4_100), context({ commitments: [] }));

const STATES: { readonly verdict: PurchaseVerdict; readonly result: PurchaseVerdictResult }[] = [
  { verdict: 'good_to_go', result: runPurchaseCheck(draft(1_500), context()) },
  { verdict: 'caution', result: runPurchaseCheck(draft(1_501), context()) },
  { verdict: 'dont_buy_now', result: runPurchaseCheck(draft(3_001), context()) },
  {
    verdict: 'wait_until_billing_passes',
    result: runPurchaseCheck(
      draft(3_000),
      context({
        imminentBilling: {
          date: '2026-09-02',
          commitmentsClearingIls: { value: 2_000, provenance: 'USER' },
        },
      }),
    ),
  },
];

const mount = (result?: PurchaseVerdictResult) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {result === undefined ? <CheckVerdictScreen /> : <CheckVerdictScreen result={result} />}
    </SafeAreaProvider>,
  );

const paintedVerdict = (queryByTestId: (id: string) => unknown): PurchaseVerdict => {
  const found = VERDICTS.filter((v) => queryByTestId(`check-verdict-pill-${v}`));
  if (found.length !== 1 || found[0] === undefined) {
    throw new Error('expected exactly one painted pill, got ' + found.join(','));
  }
  return found[0];
};

const claimOf = (node: { props: { accessibilityValue?: { text?: string } } }): string => {
  const text = node.props.accessibilityValue?.text;
  if (text === undefined || text.length === 0) {
    throw new Error('impact bullet has no claimed engine value');
  }
  return text;
};

const expectedClaim = (bullet: ImpactBullet): string => {
  switch (bullet.kind) {
    case 'PURCHASE_MONTHLY_COMMITMENT':
    case 'HARD_THRESHOLD_HEADROOM':
      return String(bullet.amountIls.value);
    case 'LOAD_AFTER_PURCHASE':
      return String(bullet.ratioOfIncome.value);
    case 'LOAD_AFTER_BILLING':
      return `${bullet.billingDate}|${bullet.ratioOfIncome.value}`;
  }
};

const assertOneComputation = (
  result: PurchaseVerdictResult,
  queryByTestId: (id: string) => unknown,
  getByTestId: (id: string) => { props: { accessibilityValue?: { text?: string } } },
): void => {
  expect(paintedVerdict(queryByTestId)).toBe(result.verdict);
  expect(getByTestId('check-verdict-impact-panel')).toBeTruthy();
  expect(result.financialImpact.bullets.length).toBeGreaterThanOrEqual(2);
  expect(result.financialImpact.bullets.length).toBeLessThanOrEqual(3);
  for (const bullet of result.financialImpact.bullets) {
    expect(claimOf(getByTestId(`check-verdict-impact-${bullet.kind}`))).toBe(expectedClaim(bullet));
  }
  const load = Number(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE')));
  const safe = result.financialImpact.thresholdMath.safeRatio.value;
  if (paintedVerdict(queryByTestId) === 'good_to_go') {
    expect(load).toBeLessThanOrEqual(safe);
  }
};

describe('Check Verdict — D2: pill and panel from one computation', () => {
  it('the Stitch sample — 41% load against the 35% threshold renders caution, not Good to go', () => {
    expect(stitch.verdict).toBe('caution');
    expect(stitch.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.41);
    expect(stitch.financialImpact.thresholdMath.safeRatio.value).toBe(0.35);
    const { getByTestId, queryByTestId } = mount(stitch);
    expect(paintedVerdict(queryByTestId)).toBe('caution');
    expect(queryByTestId('check-verdict-pill-good_to_go')).toBeNull();
    expect(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE'))).toBe('0.41');
    const load = Number(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE')));
    expect(load).toBeGreaterThan(stitch.financialImpact.thresholdMath.safeRatio.value);
    expect(paintedVerdict(queryByTestId)).not.toBe('good_to_go');
  });

  it('the pill and every Financial Impact bullet come from the same result object', () => {
    for (const row of STATES) {
      expect(row.result.verdict).toBe(row.verdict);
      const { getByTestId, queryByTestId } = mount(row.result);
      assertOneComputation(row.result, queryByTestId, getByTestId);
    }
  });

  it('Good to go never paints when the panel shows load above the safe threshold', () => {
    const samples: PurchaseVerdictResult[] = [
      stitch,
      ...STATES.map((row) => row.result),
      runPurchaseCheck(draft(4_100), context({ commitments: [] })),
      runPurchaseCheck(draft(1), context({ commitments: [] })),
    ];
    for (const result of samples) {
      const { getByTestId, queryByTestId } = mount(result);
      const load = Number(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE')));
      const safe = result.financialImpact.thresholdMath.safeRatio.value;
      if (load > safe) {
        expect(paintedVerdict(queryByTestId)).not.toBe('good_to_go');
      }
    }
  });

  it('caution, dont_buy_now and wait each still agree with the panel of the same result', () => {
    for (const row of STATES.filter((s) => s.verdict !== 'good_to_go')) {
      const { getByTestId, queryByTestId } = mount(row.result);
      assertOneComputation(row.result, queryByTestId, getByTestId);
    }
  });

  it('without a result there is no pill and no panel — a canned pair would be a second computation', () => {
    const { queryByTestId } = mount();
    expect(queryByTestId('check-verdict-not-yet')).toBeTruthy();
    expect(queryByTestId('check-verdict-impact-panel')).toBeNull();
    for (const verdict of VERDICTS) {
      expect(queryByTestId(`check-verdict-pill-${verdict}`)).toBeNull();
    }
  });
});
