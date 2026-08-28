import React from 'react';
import {
  act,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { keyVault } from '../../../security/keyVault';
import { MMKV_KEYS } from '../../../store/keys';
import { useActivityStore } from '../../../store/useActivityStore';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useLoansStore } from '../../../store/useLoansStore';
import { useUserStore } from '../../../store/useUserStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import type { ImportedInstallment } from '../../../types/installment.types';
import type { Loan } from '../../../types/loan.types';
import type { UserProfile } from '../../../types/user.types';
import { CommitmentsSummary } from '../CommitmentsSummary';

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const PROFILE_ID = 'profile:commitments-summary';

const PROFILE: UserProfile = {
  id: PROFILE_ID,
  monthlyIncome: 12_000,
  createdAt: 1,
  updatedAt: 1,
};

const INSTALLMENT: ImportedInstallment = {
  installmentId: 'installment:summary',
  merchantName: 'Summary store',
  totalAmount: 4_386,
  monthsRemaining: 6,
  monthlyPayment: 731,
  billingCardId: 'card:not-required-for-load-total',
  source: 'imported',
};

const LOAN: Loan = {
  id: 'loan:summary',
  loanType: 'personal',
  lenderName: 'Summary bank',
  originalAmount: 58_020,
  remainingBalance: 29_010,
  monthlyPayment: 967,
  annualInterestRate: 0.05,
  startDate: '2024-01-01',
  totalMonths: 60,
  monthsPaid: 30,
};

const context = (profile: UserProfile = PROFILE): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile,
  cards: [],
  installments: [INSTALLMENT],
  loans: [LOAN],
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
  if (load === null) throw new Error('the summary fixture must produce a load result');
  return load;
}

function paintedNumber(tree: ReturnType<typeof render>, testID: string): number {
  const text = tree.getByTestId(testID).props.accessibilityValue?.text;
  return Number(text);
}

function seed(profile: UserProfile = PROFILE): void {
  act(() => {
    const storage = keyVault.getEncryptedStorage();
    storage.set(MMKV_KEYS.activeProfileId, profile.id);
    storage.set(MMKV_KEYS.profileUser(profile.id), JSON.stringify(profile));
    useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
    useCardsStore.setState({ cards: [], obligations: [INSTALLMENT] });
    useLoansStore.setState({ loans: [LOAN] });
    useActivityStore.setState({ purchases: [], verdicts: [] });
    useUserStore.setState({ profile });
  });
}

describe('Plan Commitments sticky summary', () => {
  beforeEach(() => {
    seed();
  });

  it('renders all three parts together', () => {
    const tree = render(wrap(<CommitmentsSummary context={context()} />));

    expect(tree.getByTestId('commitments-summary-total')).toBeTruthy();
    expect(tree.getByTestId('commitments-summary-load-bar')).toBeTruthy();
    expect(tree.getByTestId('commitments-summary-cap')).toBeTruthy();
  });

  it('renders the total the engine reported and sums nothing itself', () => {
    const ctx = context();
    const engineReported = requiredLoad(ctx).current.monthlyObligationsIls.value;
    const tree = render(wrap(<CommitmentsSummary context={ctx} />));

    expect(paintedNumber(tree, 'commitments-summary-total')).toBe(engineReported);
  });

  it('renders the load ratio the engine reported', () => {
    const ctx = context();
    const engineReported = requiredLoad(ctx).current.ratioOfIncome.value;
    const tree = render(wrap(<CommitmentsSummary context={ctx} />));

    expect(paintedNumber(tree, 'commitments-summary-load-ratio')).toBe(engineReported);
  });

  it('renders a suggested cap when the user has not set one', () => {
    const ctx = context();
    const load = requiredLoad(ctx);
    const expected = PROFILE.monthlyIncome * load.thresholds.strongWarningRatio.value;
    const tree = render(wrap(<CommitmentsSummary context={ctx} />));

    expect(tree.getByTestId('commitments-summary-cap-suggested')).toBeTruthy();
    expect(
      paintedNumber(tree, 'commitments-summary-cap-suggested-value'),
    ).toBe(expected);
  });

  it('renders the user cap once they set one', () => {
    act(() => {
      useUserStore.getState().setCommitmentCapIls(4_321);
    });
    const tree = render(wrap(<CommitmentsSummary context={context()} />));

    expect(paintedNumber(tree, 'commitments-summary-cap-user-value')).toBe(4_321);
    expect(tree.queryByTestId('commitments-summary-cap-suggested')).toBeNull();
  });

  it('writes the cap to the vault when saved', () => {
    const tree = render(wrap(<CommitmentsSummary context={context()} />));
    fireEvent.changeText(tree.getByTestId('commitments-summary-cap-input'), '4567');
    act(() => {
      fireEvent.press(tree.getByTestId('commitments-summary-cap-save'));
    });

    const raw = keyVault
      .getEncryptedStorage()
      .getString(MMKV_KEYS.profileUser(PROFILE_ID));
    const stored = JSON.parse(raw ?? '{}') as UserProfile;
    expect(stored.commitmentCapIls).toBe(4_567);
    expect(useUserStore.getState().profile?.commitmentCapIls).toBe(4_567);
  });

  it('renders an honest absence when income is unknown', () => {
    const profile = { ...PROFILE, monthlyIncome: 0 };
    seed(profile);
    const tree = render(wrap(<CommitmentsSummary context={context(profile)} />));

    expect(tree.getByTestId('commitments-summary-total-absence')).toBeTruthy();
    expect(tree.getByTestId('commitments-summary-load-absence')).toBeTruthy();
    expect(tree.getByTestId('commitments-summary-cap-absence')).toBeTruthy();
    expect(tree.queryByTestId('commitments-summary-total')).toBeNull();
    expect(tree.queryByTestId('commitments-summary-load-ratio')).toBeNull();
    expect(tree.queryByTestId('commitments-summary-cap-suggested')).toBeNull();
  });
});
