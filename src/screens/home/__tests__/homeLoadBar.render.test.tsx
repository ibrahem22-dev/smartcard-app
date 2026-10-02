import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useActivityStore } from '../../../store/useActivityStore';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useLoansStore } from '../../../store/useLoansStore';
import { useUserStore } from '../../../store/useUserStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import type { ImportedInstallment } from '../../../types/installment.types';
import type { UserProfile } from '../../../types/user.types';
import { HomeLoadBar } from '../HomeLoadBar';

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const PROFILE: UserProfile = {
  id: 'profile:home-load-bar',
  monthlyIncome: 13_700,
  createdAt: 1,
  updatedAt: 1,
};

const INSTALLMENT: ImportedInstallment = {
  installmentId: 'installment:home-load-bar',
  merchantName: 'Fixture store',
  totalAmount: 9_000,
  monthsRemaining: 5,
  monthlyPayment: 1_800,
  billingCardId: 'card:not-required-for-total',
  source: 'imported',
};

const context = (profile: UserProfile | null = PROFILE): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile,
  cards: [],
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

function requiredLoad(ctx: SurfaceContext) {
  const load = evaluateSurfaceEngines(ctx).load;
  if (load === null) throw new Error('the Home load-bar fixture must produce a load result');
  return load;
}

function paintedNumber(tree: ReturnType<typeof render>, testID: string): number {
  return Number(tree.getByTestId(testID).props.accessibilityValue?.text);
}

describe('Home monthly load bar', () => {
  beforeEach(() => {
    act(() => {
      useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
      useCardsStore.setState({ cards: [], obligations: [] });
      useLoansStore.setState({ loans: [] });
      useActivityStore.setState({ purchases: [], verdicts: [] });
      useUserStore.setState({ profile: null });
    });
  });

  it('renders the ratio the engine reported', () => {
    const ctx = context();
    const engineReported = requiredLoad(ctx).current.ratioOfIncome.value;
    const tree = render(wrap(<HomeLoadBar context={ctx} />));

    expect(paintedNumber(tree, 'home-load-bar-ratio')).toBe(engineReported);
    expect(tree.getByTestId('home-load-bar').props.accessibilityValue?.now)
      .toBe(engineReported);
  });

  it('renders the absolute shekel figure beside it', () => {
    const ctx = context();
    const engineReported = requiredLoad(ctx).current.monthlyObligationsIls.value;
    const tree = render(wrap(<HomeLoadBar context={ctx} />));

    expect(paintedNumber(tree, 'home-load-bar-absolute')).toBe(engineReported);
    expect(String(tree.getByTestId('home-load-bar-absolute').props.children)).toContain('₪');
    expect(tree.getByTestId('home-load-bar-ratio')).toBeTruthy();
  });

  it('places the ticks at the engine thresholds', () => {
    const ctx = context();
    const thresholds = requiredLoad(ctx).thresholds;
    const tree = render(wrap(<HomeLoadBar context={ctx} />));

    expect(paintedNumber(tree, 'home-load-bar-tick-strong'))
      .toBe(thresholds.strongWarningRatio.value);
    expect(paintedNumber(tree, 'home-load-bar-tick-blocked'))
      .toBe(thresholds.blockedRatio.value);
  });

  it('writes no threshold of its own', () => {
    const thresholds = requiredLoad(context()).thresholds;
    const source = readFileSync(join(__dirname, '..', 'HomeLoadBar.tsx'), 'utf8');

    expect(source).not.toContain(String(thresholds.strongWarningRatio.value));
    expect(source).not.toContain(String(thresholds.blockedRatio.value));
  });

  it('renders nothing and says what is missing when income is unknown', () => {
    const profile = { ...PROFILE, monthlyIncome: 0 };
    const tree = render(wrap(<HomeLoadBar context={context(profile)} />));

    expect(String(tree.getByTestId('home-load-bar-absent').props.children))
      .toContain('monthly income');
    expect(tree.queryByTestId('home-load-bar')).toBeNull();
    expect(tree.queryByTestId('home-load-bar-ratio')).toBeNull();
    expect(tree.queryByTestId('home-load-bar-absolute')).toBeNull();
  });
});
