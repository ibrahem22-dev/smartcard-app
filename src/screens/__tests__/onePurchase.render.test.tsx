/**
 * C1 — ONE PURCHASE.
 *
 * One press on the shipped Check Verdict action calls the canonical activity-store writer. Home,
 * two attributed Wallet bars, Plan and the Check route are mounted together, so their Zustand
 * subscriptions produce the plain purchase's visible next render in one React run.
 *
 * The suite loads the real surface engine. A one-time purchase reaches it through
 * `loadCardsFromVault`, where it contributes to the selected card's logged-this-cycle utilisation.
 * It does not create an installment or loan, so Home's safe-to-commit amount and Plan's commitment
 * total must remain unchanged. The Verdict's impact strip keeps its promise on the press — it
 * already stated the available limit after this purchase — and Wallet catches up to it
 * (OQ-MDC-012 option 2, PD-MDC-071/073). Persistence is proved by discarding in-memory activity and asking
 * the real activity store to re-read the active profile's encrypted-vault record.
 */
import React from 'react';
import {
  act,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BOTTOM_NAVIGATION } from '../../navigation/ia';
import { CheckStack } from '../../navigation/stacks/CheckStack';
import { keyVault } from '../../security/keyVault';
import { HomeHero } from '../home/HomeHero';
import { CommitmentsSummary } from '../plan/CommitmentsSummary';
import { WalletLimitBar } from '../wallet/WalletLimitBar';
import { hydrated } from '../../store/hydration';
import { MMKV_KEYS } from '../../store/keys';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import { commitmentsFromVault } from '../../check/commitmentInput';
import {
  derivedCardCount,
  derivedContexts,
  type DerivedContext,
} from '../../surfaces/__tests__/derivedPopulation';

const PURCHASE_AMOUNT_ILS = 500;
const HYDRATED_AT = '2026-09-01T00:00:00.000Z';

let mockVerdictDraft = {
  amount: PURCHASE_AMOUNT_ILS,
  currency: 'ILS' as const,
  category: null,
  installments: null,
  cardId: null as string | null,
};

jest.mock('@react-navigation/native-stack', () => {
  const ReactForMock = require('react') as typeof React;
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { readonly children: React.ReactNode }) => {
        const screens = ReactForMock.Children.toArray(children);
        const verdict = screens.find((child) => (
          ReactForMock.isValidElement(child)
          && (child.props as { readonly name?: string }).name === 'CheckVerdict'
        )) as React.ReactElement<{
          readonly component: React.ComponentType<{
            readonly route: { readonly params: { readonly draft: typeof mockVerdictDraft } };
          }>;
        }> | undefined;
        if (verdict === undefined) throw new Error('CheckStack did not register CheckVerdict');
        return ReactForMock.createElement(verdict.props.component, {
          route: { params: { draft: mockVerdictDraft } },
        });
      },
      Screen: (): null => null,
    }),
  };
});

const generatedPurchaseContexts = (): readonly DerivedContext[] => derivedContexts().filter(
  ({ context }) => context.profile !== null && context.cards.length > 0,
);

const purchaseParticipants = () => BOTTOM_NAVIGATION.filter((item) => item.key !== 'More');

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

interface SeededPurchase {
  readonly profileId: string;
  readonly cardId: string;
  readonly unrelatedCardId: string;
}

function seed({ context }: DerivedContext): SeededPurchase {
  const profile = context.profile;
  const cardId = context.cards[0]?.cardId;
  const unrelatedCardId = context.cards[1]?.cardId;
  if (profile === null || cardId === undefined || unrelatedCardId === undefined) {
    throw new Error('generatedPurchaseContexts admitted a context without a profile and two cards');
  }
  const hydration = hydrated(HYDRATED_AT);
  keyVault.getEncryptedStorage().set(MMKV_KEYS.activeProfileId, profile.id);
  act(() => {
    useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
    useUserStore.setState({ profile, hydration });
    useCardsStore.setState({
      cards: [...context.cards],
      obligations: [...context.installments],
      hydration,
    });
    useLoansStore.setState({ loans: [...context.loans], hydration });
    useActivityStore.setState({ purchases: [], verdicts: [], hydration });
  });
  useActivityStore.getState().persistProfile(profile.id);
  mockVerdictDraft = { ...mockVerdictDraft, cardId };
  return { profileId: profile.id, cardId, unrelatedCardId };
}

function paintedNumber(tree: ReturnType<typeof render>, testID: string): number {
  const text = tree.getByTestId(testID).props.accessibilityValue?.text;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${testID} did not paint a finite number`);
  return value;
}

function paintedLifecycle(tree: ReturnType<typeof render>) {
  const walletFigures = tree.getAllByTestId('wallet-limit-bar-available').map((node) => {
    const value = Number(node.props.accessibilityValue?.text);
    if (!Number.isFinite(value)) throw new Error('a Wallet limit bar did not paint a finite number');
    return value;
  });
  const [wallet, unrelatedWallet] = walletFigures;
  if (wallet === undefined || unrelatedWallet === undefined || walletFigures.length !== 2) {
    throw new Error(`expected exactly two Wallet limit bars, found ${walletFigures.length}`);
  }
  return {
    home: paintedNumber(tree, 'home-hero-amount'),
    wallet,
    unrelatedWallet,
    plan: paintedNumber(tree, 'commitments-summary-total'),
    verdict: paintedNumber(tree, 'check-verdict-impact-strip'),
  };
}

function commitmentMechanism() {
  const cards = useCardsStore.getState().cards;
  const installments = useCardsStore.getState().obligations;
  const loans = useLoansStore.getState().loans;
  return {
    count: commitmentsFromVault({ cards, installments, loans }).length,
    installmentIds: installments.map((installment) => installment.installmentId),
    loanIds: loans.map((loan) => loan.id),
  };
}

describe('C1 — one canonical purchase write', () => {
  it('derives a non-zero generated context and surface population from navigation and the shipped catalog', () => {
    const contexts = generatedPurchaseContexts();
    const participants = purchaseParticipants();

    expect(derivedCardCount()).toBeGreaterThan(0);
    expect(contexts.length).toBeGreaterThan(0);
    expect(participants.map((item) => item.key)).toEqual(['Home', 'Wallet', 'Check', 'Plan']);
  });

  it('writes and rehydrates one attributed plain purchase while only Wallet moves and the Verdict keeps its promise', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const generated of generatedPurchaseContexts()) {
      const { profileId, cardId, unrelatedCardId } = seed(generated);
      const tree = render(wrap(
        <>
          <HomeHero />
          <WalletLimitBar cardId={cardId} />
          <WalletLimitBar cardId={unrelatedCardId} />
          <CommitmentsSummary />
          <CheckStack />
        </>,
      ));
      const before = paintedLifecycle(tree);
      const purchasesBefore = useActivityStore.getState().purchases;
      const commitmentsBefore = commitmentMechanism();

      act(() => {
        fireEvent.press(tree.getByTestId('check-verdict-log-purchase'));
      });
      const after = paintedLifecycle(tree);
      const purchasesAfter = useActivityStore.getState().purchases;
      const commitmentsAfter = commitmentMechanism();

      if (purchasesAfter.length - purchasesBefore.length !== 1 || purchasesAfter.length !== 1) {
        problems.push(`${generated.label}: one press changed purchase count from ${purchasesBefore.length} to ${purchasesAfter.length}, expected exactly 0 to 1`);
      }
      const written = purchasesAfter[0];
      if (written?.amountIls !== PURCHASE_AMOUNT_ILS || written.cardId !== cardId) {
        problems.push(`${generated.label}: canonical record was ${JSON.stringify(written)}, expected amount ${PURCHASE_AMOUNT_ILS} on ${cardId}`);
      }
      if (after.home !== before.home) {
        problems.push(`${generated.label}: Home painted ${after.home}, expected unchanged ${before.home}`);
      }
      if (after.wallet !== before.wallet - PURCHASE_AMOUNT_ILS) {
        problems.push(`${generated.label}: Wallet painted ${after.wallet}, expected ${before.wallet - PURCHASE_AMOUNT_ILS}`);
      }
      if (after.unrelatedWallet !== before.unrelatedWallet) {
        problems.push(`${generated.label}: unrelated card ${unrelatedCardId} painted ${after.unrelatedWallet}, expected unchanged ${before.unrelatedWallet}`);
      }
      if (after.plan !== before.plan) {
        problems.push(`${generated.label}: Plan painted ${after.plan}, expected unchanged ${before.plan}`);
      }
      /* OQ-MDC-012 option 2 (PD-MDC-071/073): the strip already promised the available limit AFTER
         this purchase; the press turns the prospect into the fact, so the strip does not move and
         Wallet catches up to it. The earlier expectation (a further drop by the amount) pinned the
         double count as if it were movement. */
      if (after.verdict !== before.verdict) {
        problems.push(`${generated.label}: Verdict painted ${after.verdict}, expected its own promise ${before.verdict} to hold on the press`);
      }
      if (after.wallet !== before.verdict) {
        problems.push(`${generated.label}: Wallet painted ${after.wallet}, expected the Verdict's promise ${before.verdict}`);
      }
      if (commitmentsAfter.count !== commitmentsBefore.count) {
        problems.push(`${generated.label}: derived commitment count changed from ${commitmentsBefore.count} to ${commitmentsAfter.count}`);
      }
      if (JSON.stringify(commitmentsAfter.installmentIds) !== JSON.stringify(commitmentsBefore.installmentIds)
        || JSON.stringify(commitmentsAfter.loanIds) !== JSON.stringify(commitmentsBefore.loanIds)) {
        problems.push(`${generated.label}: the purchase created or replaced an installment/loan entry`);
      }
      if (tree.getByTestId('check-verdict-context-chip').props.accessibilityLabel !== 'Your value') {
        problems.push(`${generated.label}: the logged purchase did not render with Your value provenance`);
      }

      act(() => {
        useActivityStore.setState({ purchases: [], verdicts: [] });
      });
      if (useActivityStore.getState().purchases.length !== 0) {
        problems.push(`${generated.label}: the in-memory re-read boundary was not established`);
      }
      act(() => {
        useActivityStore.getState().hydrateProfile(profileId);
      });
      const rehydrated = useActivityStore.getState().purchases;
      if (rehydrated.length !== 1
        || rehydrated[0]?.activityId !== written?.activityId
        || rehydrated[0]?.amountIls !== PURCHASE_AMOUNT_ILS
        || rehydrated[0]?.cardId !== cardId) {
        problems.push(`${generated.label}: the canonical record did not survive the real vault re-read: ${JSON.stringify(rehydrated)}`);
      }

      checked += 1;
      tree.unmount();
    }

    expect(checked).toBe(generatedPurchaseContexts().length);
    expect(problems).toEqual([]);
  });
});
