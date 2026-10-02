/**
 * A minimal vault card for the Check-lane suites.
 *
 * `CheckLoopInput.cards` widened from `{cardId, creditLimit}` to `EngineCard[]` under Owner ruling
 * OQ-P5-002, because the scoring engine needs `isActive` and `displayName`. Rather than let four
 * suites each grow their own literal — four homes for one shape — the builder lives here once.
 *
 * Not named `*.test.ts`, so no project collects it as a suite.
 */
import { CardIssuer, CardNetwork, type CardRole, type EngineCard } from '../../types/card.types';
import { Currency, type PurchaseCategory } from '../../types/purchase.types';

export const vaultCard = (over: Partial<EngineCard> & { readonly cardId: string }): EngineCard => ({
  displayName: 'Card ' + over.cardId,
  last4: '4321',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 0 },
  billingCycle: { statementClosingDay: 25, billingDayOfMonth: 10 },
  roleTags: [] as readonly CardRole[],
  primaryRole: null,
  rewardCategories: [] as readonly PurchaseCategory[],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
  ...over,
});
