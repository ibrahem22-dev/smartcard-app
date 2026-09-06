/**
 * THE NEGOTIATION HUB, RENDERED — and every external effect observed rather than fired.
 *
 * `openUrl` and `copyText` are injected, so the suite can prove exactly what a tap would open
 * without opening anything. The two assertions that matter most are the negative ones: nothing
 * leaves on mount, and no private figure is inside the message.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { IssuerNegotiationSheet } from '../IssuerNegotiationSheet';
import { WaiverBadge } from '../WaiverBadge';
import { useLanguageStore } from '../../../store/useLanguageStore';
import {
  CardIssuer,
  CardNetwork,
  type CardInput,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';

const CARD: CardInput = {
  cardId: 'vault-1',
  cardProductId: 'card:max:skymax',
  displayName: 'SKYMAX',
  last4: '8899',
  issuer: CardIssuer.Max,
  issuerOrgId: 'org:max',
  network: CardNetwork.Mastercard,
  currency: Currency.ILS,
  framework: { creditLimit: 30_000, currentBalance: 2_500 },
  billingCycle: { statementClosingDay: 25, billingDayOfMonth: 2 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0.03,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
  cardFee: {
    originalFee: 20,
    discountPercent: 100,
    effectiveFee: 0,
    discountEndDate: '2026-10-01',
  },
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

function mount(overrides: Partial<React.ComponentProps<typeof IssuerNegotiationSheet>> = {}) {
  const opened: string[] = [];
  const copied: string[] = [];
  const tree = render(
    wrap(
      <IssuerNegotiationSheet
        card={CARD}
        copyText={async (text): Promise<void> => { copied.push(text); }}
        onClose={(): void => { /* observed by the caller when it matters */ }}
        openUrl={async (url): Promise<void> => { opened.push(url); }}
        visible
        {...overrides}
      />,
    ),
  );
  return { tree, opened, copied };
}

describe('issuer negotiation hub', () => {
  beforeEach(() => {
    act(() => {
      useLanguageStore.getState().setLanguageChoice('he');
    });
  });

  it('the waiver badge opens the hub instead of only counting down', () => {
    const presses: number[] = [];
    const tree = render(
      wrap(
        <WaiverBadge
          card={CARD}
          now={new Date('2026-09-06T00:00:00Z')}
          onPress={(): void => { presses.push(1); }}
        />,
      ),
    );
    const badge = tree.getByTestId('wallet-waiver-badge');
    expect(badge.props.accessibilityRole).toBe('button');
    fireEvent.press(badge);
    expect(presses).toHaveLength(1);
    /* And the countdown is still the cue: it did not become a bare tap target. */
    expect(tree.getByTestId('wallet-waiver-badge-countdown')).toBeTruthy();
  });

  it('resolves the issuer from the canonical org id and shows its verified number', () => {
    const { tree } = mount();
    expect(tree.getByTestId('issuer-negotiation-issuer')).toBeTruthy();
    const call = tree.getByTestId('issuer-negotiation-call');
    /* The label carries the number, and reading the label avoids stringifying a React tree. */
    expect(String(call.props.accessibilityLabel)).toContain('03-6178888');
  });

  it('opens a tel: URI on call, and nothing before the press', () => {
    const { tree, opened } = mount();
    expect(opened).toEqual([]);
    fireEvent.press(tree.getByTestId('issuer-negotiation-call'));
    expect(opened).toEqual(['tel:03-6178888']);
  });

  it('opens a wa.me URI carrying the message the screen already showed', () => {
    const { tree, opened } = mount();
    const shown = JSON.stringify(tree.getByTestId('issuer-negotiation-message').props.children);
    fireEvent.press(tree.getByTestId('issuer-negotiation-whatsapp'));
    expect(opened).toHaveLength(1);
    const url = opened[0] as string;
    expect(url.startsWith('https://wa.me/972545408881?text=')).toBe(true);
    const sent = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(shown).toContain(sent.slice(0, 20));
  });

  it('copies the same text it displays', () => {
    const { tree, copied } = mount();
    fireEvent.press(tree.getByTestId('issuer-negotiation-copy'));
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('SKYMAX');
  });

  it('puts NO private figure in the message', () => {
    const { tree, copied } = mount();
    fireEvent.press(tree.getByTestId('issuer-negotiation-copy'));
    const text = copied[0] as string;
    for (const secret of ['30000', '30,000', '2500', '2,500', '8899', '0.03']) {
      expect(text).not.toContain(secret);
    }
  });

  it('switches the script and the message follows', () => {
    const { tree } = mount();
    const before = JSON.stringify(tree.getByTestId('issuer-negotiation-message').props.children);
    fireEvent.press(tree.getByTestId('issuer-negotiation-topic-fee-reduction'));
    const after = JSON.stringify(tree.getByTestId('issuer-negotiation-message').props.children);
    expect(after).not.toBe(before);
  });

  it('writes the script in the reader’s language', () => {
    act(() => { useLanguageStore.getState().setLanguageChoice('ar'); });
    const { tree } = mount();
    const arabic = JSON.stringify(tree.getByTestId('issuer-negotiation-message').props.children);
    expect(/[؀-ۿ]/.test(arabic)).toBe(true);

    act(() => { useLanguageStore.getState().setLanguageChoice('en'); });
    const { tree: en } = mount();
    const english = JSON.stringify(en.getByTestId('issuer-negotiation-message').props.children);
    expect(english).toContain('Hello');
  });

  it('says so, and offers no call button, when the corpus publishes no number', () => {
    const historical: CardInput = { ...CARD, issuerOrgId: 'org:union' };
    const { tree } = mount({ card: historical });
    expect(tree.queryByTestId('issuer-negotiation-call')).toBeNull();
    expect(tree.getByTestId('issuer-negotiation-no-phone')).toBeTruthy();
    /* The scripts still work for somebody who knows their own issuer's number. */
    expect(tree.getByTestId('issuer-negotiation-message')).toBeTruthy();
  });

  it('shows the fee as a level set rather than picking one', () => {
    const amex: CardInput = {
      ...CARD,
      cardProductId: 'card:amex-il:adif-american-express',
      issuerOrgId: 'org:amex-il',
    };
    const { tree } = mount({ card: amex });
    expect(tree.queryByTestId('issuer-negotiation-fee-value')).toBeNull();
    expect(tree.getByTestId('issuer-negotiation-fee-unresolved')).toBeTruthy();
  });
});
