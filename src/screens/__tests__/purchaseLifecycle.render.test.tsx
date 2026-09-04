/** C2 — real stores, real encrypted-vault reads, and the real surface engine path. */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { writeLoggedPurchase } from '../../check/activityMapper';
import { CheckStack } from '../../navigation/stacks/CheckStack';
import { keyVault } from '../../security/keyVault';
import {
  commitPurchaseLifecycle,
  deletePurchaseLifecycle,
  editPurchaseLifecycle,
  purchaseLifecycleProblems,
  type PurchaseLifecycleActions,
} from '../../services/purchaseLifecycle';
import { hydrated } from '../../store/hydration';
import { MMKV_KEYS } from '../../store/keys';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import type { ImportedInstallment } from '../../types/installment.types';
import { HomeHero } from '../home/HomeHero';
import { CommitmentsScreen } from '../plan/CommitmentsScreen';
import { WalletLimitBar } from '../wallet/WalletLimitBar';
import { derivedContexts, type DerivedContext } from '../../surfaces/__tests__/derivedPopulation';

const TOTAL = 1_200;
const PAYMENTS = 4;
const MONTHLY = TOTAL / PAYMENTS;
const AT = '2026-09-01T12:00:00.000Z';
const HYDRATED_AT = '2026-09-01T00:00:00.000Z';

let mockVerdictDraft = {
  amount: TOTAL,
  currency: 'ILS' as const,
  category: null,
  installments: PAYMENTS as number | null,
  cardId: null as string | null,
};

/** Native navigation is replaced only so the rendered production Verdict route is deterministic. */
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

interface Seeded {
  readonly generated: DerivedContext;
  readonly profileId: string;
  readonly cardId: string;
  readonly unrelatedCardId: string;
  readonly startingObligations: readonly ImportedInstallment[];
}

function generatedContext(): DerivedContext {
  const generated = derivedContexts().find(({ label, context }) => (
    label === 'comfortably safe' && context.profile !== null && context.cards.length >= 2
  ));
  if (generated === undefined) throw new Error('no two-card generated C2 context');
  return generated;
}

function seed(installments: number | null = PAYMENTS): Seeded {
  const generated = generatedContext();
  const { context } = generated;
  const profile = context.profile;
  const cardId = context.cards[0]?.cardId;
  const unrelatedCardId = context.cards[1]?.cardId;
  if (profile === null || cardId === undefined || unrelatedCardId === undefined) {
    throw new Error('generated C2 context lost its profile or two cards');
  }
  const hydration = hydrated(HYDRATED_AT);
  const storage = keyVault.getEncryptedStorage();
  storage.set(MMKV_KEYS.activeProfileId, profile.id);
  useCardsStore.getState().importProfileCards(profile.id, context.cards);
  useCardsStore.getState().hydrateProfile(profile.id);
  act(() => {
    useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
    useUserStore.setState({ profile, hydration });
    useCardsStore.setState({ obligations: [...context.installments], hydration });
    useLoansStore.setState({ loans: [...context.loans], hydration });
    useActivityStore.setState({ purchases: [], verdicts: [], hydration });
  });
  useCardsStore.getState().persistProfile(profile.id);
  useLoansStore.getState().persistProfile(profile.id);
  useActivityStore.getState().persistProfile(profile.id);
  mockVerdictDraft = { ...mockVerdictDraft, installments, cardId };
  return {
    generated,
    profileId: profile.id,
    cardId,
    unrelatedCardId,
    startingObligations: [...context.installments],
  };
}

function actions(): PurchaseLifecycleActions {
  const activity = useActivityStore.getState();
  const cards = useCardsStore.getState();
  return {
    getPurchases: () => useActivityStore.getState().purchases,
    getVerdicts: () => useActivityStore.getState().verdicts,
    getObligations: () => useCardsStore.getState().obligations,
    logPurchase: activity.logPurchase,
    updatePurchase: activity.updatePurchase,
    deletePurchase: activity.deletePurchase,
    replaceActivity: activity.replaceActivity,
    recordVerdict: activity.recordVerdict,
    addObligation: cards.addObligation,
    updateObligation: cards.updateObligation,
    deleteObligation: cards.deleteObligation,
    replaceObligations: cards.replaceObligations,
  };
}

function commitDirect(
  lifecycleActions: PurchaseLifecycleActions = actions(),
  activityId = 'activity:c2-fixed',
) {
  const cardId = mockVerdictDraft.cardId;
  return commitPurchaseLifecycle({
    activityId,
    at: AT,
    totalAmountIls: TOTAL,
    installmentCount: PAYMENTS,
    merchantName: 'C2 purchase',
    ...(cardId === null ? {} : { cardId }),
    verdict: 'good_to_go',
    actions: lifecycleActions,
  });
}

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

function mountLifecycle(cardId: string, unrelatedCardId: string) {
  return render(wrap(
    <>
      <HomeHero />
      <WalletLimitBar cardId={cardId} />
      <WalletLimitBar cardId={unrelatedCardId} />
      <CommitmentsScreen />
      <CheckStack />
    </>,
  ));
}

function paintedNumber(tree: ReturnType<typeof render>, testID: string): number {
  const value = Number(tree.getByTestId(testID).props.accessibilityValue?.text);
  if (!Number.isFinite(value)) throw new Error(`${testID} did not paint a finite number`);
  return value;
}

function painted(tree: ReturnType<typeof render>) {
  const wallet = tree.getAllByTestId('wallet-limit-bar-available').map(
    (node) => Number(node.props.accessibilityValue?.text),
  );
  if (wallet.length !== 2 || wallet.some((value) => !Number.isFinite(value))) {
    throw new Error(`expected two finite Wallet figures, received ${JSON.stringify(wallet)}`);
  }
  return {
    home: paintedNumber(tree, 'home-hero-amount'),
    wallet: wallet[0] as number,
    unrelatedWallet: wallet[1] as number,
    plan: paintedNumber(tree, 'commitments-summary-total'),
    verdict: paintedNumber(tree, 'check-verdict-impact-strip'),
  };
}

function expectOneValidPair(startingCount: number) {
  const purchases = useActivityStore.getState().purchases;
  const obligations = useCardsStore.getState().obligations;
  expect(purchases).toHaveLength(1);
  expect(obligations).toHaveLength(startingCount + 1);
  const purchase = purchases[0];
  const obligation = obligations.find((row) => row.source === 'purchase');
  expect(purchase?.linkedInstallmentId).toBe(obligation?.installmentId);
  expect(obligation?.loggedPurchaseActivityId).toBe(purchase?.activityId);
  expect(purchaseLifecycleProblems(purchases, obligations)).toEqual([]);
  return { purchase, obligation };
}

describe('C2 — purchase lifecycle', () => {
  it('creates exactly one purchase and one explicitly bidirectionally linked commitment', () => {
    const seeded = seed();
    const result = commitDirect();
    expect(result.ok).toBe(true);
    const { purchase, obligation } = expectOneValidPair(seeded.startingObligations.length);
    expect(purchase?.amountIls).toBe(MONTHLY);
    expect(obligation).toMatchObject({
      totalAmount: TOTAL,
      monthlyPayment: MONTHLY,
      monthsRemaining: PAYMENTS - 1,
      billingCardId: seeded.cardId,
      source: 'purchase',
    });
    useActivityStore.setState({ purchases: [], verdicts: [] });
    useCardsStore.setState({ obligations: [] });
    useActivityStore.getState().hydrateProfile(seeded.profileId);
    useCardsStore.getState().hydrateProfile(seeded.profileId);
    expectOneValidPair(seeded.startingObligations.length);
  });

  it('keeps exposure at T once and makes Wallet equal the Verdict promise', () => {
    const { cardId, unrelatedCardId } = seed();
    const tree = mountLifecycle(cardId, unrelatedCardId);
    const before = painted(tree);
    act(() => fireEvent.press(tree.getByTestId('check-verdict-log-purchase')));
    const after = painted(tree);
    const { purchase, obligation } = expectOneValidPair(generatedContext().context.installments.length);
    const held = (obligation?.monthlyPayment ?? 0) * (obligation?.monthsRemaining ?? 0);
    expect((purchase?.amountIls ?? 0) + held).toBe(TOTAL);
    expect(after.wallet).toBe(before.wallet - TOTAL);
    expect(after.wallet).toBe(before.verdict);
    expect(after.verdict).toBe(before.verdict);
    tree.unmount();
  });

  it('moves Home by M, Plan by M, and attributed limit exposure by T from one commit', () => {
    const { cardId, unrelatedCardId } = seed();
    const tree = mountLifecycle(cardId, unrelatedCardId);
    const before = painted(tree);
    act(() => fireEvent.press(tree.getByTestId('check-verdict-log-purchase')));
    const after = painted(tree);
    expect(after.home).toBe(before.home - MONTHLY);
    expect(after.plan).toBe(before.plan + MONTHLY);
    expect(after.wallet).toBe(before.wallet - TOTAL);
    expect(after.verdict).toBe(before.verdict);
    const obligation = useCardsStore.getState().obligations.find((row) => row.source === 'purchase');
    expect(tree.queryAllByTestId(`commitment-row-${obligation?.installmentId ?? 'missing'}`)).toHaveLength(1);
    expect(tree.getByTestId(`commitment-row-${obligation?.installmentId ?? 'missing'}-provenance`).props.accessibilityLabel).toBe('Your value');
    tree.unmount();
  });

  it('does not move an unrelated card limit', () => {
    const { cardId, unrelatedCardId } = seed();
    const tree = mountLifecycle(cardId, unrelatedCardId);
    const before = painted(tree);
    act(() => fireEvent.press(tree.getByTestId('check-verdict-log-purchase')));
    expect(painted(tree).unrelatedWallet).toBe(before.unrelatedWallet);
    tree.unmount();
  });

  it('keeps a plain purchase free of any linked commitment', () => {
    const seeded = seed(null);
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    const beforeCount = useCardsStore.getState().obligations.length;
    act(() => fireEvent.press(tree.getByTestId('check-verdict-log-purchase')));
    expect(useActivityStore.getState().purchases).toHaveLength(1);
    expect(useActivityStore.getState().purchases[0]?.amountIls).toBe(TOTAL);
    expect(useActivityStore.getState().purchases[0]?.linkedInstallmentId).toBeUndefined();
    expect(useCardsStore.getState().obligations).toHaveLength(beforeCount);
    tree.unmount();
  });

  it('keeps the plain-lane strip at the verdict promise after commit, no double count', () => {
    // OQ-MDC-012 option 2 (PD-MDC-071): a plain purchase, like an installment pair, moves from
    // prospect to fact on the press. The strip therefore does not move, Wallet catches up to the
    // promise, and the persisted purchase is counted once.
    const seeded = seed(null);
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    const before = painted(tree);
    act(() => fireEvent.press(tree.getByTestId('check-verdict-log-purchase')));
    const after = painted(tree);
    expect(useActivityStore.getState().purchases).toHaveLength(1);
    expect(after.wallet).toBe(before.wallet - TOTAL);
    expect(after.wallet).toBe(before.verdict);
    expect(after.verdict).toBe(before.verdict);
    tree.unmount();
  });

  it('treats a double press as one idempotent lifecycle despite same-millisecond timing', () => {
    const seeded = seed();
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    const button = tree.getByTestId('check-verdict-log-purchase');
    act(() => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expectOneValidPair(seeded.startingObligations.length);
    expect(useActivityStore.getState().verdicts).toHaveLength(1);
    tree.unmount();
  });

  it('does not duplicate on re-render, retry, or genuine hydrate reload', () => {
    const seeded = seed();
    const first = commitDirect();
    expect(first).toMatchObject({ ok: true, status: 'CREATED' });
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    tree.rerender(wrap(
      <>
        <HomeHero />
        <WalletLimitBar cardId={seeded.cardId} />
        <WalletLimitBar cardId={seeded.unrelatedCardId} />
        <CommitmentsScreen />
        <CheckStack />
      </>,
    ));
    act(() => {
      useActivityStore.setState({ purchases: [], verdicts: [] });
      useCardsStore.setState({ obligations: [] });
      useActivityStore.getState().hydrateProfile(seeded.profileId);
      useCardsStore.getState().hydrateProfile(seeded.profileId);
    });
    expect(commitDirect()).toMatchObject({ ok: true, status: 'ALREADY_COMMITTED' });
    expectOneValidPair(seeded.startingObligations.length);
    tree.unmount();
  });

  it('rolls back the purchase when the real commitment action seam throws', () => {
    seed();
    const real = actions();
    const result = commitDirect({
      ...real,
      addObligation: () => { throw new Error('injected addObligation failure'); },
    });
    expect(result).toMatchObject({ ok: false, reason: 'COMMITMENT_WRITE_FAILED_ROLLED_BACK' });
    expect(useActivityStore.getState().purchases).toEqual([]);
    expect(useActivityStore.getState().verdicts).toEqual([]);
    expect(useCardsStore.getState().obligations).toEqual(generatedContext().context.installments);
  });

  it('leaves no commitment when the real purchase action seam throws', () => {
    seed();
    const real = actions();
    const result = commitDirect({
      ...real,
      logPurchase: () => { throw new Error('injected logPurchase failure'); },
    });
    expect(result).toMatchObject({ ok: false, reason: 'PURCHASE_WRITE_FAILED_ROLLED_BACK' });
    expect(useActivityStore.getState().purchases).toEqual([]);
    expect(useActivityStore.getState().verdicts).toEqual([]);
    expect(useCardsStore.getState().obligations).toEqual(generatedContext().context.installments);
  });

  it('reports rollback failure distinctly and exposes the exact surviving partial state', () => {
    seed();
    const real = actions();
    const result = commitDirect({
      ...real,
      addObligation: (obligation) => {
        real.addObligation(obligation);
        throw new Error('injected post-write commitment failure');
      },
      replaceObligations: () => { throw new Error('injected obligation rollback failure'); },
    });
    expect(result).toMatchObject({ ok: false, reason: 'COMMITMENT_WRITE_FAILED_ROLLBACK_FAILED' });
    expect(useActivityStore.getState().purchases).toEqual([]);
    expect(useActivityStore.getState().verdicts).toEqual([]);
    const orphan = useCardsStore.getState().obligations.find((row) => row.source === 'purchase');
    expect(orphan?.loggedPurchaseActivityId).toBe('activity:c2-fixed');
    expect(purchaseLifecycleProblems([], useCardsStore.getState().obligations)[0]).toContain('orphaned commitment');
  });

  it('session undo reverses the pair and returns all four surfaces to pre-commit values', () => {
    const seeded = seed();
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    const before = painted(tree);
    act(() => fireEvent.press(tree.getByTestId('check-verdict-log-purchase')));
    act(() => fireEvent.press(tree.getByTestId('check-verdict-undo-purchase')));
    expect(painted(tree)).toEqual(before);
    expect(useActivityStore.getState().purchases).toEqual([]);
    expect(useCardsStore.getState().obligations).toEqual(seeded.startingObligations);
    tree.unmount();
  });

  it('does not offer undo after restart while the pair survives a genuine vault re-read', () => {
    const seeded = seed();
    const firstTree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    act(() => fireEvent.press(firstTree.getByTestId('check-verdict-log-purchase')));
    firstTree.unmount();
    useActivityStore.setState({ purchases: [], verdicts: [] });
    useCardsStore.setState({ obligations: [] });
    useActivityStore.getState().hydrateProfile(seeded.profileId);
    useCardsStore.getState().hydrateProfile(seeded.profileId);
    const restarted = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    expect(restarted.queryByTestId('check-verdict-undo-purchase')).toBeNull();
    expectOneValidPair(seeded.startingObligations.length);
    restarted.unmount();
  });

  it('edits shared Plan fields together and surfaces follow the edited monthly amount', () => {
    const seeded = seed();
    expect(commitDirect().ok).toBe(true);
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    const before = painted(tree);
    const obligation = useCardsStore.getState().obligations.find((row) => row.source === 'purchase');
    const id = obligation?.installmentId ?? 'missing';
    act(() => fireEvent.press(tree.getByTestId(`commitment-row-${id}-chevron`)));
    fireEvent.changeText(tree.getByTestId(`commitment-detail-${id}-total-input`), '2000');
    fireEvent.changeText(tree.getByTestId(`commitment-detail-${id}-remaining-input`), '3');
    act(() => fireEvent.press(tree.getByTestId(`commitment-detail-${id}-save`)));
    const editedPurchase = useActivityStore.getState().purchases[0];
    const editedObligation = useCardsStore.getState().obligations.find((row) => row.installmentId === id);
    expect(editedPurchase?.amountIls).toBe(500);
    expect(editedObligation).toMatchObject({ totalAmount: 2_000, monthlyPayment: 500, monthsRemaining: 3 });
    expect(painted(tree).home).toBe(before.home - 200);
    expect(painted(tree).plan).toBe(before.plan + 200);
    expect(painted(tree).wallet).toBe(before.wallet - 800);
    tree.unmount();
  });

  it('deletes both records from Plan and leaves no orphan in either direction', () => {
    const seeded = seed();
    expect(commitDirect().ok).toBe(true);
    const tree = mountLifecycle(seeded.cardId, seeded.unrelatedCardId);
    const obligation = useCardsStore.getState().obligations.find((row) => row.source === 'purchase');
    const id = obligation?.installmentId ?? 'missing';
    act(() => fireEvent.press(tree.getByTestId(`commitment-row-${id}-chevron`)));
    act(() => fireEvent.press(tree.getByTestId(`commitment-detail-${id}-delete`)));
    const deletionFailure = tree.queryByTestId(`commitment-detail-${id}-failure`);
    if (deletionFailure !== null) {
      throw new Error(String(deletionFailure.props.children));
    }
    expect(useActivityStore.getState().purchases).toEqual([]);
    expect(useCardsStore.getState().obligations).toEqual(seeded.startingObligations);
    expect(purchaseLifecycleProblems(
      useActivityStore.getState().purchases,
      useCardsStore.getState().obligations,
    )).toEqual([]);
    tree.unmount();
  });

  it('editing and deleting one lifecycle never mutates unrelated purchases or commitments', () => {
    seed();
    const unrelatedPurchase = writeLoggedPurchase({
      activityId: 'activity:unrelated',
      amountIls: 75,
      at: AT,
      cardId: mockVerdictDraft.cardId,
    });
    useActivityStore.getState().logPurchase(unrelatedPurchase);
    const unrelatedObligation = useCardsStore.getState().obligations[0];
    expect(commitDirect().ok).toBe(true);
    expect(editPurchaseLifecycle({
      activityId: 'activity:c2-fixed',
      totalAmountIls: 2_000,
      monthsRemaining: 3,
      actions: actions(),
    }).ok).toBe(true);
    expect(useActivityStore.getState().purchases.find((row) => row.activityId === 'activity:unrelated')).toEqual(unrelatedPurchase);
    expect(useCardsStore.getState().obligations[0]).toEqual(unrelatedObligation);
    expect(deletePurchaseLifecycle('activity:c2-fixed', actions()).ok).toBe(true);
    expect(useActivityStore.getState().purchases).toEqual([unrelatedPurchase]);
    expect(useCardsStore.getState().obligations[0]).toEqual(unrelatedObligation);
  });
});
