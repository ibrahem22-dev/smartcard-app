import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockCancelAllScheduledNotificationsAsync = jest.fn();
const mockGetAllScheduledNotificationsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetPermissionsAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync: mockCancelAllScheduledNotificationsAsync,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
}));

const fakeDb = {
  execSync: (): void => { /* this render suite needs only an empty catalog */ },
  closeSync: (): void => { /* this render suite owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

import { useLanguageStore } from '../../../store/useLanguageStore';
import {
  ROLE_BORDER,
  ROLE_SURFACE_BG,
  ROLE_TEXT,
} from '../../../theme/tokens';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { WaiverBadge } from '../WaiverBadge';

const CARD: EngineCard = {
  cardId: 'card:waiver',
  cardProductId: 'product:waiver',
  displayName: 'Waiver card',
  last4: '8642',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 1_000 },
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

const WAIVER_CARD: EngineCard = {
  ...CARD,
  cardFee: {
    originalFee: 20,
    discountPercent: 100,
    effectiveFee: 0,
    discountEndDate: '2026-09-10',
  },
};

function countdownAt(now: string): number {
  const tree = render(<WaiverBadge card={WAIVER_CARD} now={new Date(now)} />);
  return Number(
    tree.getByTestId('wallet-waiver-badge-countdown').props.accessibilityValue?.text,
  );
}

function classNamesInTree(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(classNamesInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as {
    readonly props?: { readonly className?: unknown };
    readonly children?: unknown;
  };
  const ownClassName = typeof rendered.props?.className === 'string'
    ? [rendered.props.className]
    : [];
  return [...ownClassName, ...classNamesInTree(rendered.children)];
}

describe('Wallet fee-waiver-expiry badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
    });
  });

  it('renders no badge when the card has no fee waiver', () => {
    const tree = render(<WaiverBadge card={CARD} now={new Date('2026-08-28T00:00:00Z')} />);

    expect(tree.queryByTestId('wallet-waiver-badge')).toBeNull();
  });

  it('renders a countdown to the waiver expiry the data carries', () => {
    const tree = render(
      <WaiverBadge card={WAIVER_CARD} now={new Date('2026-09-07T00:00:00Z')} />,
    );

    expect(
      tree.getByTestId('wallet-waiver-badge-countdown').props.accessibilityValue?.text,
    ).toBe('3');
    expect(tree.getByText('3 days remain on the card-fee waiver')).toBeTruthy();
  });

  it('counts down as the clock advances', () => {
    const earlier = countdownAt('2026-09-06T00:00:00Z');
    const later = countdownAt('2026-09-08T00:00:00Z');

    expect(later).not.toBe(earlier);
    expect(later).toBeLessThan(earlier);
  });

  it('renders amber and never red', () => {
    const tree = render(
      <WaiverBadge card={WAIVER_CARD} now={new Date('2026-09-07T00:00:00Z')} />,
    );
    const classes = classNamesInTree(tree.toJSON()).join(' ');

    expect(classes).toContain(ROLE_SURFACE_BG.advisory);
    expect(classes).toContain(ROLE_BORDER.advisory);
    expect(classes).toContain(ROLE_TEXT.advisory);
    expect(classes).not.toContain(ROLE_SURFACE_BG.danger);
    expect(classes).not.toContain(ROLE_BORDER.danger);
    expect(classes).not.toContain(ROLE_TEXT.danger);
    expect(classes).not.toMatch(/\b(?:bg|border|text)-red-\d{2,3}\b/);
  });

  it('schedules no notification and requests no permission', () => {
    render(<WaiverBadge card={WAIVER_CARD} now={new Date('2026-09-07T00:00:00Z')} />);

    // Passing spies prove only that this render made no calls; the gate also reads source imports.
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mockCancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mockGetAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
  });
});
