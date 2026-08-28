/**
 * THE AGREEMENT POPULATION — criterion A6, and the reason the group-A properties mean anything.
 *
 *   > **A6.** *"The population the agreement properties run over is derived from the navigation
 *   > declaration and the shipped packs, never hand-listed, and a check over zero surfaces fails."*
 *
 *   > **§2 rule 4.** *"Derive populations; never hand-list them."* P1 shipped four hand-maintained
 *   > "everything" lists and one of them hid a whole missing data family behind a green line.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY A HAND-WRITTEN PAIR OF SURFACES IS WORSE THAN NO PROPERTY AT ALL
 *
 * An agreement property over a listed pair proves that those two agree and says nothing about the
 * third. It also goes green on the day a fourth surface starts rendering the same number, because
 * nothing told it there was a fourth. The list is the part that rots, and it rots silently — which
 * is exactly the shape of every "everything" list this project has been burned by.
 *
 * So the surface set is built from `BOTTOM_NAVIGATION`, the declaration the navigator itself builds
 * from, and the card set from `currentCatalogProducts()`, the door P4's wizard already uses onto the
 * shipped catalog pack. Neither is restated here.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE SURFACE CANNOT COME FROM `ia.ts`, AND PRETENDING OTHERWISE WOULD BE THE DEFECT
 *
 * **Card DNA is not in `BOTTOM_NAVIGATION`, and correctly so.** It is contextual — route
 * `CardDetail` inside `WalletStack` — which is what assumption **A21** established when it turned
 * out to be wrong in two ways on first reading the repository. A tab list cannot yield it.
 *
 * It is therefore declared below, once, with its route named — and the gate
 * `tools/p5/gates/agreement-population.mjs` **reads `WalletStack.tsx` and refuses if that route is
 * not there.** The distinction that matters: this is not a hand-written list, it is one entry with
 * something comparing it to the declaration that owns it. A list nothing checks is the thing A6
 * forbids; a claim with a check against its source is how the other four are derived too.
 */
import { BOTTOM_NAVIGATION } from '../navigation/ia';
import { currentCatalogProducts } from '../data/adapter/catalogSearch';
import { CardIssuer, CardNetwork, type EngineCard } from '../types/card.types';
import { Currency } from '../types/purchase.types';
import type { ImportedInstallment } from '../types/installment.types';
import type { UserProfile } from '../types/user.types';
import type { SurfaceContext } from './surfaceContext';

/** The five surfaces contract §1 names. Ids are this module's, the membership is not. */
export type P5SurfaceId =
  | 'home'
  | 'wallet-cards'
  | 'card-dna'
  | 'plan-calendar'
  | 'plan-commitments';

export interface DerivedSurface {
  readonly id: P5SurfaceId;
  /** Where the fact that this surface exists came from. Never "a list in this file". */
  readonly derivedFrom: 'BOTTOM_NAVIGATION' | 'WalletStack route';
  /** The navigation key or route name it was derived from, so a checker can find it again. */
  readonly navKey: string;
  readonly why: string;
}

/** The one contextual surface, and the route the gate cross-checks it against. */
export const CARD_DNA_ROUTE = 'CardDetail' as const;
export const CARD_DNA_STACK = 'src/navigation/stacks/WalletStack.tsx' as const;

/**
 * The five P5 surfaces, four of them derived from the navigation declaration.
 *
 * A tab contributes itself when it has no segments (Home); a tab with segments contributes the
 * segments P5 owns. The Wallet **Benefits** segment is deliberately absent: spec §26 sends the
 * Benefits Hub to V1.x and contract §17 keeps it there, so it is not a P5 surface and its evidenced
 * empty state is a correct render rather than a placeholder P5 owes.
 */
export function derivedSurfaces(): readonly DerivedSurface[] {
  const P5_SEGMENTS: Readonly<Record<string, readonly string[]>> = {
    Wallet: ['Cards'],
    Plan: ['Calendar', 'Commitments'],
  };
  const out: DerivedSurface[] = [];
  for (const item of BOTTOM_NAVIGATION) {
    if (item.raised) continue; /* Check is a task, not a place, and it is P4's. */
    const segments = P5_SEGMENTS[item.key];
    if (segments === undefined) {
      if (item.key !== 'Home') continue; /* More is not a P5 content surface. */
      out.push({
        id: 'home',
        derivedFrom: 'BOTTOM_NAVIGATION',
        navKey: item.key,
        why: 'a tab with no segmented control; spec §7 gives it the hero, the load bar, the risk strip and billing',
      });
      continue;
    }
    for (const seg of item.segments ?? []) {
      if (!segments.includes(seg.key)) continue;
      out.push({
        id: (item.key === 'Wallet' ? 'wallet-cards' : seg.key === 'Calendar' ? 'plan-calendar' : 'plan-commitments'),
        derivedFrom: 'BOTTOM_NAVIGATION',
        navKey: item.key + '/' + seg.key,
        why: 'a segment of ' + item.key + '’s segmented control, declared in ia.ts and rendered by SegmentedTab',
      });
    }
  }
  out.push({
    id: 'card-dna',
    derivedFrom: 'WalletStack route',
    navKey: CARD_DNA_ROUTE,
    why: 'contextual rather than a tab — assumption A21. The gate reads ' + CARD_DNA_STACK + ' and refuses if the route is absent.',
  });
  return out;
}

/**
 * Card ids from the shipped catalog pack, through the door that already exists.
 *
 * `currentCatalogProducts()` is P4's W2 population — *"CURRENT is `lifecycleStatus === 'CURRENT'`,
 * which is the adapter's published `countsAsCurrentProduct` rule"* — and criterion B4 forbids
 * re-deriving it here. `count` bounds how many the properties instantiate; it does not bound what
 * the population IS, and `derivedCardCount()` reports the real size so a property can say what it
 * sampled from.
 */
export function derivedCardCount(): number {
  return currentCatalogProducts().length;
}

export function derivedCardIds(count = 3): readonly string[] {
  return currentCatalogProducts().slice(0, Math.max(0, count)).map((p) => p.cardId);
}

/** A vault card built on a real catalog id. Limits and cycles are the property's variables. */
function vaultCard(cardId: string, over: Partial<EngineCard> = {}): EngineCard {
  return {
    cardId,
    displayName: cardId,
    last4: '0000',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 20_000, currentBalance: 0 },
    billingCycle: { statementClosingDay: 2, billingDayOfMonth: 10 },
    roleTags: [],
    primaryRole: null,
    rewardCategories: [],
    cashbackRate: 0,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...over,
  };
}

const profile = (monthlyIncome: number, over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'profile:population',
  monthlyIncome,
  payday: { kind: 'day', day: 10 },
  currentBalance: 5_000,
  dangerThreshold: 1_000,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const installment = (
  installmentId: string,
  billingCardId: string,
  monthlyPayment: number,
  monthsRemaining = 6,
): ImportedInstallment => ({
  installmentId,
  merchantName: installmentId,
  totalAmount: monthlyPayment * monthsRemaining,
  monthsRemaining,
  monthlyPayment,
  billingCardId,
  source: 'imported',
});

/**
 * The window every context shares.
 *
 * FIXED, NOT READ FROM A CLOCK. `src/engines/risk.ts` takes the range as input and contains no
 * `Date.now()`; a population that read the clock would make a property that passes today fail on
 * the first of a month, and a flaky agreement property teaches a reader to ignore it.
 * September 2026 is chosen because it has 30 days and a 10th, so the billing-day and payday cases
 * are both inside it.
 */
export const POPULATION_AS_OF = '2026-09-01' as const;
export const POPULATION_THROUGH = '2026-09-30' as const;

export interface DerivedContext {
  /** What this context is FOR — printed by a failing property, so a red line names the case. */
  readonly label: string;
  readonly context: SurfaceContext;
}

/**
 * The contexts the agreement properties run over.
 *
 * THE BOUNDARIES ARE IN IT ON PURPOSE. `P5_VALIDATION_PLAN.md` §3.2: *"A2 and A3 must include the
 * boundaries. Generate contexts that land exactly on 35% and exactly on 50%, and exactly on a
 * billing date, because that is where two implementations of the same rule diverge and nowhere
 * else."* `>=` versus `>` at exactly 35% is the canonical defect, and a population of round numbers
 * would never meet it.
 */
export function derivedContexts(): readonly DerivedContext[] {
  const ids = derivedCardIds(3);
  if (ids.length === 0) return [];
  const [first] = ids as readonly [string, ...string[]];
  const base = {
    asOfDate: POPULATION_AS_OF,
    throughDate: POPULATION_THROUGH,
    loans: [],
    purchases: [],
  } as const;

  const at = (ratio: number, label: string, over: Partial<SurfaceContext> = {}): DerivedContext => ({
    label,
    context: {
      ...base,
      profile: profile(20_000),
      cards: ids.map((id) => vaultCard(id)),
      installments: [installment('inst:' + label, first, 20_000 * ratio)],
      ...over,
    },
  });

  return [
    at(0.25, 'exactly the warning threshold'),
    at(0.35, 'exactly the strong-warning threshold'),
    at(0.5, 'exactly the blocked threshold'),
    at(0.1, 'comfortably safe'),
    at(0.7, 'well past blocked'),
    {
      label: 'a settled hold the user marked Paid early',
      context: {
        ...at(0.35, 'paid-early base').context,
        paidEarlyCommitmentIds: ['inst:paid-early base'],
      },
    },
    {
      label: 'a card billing on the last day of the window',
      context: {
        ...base,
        profile: profile(20_000),
        cards: ids.map((id) => vaultCard(id, { billingCycle: { statementClosingDay: 25, billingDayOfMonth: 30 } })),
        installments: [installment('inst:last-day', first, 4_000)],
      },
    },
    {
      label: 'no income captured — the honest unknown, not a zero',
      context: {
        ...base,
        profile: null,
        cards: ids.map((id) => vaultCard(id)),
        installments: [],
      },
    },
    {
      label: 'no cards in the vault',
      context: { ...base, profile: profile(20_000), cards: [], installments: [] },
    },
  ];
}
