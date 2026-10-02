import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import type { ImportedInstallment } from '../../../types/installment.types';
import { Currency } from '../../../types/purchase.types';
import { CommitmentRow } from '../CommitmentRow';

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

const CARD: EngineCard = {
  cardId: 'card:paid-early',
  cardProductId: 'product:paid-early',
  displayName: 'Installments card',
  last4: '2718',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 20_000, currentBalance: 2_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
};

const INSTALLMENT: ImportedInstallment = {
  installmentId: 'inst:paid-early',
  billingCardId: CARD.cardId,
  merchantName: 'KSP purchase',
  monthlyPayment: 431,
  monthsRemaining: 7,
  totalAmount: 3_017,
  source: 'imported',
};

const CONTEXT: SurfaceContext = {
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:paid-early',
    monthlyIncome: 10_000,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [CARD],
  installments: [INSTALLMENT],
  loans: [],
  purchases: [],
};

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

function showRow() {
  return render(wrap(
    <CommitmentRow
      context={CONTEXT}
      id={INSTALLMENT.installmentId}
      linkedCard={CARD}
      monthlyIls={INSTALLMENT.monthlyPayment}
      name={INSTALLMENT.merchantName}
    />,
  ));
}

function payEarly(tree: ReturnType<typeof render>): void {
  act(() => {
    fireEvent.press(tree.getByTestId(`commitment-row-${INSTALLMENT.installmentId}-chevron`));
  });
  act(() => {
    fireEvent.press(tree.getByTestId(`commitment-detail-${INSTALLMENT.installmentId}-paid-early`));
  });
}

function reportedRelease(): number {
  const result = evaluateSurfaceEngines({
    ...CONTEXT,
    paidEarlyCommitmentIds: [INSTALLMENT.installmentId],
  });
  const position = result.load?.cardLimits.find((item) => item.cardId === CARD.cardId);
  if (position === undefined) throw new Error('the fixture must produce a linked-card limit');
  return position.releasedByEarlyPayoffIls.value;
}

describe('Plan commitment Paid early — criterion J4', () => {
  beforeEach(() => mockedEvaluateSurfaceEngines.mockClear());

  it('frees the held limit through the load engine when a commitment is paid early', () => {
    const tree = showRow();
    mockedEvaluateSurfaceEngines.mockClear();

    payEarly(tree);

    expect(mockedEvaluateSurfaceEngines).toHaveBeenCalled();
    expect(mockedEvaluateSurfaceEngines.mock.calls.at(-1)?.[0].paidEarlyCommitmentIds)
      .toEqual([INSTALLMENT.installmentId]);
    expect(tree.getByTestId(`commitment-detail-${INSTALLMENT.installmentId}-freed`))
      .toBeTruthy();
  });

  it('renders the freed figure the engine reported', () => {
    const expected = reportedRelease();
    const tree = showRow();

    payEarly(tree);

    expect(
      tree.getByTestId(`commitment-detail-${INSTALLMENT.installmentId}-freed`)
        .props.accessibilityValue,
    ).toEqual({ text: String(expected) });
  });

  it('invents no interest rebate figure', () => {
    const sheetSource = readFileSync(join(__dirname, '../CommitmentDetailSheet.tsx'), 'utf8');
    const tree = showRow();

    payEarly(tree);

    expect(sheetSource).not.toMatch(/interest|rebate|ריבית|חיסכון/i);
    expect(tree.getByTestId(`commitment-detail-${INSTALLMENT.installmentId}-freed`)
      .props.accessibilityValue).toEqual({ text: String(reportedRelease()) });
  });

  it('uses the same implementation Card DNA section D uses', () => {
    const sheetSource = readFileSync(join(__dirname, '../CommitmentDetailSheet.tsx'), 'utf8');
    const cardDnaSource = readFileSync(
      join(__dirname, '../../cardDna/SectionDActiveNow.tsx'),
      'utf8',
    );

    for (const source of [sheetSource, cardDnaSource]) {
      expect(source).toMatch(/import\s+\{\s*usePaidEarly\s*\}/);
      expect(source).not.toMatch(/useState<readonly string\[\]>/);
      expect(source).not.toMatch(/setPaidEarlyCommitmentIds/);
    }
  });
});
