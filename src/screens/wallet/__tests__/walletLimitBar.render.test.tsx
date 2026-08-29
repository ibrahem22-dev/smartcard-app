import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useActivityStore } from '../../../store/useActivityStore';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useLoansStore } from '../../../store/useLoansStore';
import { useUserStore } from '../../../store/useUserStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import type { ImportedInstallment } from '../../../types/installment.types';
import { Currency } from '../../../types/purchase.types';
import { WalletLimitBar } from '../WalletLimitBar';

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const CARD: EngineCard = {
  cardId: 'card:wallet-limit',
  cardProductId: 'product:wallet-limit',
  displayName: 'Wallet limit card',
  last4: '2468',
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
};

const INSTALLMENT: ImportedInstallment = {
  installmentId: 'installment:wallet-limit',
  billingCardId: CARD.cardId,
  merchantName: 'Store',
  monthlyPayment: 400,
  monthsRemaining: 4,
  totalAmount: 1_600,
  source: 'imported',
};

const context = (): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:wallet-limit',
    monthlyIncome: 10_000,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [CARD],
  installments: [INSTALLMENT],
  loans: [],
  purchases: [],
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

function positionFor(ctx: SurfaceContext) {
  const load = evaluateSurfaceEngines(ctx).load;
  if (load === null) throw new Error('the wallet-limit fixture must produce a load result');
  const position = load.cardLimits.find((row) => row.cardId === CARD.cardId);
  if (position === undefined) throw new Error('the wallet-limit fixture must produce a card position');
  return position;
}

function numericAccessibilityValues(node: unknown): number[] {
  if (Array.isArray(node)) return node.flatMap(numericAccessibilityValues);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as {
    readonly props?: { readonly accessibilityValue?: { readonly text?: unknown } };
    readonly children?: unknown;
  };
  const text = rendered.props?.accessibilityValue?.text;
  const own = typeof text === 'string' && Number.isFinite(Number(text))
    ? [Number(text)]
    : [];
  return [...own, ...numericAccessibilityValues(rendered.children)];
}

describe('Wallet available-limit bar', () => {
  beforeEach(() => {
    act(() => {
      useCardsStore.setState({ cards: [], obligations: [] });
      useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
      useLoansStore.setState({ loans: [] });
      useActivityStore.setState({ purchases: [], verdicts: [] });
      useUserStore.setState({ profile: null });
    });
  });

  it('renders the available limit the engine reported', () => {
    const ctx = context();
    const engineReported = positionFor(ctx).availableAfterEarlyPayoffIls.value;
    const tree = render(wrap(<WalletLimitBar cardId={CARD.cardId} context={ctx} />));

    expect(
      Number(tree.getByTestId('wallet-limit-bar-available').props.accessibilityValue?.text),
    ).toBe(engineReported);
  });

  it('renders no figure the engine did not publish', () => {
    const ctx = context();
    const engineReported = positionFor(ctx).availableAfterEarlyPayoffIls.value;
    const tree = render(wrap(<WalletLimitBar cardId={CARD.cardId} context={ctx} />));

    expect(numericAccessibilityValues(tree.toJSON())).toEqual([engineReported]);
  });

  it('renders an Estimate chip', () => {
    const tree = render(wrap(<WalletLimitBar cardId={CARD.cardId} context={context()} />));

    expect(tree.getByTestId('wallet-limit-bar-chip').props.accessibilityLabel).toBe('Estimate');
  });

  it('cannot render a Verified chip', () => {
    type Inputs = React.ComponentProps<typeof WalletLimitBar>;
    // Adding a chip prop makes this constant's required type `false`, so tsc catches the regression.
    const componentAcceptsNoChipInput: 'chip' extends keyof Inputs ? false : true = true;

    expect(componentAcceptsNoChipInput).toBe(true);
  });

  it('renders an honest unknown when the engine reports no limit position for the card', () => {
    const tree = render(wrap(<WalletLimitBar cardId="card:not-in-result" context={context()} />));

    expect(tree.getByTestId('wallet-limit-bar-unknown')).toBeTruthy();
    expect(tree.queryByTestId('wallet-limit-bar-available')).toBeNull();
    expect(numericAccessibilityValues(tree.toJSON())).toEqual([]);
  });
});
