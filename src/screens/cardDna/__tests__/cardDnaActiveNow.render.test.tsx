import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useCardsStore } from '../../../store/useCardsStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
} from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import type { ImportedInstallment } from '../../../types/installment.types';
import { Currency } from '../../../types/purchase.types';
import { SectionDActiveNow } from '../SectionDActiveNow';

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

jest.mock('../../../surfaces', () => {
  const actual = jest.requireActual('../../../surfaces');
  return {
    ...actual,
    evaluateSurfaceEngines: jest.fn(actual.evaluateSurfaceEngines),
  };
});

const mockedEvaluateSurfaceEngines = evaluateSurfaceEngines as jest.MockedFunction<
  typeof evaluateSurfaceEngines
>;

const card = (cardId: string): EngineCard => ({
  cardId,
  cardProductId: `product:${cardId}`,
  displayName: cardId,
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 12_000, currentBalance: 1_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
});

const installment = (
  installmentId: string,
  billingCardId: string,
  merchantName: string,
  monthlyPayment: number,
  monthsRemaining: number,
): ImportedInstallment => ({
  installmentId,
  billingCardId,
  merchantName,
  monthlyPayment,
  monthsRemaining,
  totalAmount: monthlyPayment * monthsRemaining,
  source: 'imported',
});

const SELECTED = card('card:selected');
const OTHER = card('card:other');
const SELECTED_INSTALLMENT = installment('inst:selected', SELECTED.cardId, 'KSP', 400, 4);
const OTHER_INSTALLMENT = installment('inst:other', OTHER.cardId, 'Ikea', 700, 3);

const context = (over: Partial<SurfaceContext> = {}): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:card-dna-active',
    monthlyIncome: 10_000,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [SELECTED, OTHER],
  installments: [SELECTED_INSTALLMENT, OTHER_INSTALLMENT],
  loans: [],
  purchases: [],
  ...over,
});

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

function requiredLoad(ctx: SurfaceContext) {
  const load = evaluateSurfaceEngines(ctx).load;
  if (load === null) throw new Error('the active-now fixture must produce a load result');
  return load;
}

function positionFor(ctx: SurfaceContext) {
  const position = requiredLoad(ctx).cardLimits.find((row) => row.cardId === SELECTED.cardId);
  if (position === undefined) throw new Error('the selected card must have a limit position');
  return position;
}

function paintedNumber(tree: ReturnType<typeof render>, testID: string): number {
  const text = tree.getByTestId(testID).props.accessibilityValue?.text;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${testID} did not paint a numeric accessibility value`);
  return value;
}

function show(ctx: SurfaceContext = context()) {
  return render(wrap(<SectionDActiveNow cardId={SELECTED.cardId} context={ctx} />));
}

describe("Card DNA what's active right now", () => {
  beforeEach(() => {
    mockedEvaluateSurfaceEngines.mockClear();
    act(() => {
      useCardsStore.setState({ cards: [], obligations: [] });
    });
  });

  it('renders the card limit position from the engine fields', () => {
    const ctx = context();
    const position = positionFor(ctx);
    const tree = show(ctx);

    expect(paintedNumber(tree, 'card-dna-utilization-limit')).toBe(position.creditLimitIls.value);
    expect(paintedNumber(tree, 'card-dna-utilization-holds')).toBe(position.activeInstallmentHoldsIls.value);
    expect(paintedNumber(tree, 'card-dna-utilization-before')).toBe(position.availableBeforeChangesIls.value);
    expect(paintedNumber(tree, 'card-dna-utilization-available')).toBe(position.availableAfterChangesIls.value);
  });

  it('renders the safe-zone threshold the engine reported', () => {
    const ctx = context();
    const load = requiredLoad(ctx);
    const tree = show(ctx);

    expect(paintedNumber(tree, 'card-dna-threshold-warning')).toBe(load.thresholds.warningRatio.value);
    expect(paintedNumber(tree, 'card-dna-threshold-strong-warning')).toBe(load.thresholds.strongWarningRatio.value);
    expect(paintedNumber(tree, 'card-dna-threshold-blocked')).toBe(load.thresholds.blockedRatio.value);
    expect(tree.getByTestId('card-dna-load-band').props.accessibilityValue?.text).toBe(load.current.band);
  });

  it('renders active installments on this card and no others', () => {
    const tree = show();

    expect(tree.getByTestId(`card-dna-installment-${SELECTED_INSTALLMENT.installmentId}`)).toBeTruthy();
    expect(tree.queryByTestId(`card-dna-installment-${OTHER_INSTALLMENT.installmentId}`)).toBeNull();
  });

  it('frees a hold through the engine when a commitment is marked paid early', () => {
    const tree = show();
    mockedEvaluateSurfaceEngines.mockClear();

    act(() => {
      fireEvent.press(
        tree.getByTestId(`card-dna-installment-${SELECTED_INSTALLMENT.installmentId}-paid-early`),
      );
    });

    expect(mockedEvaluateSurfaceEngines).toHaveBeenCalled();
    expect(mockedEvaluateSurfaceEngines.mock.calls.at(-1)?.[0].paidEarlyCommitmentIds).toEqual([
      SELECTED_INSTALLMENT.installmentId,
    ]);
    expect(tree.getByTestId('card-dna-utilization-released')).toBeTruthy();
  });

  it('renders the freed amount the engine reported rather than one it computed', () => {
    const markedContext = context({
      paidEarlyCommitmentIds: [SELECTED_INSTALLMENT.installmentId],
    });
    const engineReported = positionFor(markedContext).releasedByEarlyPayoffIls;
    mockedEvaluateSurfaceEngines.mockClear();
    const tree = show();

    act(() => {
      fireEvent.press(
        tree.getByTestId(`card-dna-installment-${SELECTED_INSTALLMENT.installmentId}-paid-early`),
      );
    });

    expect(paintedNumber(tree, 'card-dna-utilization-released')).toBe(engineReported.value);
  });

  it('renders no fee waiver countdown when the card has no waiver', () => {
    const tree = show(context({ cards: [SELECTED, OTHER] }));

    expect(tree.queryByTestId('card-dna-active-waiver')).toBeNull();
  });

  it('renders no seasonal offer when none is evidenced', () => {
    const tree = show();

    expect(tree.queryByTestId('card-dna-active-offers')).toBeNull();
  });
});
