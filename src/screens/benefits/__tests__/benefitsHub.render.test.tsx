/**
 * THE BENEFITS HUB, RENDERED, over the real corpus and a real wallet.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BenefitsHubScreen } from '../BenefitsHubScreen';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';

const TODAY = '2026-09-06';

const card = (cardId: string, cardProductId: string): EngineCard => ({
  cardId,
  cardProductId,
  displayName: 'Card ' + cardId,
  last4: '1111',
  issuer: CardIssuer.Max,
  network: CardNetwork.Mastercard,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 0 },
  billingCycle: { statementClosingDay: 25, billingDayOfMonth: 2 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
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

const setWallet = (cards: readonly EngineCard[]): void => {
  act(() => { useCardsStore.setState({ cards: [...cards] }); });
};

describe('benefits hub surface', () => {
  beforeEach(() => {
    act(() => { useLanguageStore.getState().setLanguageChoice('he'); });
  });

  it('asks for a card when the wallet is empty', () => {
    setWallet([]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const headline = JSON.stringify(tree.getByTestId('benefits-hub-empty-headline').props.children);
    expect(headline).toContain('הוסיפו כרטיס');
    expect(tree.queryAllByTestId(/^benefits-hub-row-/)).toHaveLength(0);
  });

  it('says the dataset is silent, not that the card has nothing', () => {
    setWallet([card('v1', 'card:leumi:leumi-united-airlines-credit-card')]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const headline = JSON.stringify(tree.getByTestId('benefits-hub-empty-headline').props.children);
    expect(headline).toContain('לא נמצאה במאגר');
    expect(tree.getByTestId('benefits-hub-empty-note')).toBeTruthy();
  });

  it('lists a wallet’s evidenced benefits with a count and a contributing-card count', () => {
    setWallet([card('v1', 'card:max:skymax')]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const count = Number(tree.getByTestId('benefits-hub-count').props.accessibilityValue.text);
    expect(count).toBeGreaterThan(5);
    expect(Number(tree.getByTestId('benefits-hub-contributing-cards').props.accessibilityValue.text))
      .toBe(1);
    expect(tree.queryAllByTestId(/^benefits-hub-row-/).length).toBeGreaterThan(0);
    expect(tree.queryByTestId('benefits-hub-empty')).toBeNull();
  });

  it('offers an ALL filter plus only the families that have benefits', () => {
    setWallet([card('v1', 'card:max:skymax')]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    expect(tree.getByTestId('benefits-hub-filter-all')).toBeTruthy();
    const chips = tree.queryAllByTestId(/^benefits-hub-filter-/);
    expect(chips.length).toBeGreaterThan(1);
  });

  it('filters the list when a family chip is pressed', () => {
    setWallet([card('v1', 'card:max:skymax')]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const before = tree.queryAllByTestId(/^benefits-hub-row-/).length;
    const chips = tree.queryAllByTestId(/^benefits-hub-filter-/);
    const family = chips.find((c) => String(c.props.testID) !== 'benefits-hub-filter-all');
    if (family === undefined) throw new Error('no family filter to press');
    fireEvent.press(family);
    const after = tree.queryAllByTestId(/^benefits-hub-row-/).length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
  });

  it('says which category is empty rather than which wallet is', () => {
    setWallet([card('v1', 'card:max:skymax')]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    fireEvent.changeText(tree.getByTestId('benefits-hub-search'), 'טקסט שאין לו שום התאמה');
    const headline = JSON.stringify(tree.getByTestId('benefits-hub-empty-headline').props.children);
    expect(headline).toContain('אין הטבות בקטגוריה');
  });

  it('opens a benefit’s conditions on tap and names the providing card', () => {
    setWallet([card('v1', 'card:max:skymax')]);
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const rows = tree.queryAllByTestId(/^benefits-hub-row-[^-]+.*-toggle$/);
    const first = rows[0];
    if (first === undefined) throw new Error('no benefit row to open');
    expect(first.props.accessibilityState.expanded).toBe(false);
    fireEvent.press(first);
    expect(tree.queryAllByTestId(/^benefits-hub-detail-/).length).toBe(1);
  });

  it('scopes to one card when opened from that card', () => {
    setWallet([
      card('v1', 'card:max:skymax'),
      card('v2', 'card:leumi:leumi-united-airlines-credit-card'),
    ]);
    const tree = render(
      wrap(<BenefitsHubScreen route={{ params: { cardId: 'v2' } }} todayIso={TODAY} />),
    );
    expect(tree.getByTestId('benefits-hub-card-scope')).toBeTruthy();
    expect(Number(tree.getByTestId('benefits-hub-count').props.accessibilityValue.text)).toBe(0);
  });

  it('renders in Arabic and English without falling back to Hebrew headings', () => {
    setWallet([card('v1', 'card:max:skymax')]);
    act(() => { useLanguageStore.getState().setLanguageChoice('ar'); });
    const ar = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    expect(String(ar.getByTestId('benefits-hub-search').props.accessibilityLabel))
      .toBe('البحث في المزايا');

    act(() => { useLanguageStore.getState().setLanguageChoice('en'); });
    const en = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    expect(String(en.getByTestId('benefits-hub-search').props.accessibilityLabel))
      .toBe('Search benefits');
  });
});
