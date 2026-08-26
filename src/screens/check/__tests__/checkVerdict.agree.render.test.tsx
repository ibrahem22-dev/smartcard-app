/**
 * R3's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 *   > **R3.** *"The pill and the Financial Impact panel never disagree, as an
 *   > automated property over generated inputs."*
 *
 * D2 named the Stitch sample. This suite generates a population of Check drafts,
 * runs each through the B1 seam, mounts the screen, and asserts that the painted
 * pill equals both the engine verdict AND the pill reconstructed from the painted
 * panel's load using that result's own thresholds. Two reconstructions that share
 * a threshold agree; two that do not are the Stitch defect.
 *
 * Named `*.render.test.tsx` so the default render project runs it (D-006: a
 * criterion about a screen that only the gate ever executes is a silent suite).
 *
 * Inputs with risk flags or imminent billing are excluded from reconstruction
 * (those states are not a function of load alone) and still must paint
 * `result.verdict` next to that result's own bullets.
 *
 * NEGATIVE CONTROL: set `PERTURBED_SAFE` to a different threshold (0.50 in place
 * of the result's safe ratio) and watch this property fail on the Stitch sample.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck, type PurchaseCheckContext } from '../runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';
import type { PurchaseVerdict, PurchaseVerdictResult } from '../../../engines/verdict';

/**
 * Path B's safe ratio. `null` means "use the result's own thresholdMath.safeRatio".
 * The negative control assigns `0.50` — treating the hard bound as if it were the
 * safe bound, which is how "Good to go at 41% vs a 35% threshold" is born.
 */
const PERTURBED_SAFE: number | null = null;

const VERDICTS: readonly PurchaseVerdict[] = [
  'good_to_go',
  'caution',
  'dont_buy_now',
  'wait_until_billing_passes',
];

const MINIMUM_GENERATED = 40;

type Gen = {
  readonly amount: number;
  readonly income: number;
  readonly commitments: readonly number[];
  readonly installments: number;
  readonly safe?: number;
  readonly hard?: number;
};

const draft = (g: Gen): CheckInputDraft => ({
  amount: g.amount,
  currency: Currency.ILS,
  category: null,
  installments: g.installments,
  cardId: null,
});

const context = (g: Gen): PurchaseCheckContext => {
  const base: PurchaseCheckContext = {
    monthlyIncomeIls: { value: g.income, provenance: 'USER' },
    commitments: g.commitments.map((value, i) => ({
      commitmentId: 'c' + String(i),
      monthlyAmountIls: { value, provenance: 'USER' },
    })),
  };
  if (g.safe === undefined || g.hard === undefined) return base;
  return {
    ...base,
    thresholds: {
      safeRatio: { value: g.safe, provenance: 'USER' },
      hardRatio: { value: g.hard, provenance: 'USER' },
    },
  };
};

function* generateLoadOnly(): Generator<Gen> {
  const incomes = [8_000, 10_000, 15_000];
  const fracs = [0.05, 0.2, 0.35, 0.41, 0.5, 0.51, 0.8];
  const extras = [0, 2_000];
  const plans = [1, 3];
  for (const income of incomes) {
    for (const frac of fracs) {
      for (const extra of extras) {
        for (const installments of plans) {
          const amount = Math.round(income * frac);
          if (amount < 1) continue;
          yield {
            amount,
            income,
            commitments: extra > 0 ? [extra] : [],
            installments,
          };
        }
      }
    }
  }
}

const pillFromLoad = (load: number, safe: number, hard: number): PurchaseVerdict => {
  if (load > hard) return 'dont_buy_now';
  if (load > safe) return 'caution';
  return 'good_to_go';
};

const mount = (result: PurchaseVerdictResult) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckVerdictScreen result={result} />
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

describe('Check Verdict — R3: pill and panel never disagree (generated inputs)', () => {
  it('generated inputs never paint a pill that disagrees with the panel', () => {
    const samples = [...generateLoadOnly()];
    expect(samples.length).toBeGreaterThanOrEqual(MINIMUM_GENERATED);

    for (const g of samples) {
      const result = runPurchaseCheck(draft(g), context(g));
      const { getByTestId, queryByTestId } = mount(result);
      const painted = paintedVerdict(queryByTestId);
      const load = Number(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE')));
      const math = result.financialImpact.thresholdMath;
      const pathBSafe = PERTURBED_SAFE ?? math.safeRatio.value;

      expect(painted).toBe(result.verdict);
      expect(load).toBe(math.projectedLoadRatio.value);
      expect(painted).toBe(pillFromLoad(load, pathBSafe, math.hardRatio.value));
    }
  });

  it('the Stitch sample is inside the generated set and is caution', () => {
    const stitch = runPurchaseCheck(draft({
      amount: 4_100,
      income: 10_000,
      commitments: [],
      installments: 1,
    }), context({
      amount: 4_100,
      income: 10_000,
      commitments: [],
      installments: 1,
    }));
    expect(stitch.verdict).toBe('caution');
    expect(stitch.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.41);
    expect(stitch.financialImpact.thresholdMath.safeRatio.value).toBe(0.35);

    const inSet = [...generateLoadOnly()].some(
      (g) => g.amount === 4_100 && g.income === 10_000 && g.commitments.length === 0 && g.installments === 1,
    );
    expect(inSet).toBe(true);

    const { getByTestId, queryByTestId } = mount(stitch);
    const painted = paintedVerdict(queryByTestId);
    const load = Number(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE')));
    const math = stitch.financialImpact.thresholdMath;
    const pathBSafe = PERTURBED_SAFE ?? math.safeRatio.value;
    expect(painted).toBe('caution');
    expect(painted).toBe(pillFromLoad(load, pathBSafe, math.hardRatio.value));
  });

  it('wait and hard-flag cases still paint the engine verdict next to its own panel', () => {
    const wait = runPurchaseCheck(
      {
        amount: 3_000,
        currency: Currency.ILS,
        category: null,
        installments: 1,
        cardId: null,
      },
      {
        monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
        commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
        imminentBilling: {
          date: '2026-09-02',
          commitmentsClearingIls: { value: 2_000, provenance: 'USER' },
        },
      },
    );
    const flagged = runPurchaseCheck(
      {
        amount: 100,
        currency: Currency.ILS,
        category: null,
        installments: 1,
        cardId: null,
      },
      {
        monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
        commitments: [],
        riskFlags: [{ flagId: 'hard-stop', severity: 'hard' }],
      },
    );
    expect(wait.verdict).toBe('wait_until_billing_passes');
    expect(flagged.verdict).toBe('dont_buy_now');

    for (const result of [wait, flagged]) {
      const { getByTestId, queryByTestId } = mount(result);
      expect(paintedVerdict(queryByTestId)).toBe(result.verdict);
      expect(Number(claimOf(getByTestId('check-verdict-impact-LOAD_AFTER_PURCHASE')))).toBe(
        result.financialImpact.thresholdMath.projectedLoadRatio.value,
      );
      for (const bullet of result.financialImpact.bullets) {
        expect(getByTestId(`check-verdict-impact-${bullet.kind}`)).toBeTruthy();
      }
    }
  });
});
