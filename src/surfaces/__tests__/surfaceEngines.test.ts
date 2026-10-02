/**
 * WP-1.1's own evidence: the seam calls the engines and does not compute.
 *
 * This is NOT an agreement property and must not be mistaken for one — no surface is rendered here
 * and nothing is compared across surfaces. It proves the four things the seam is for, so that the
 * group-A properties built on it in WP-1.4 are built on something that has been checked:
 *
 *   1. ONE result object per engine, returned unchanged — the surfaces read its fields.
 *   2. Risk is fed FROM the load result, so A2 and A3 cannot disagree about the obligation total.
 *   3. An engine that cannot honestly run returns `null` WITH A REASON — never a zero, never green.
 *   4. Paid early moves the available limit through the ENGINE, which is the mechanism A4 measures.
 */
/**
 * THE THREE ENGINES ARE WRAPPED, NOT REPLACED.
 *
 * Each mock delegates to the real implementation and records the input it was given. Nothing is
 * stubbed: every assertion below is against a real engine result. What the wrapper buys is the one
 * thing a value comparison cannot give — WHICH OBJECT the seam passed, and HOW MANY TIMES it
 * called. "Risk is fed from the load result" and "one call per engine" are claims about the calls,
 * and a test that checks two numbers are equal proves neither: two numbers are equal whenever two
 * computations happen to agree, which is the defect group A exists for.
 */
jest.mock('../../engines/risk', () => {
  const actual = jest.requireActual('../../engines/risk');
  return { ...actual, evaluateRiskPlanning: jest.fn(actual.evaluateRiskPlanning) };
});
jest.mock('../../engines/load', () => {
  const actual = jest.requireActual('../../engines/load');
  return { ...actual, evaluateFinancialLoad: jest.fn(actual.evaluateFinancialLoad) };
});
jest.mock('../../engines/scoring', () => {
  const actual = jest.requireActual('../../engines/scoring');
  return { ...actual, scoreCards: jest.fn(actual.scoreCards) };
});

import { evaluateRiskPlanning } from '../../engines/risk';
import { evaluateFinancialLoad } from '../../engines/load';
import { scoreCards } from '../../engines/scoring';

const riskSpy = evaluateRiskPlanning as unknown as jest.Mock;
const loadSpy = evaluateFinancialLoad as unknown as jest.Mock;
const scoringSpy = scoreCards as unknown as jest.Mock;

import { evaluateSurfaceEngines } from '../surfaceEngines';
import type { SurfaceContext } from '../surfaceContext';
import { CardIssuer, CardNetwork, type EngineCard } from '../../types/card.types';
import { Currency } from '../../types/purchase.types';
import type { UserProfile } from '../../types/user.types';
import type { ImportedInstallment } from '../../types/installment.types';

const card = (over: Partial<EngineCard> = {}): EngineCard => ({
  cardId: 'card:max:platinum',
  displayName: 'Max Platinum',
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 12_000, currentBalance: 800 },
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
});

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'profile:1',
  monthlyIncome: 20_000,
  payday: { kind: 'day', day: 10 },
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const installment = (over: Partial<ImportedInstallment> = {}): ImportedInstallment => ({
  installmentId: 'inst:1',
  merchantName: 'KSP',
  totalAmount: 6_000,
  monthsRemaining: 6,
  monthlyPayment: 1_000,
  billingCardId: 'card:max:platinum',
  source: 'imported',
  ...over,
});

const ctx = (over: Partial<SurfaceContext> = {}): SurfaceContext => ({
  asOfDate: '2026-09-01',
  throughDate: '2026-09-30',
  profile: profile(),
  cards: [card()],
  installments: [installment()],
  loans: [],
  purchases: [],
  ...over,
});

describe('the P5 engine-read seam', () => {
  beforeEach(() => {
    riskSpy.mockClear();
    loadSpy.mockClear();
    scoringSpy.mockClear();
  });

  it('returns each engine result object unchanged, with its own reason trace', () => {
    const r = evaluateSurfaceEngines(ctx());
    expect(r.load).not.toBeNull();
    expect(r.risk).not.toBeNull();
    expect(r.scoring).not.toBeNull();
    /* A reason trace is produced only by the engine. Its presence is how this test knows the seam
       returned the engine's object rather than a view assembled here. */
    expect(r.load?.trace).toBeDefined();
    expect(r.risk?.trace).toBeDefined();
    expect(r.scoring?.trace).toBeDefined();
    expect(r.absent).toEqual([]);
  });

  it('calls each engine exactly once for one context', () => {
    evaluateSurfaceEngines(ctx());
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(riskSpy).toHaveBeenCalledTimes(1);
    expect(scoringSpy).toHaveBeenCalledTimes(1);
  });

  it('feeds risk the load result OBJECT, so A2 and A3 cannot disagree about the total', () => {
    const r = evaluateSurfaceEngines(ctx());
    const riskInput = riskSpy.mock.calls[0][0];
    /* Reference identity, not value equality. Two equal numbers are also what two computations
       that happen to agree today produce, and tomorrow they do not. */
    expect(riskInput.currentMonthlyObligationsIls).toBe(r.load?.current.monthlyObligationsIls);
    expect(riskInput.safeLoadRatio).toBe(r.load?.thresholds.strongWarningRatio);
  });

  it('passes the user thresholds through to the engine rather than reading config a second time', () => {
    const thresholds = {
      warningRatio: { value: 0.2, provenance: 'USER' as const },
      strongWarningRatio: { value: 0.4, provenance: 'USER' as const },
      blockedRatio: { value: 0.6, provenance: 'USER' as const },
    };
    const r = evaluateSurfaceEngines(ctx({ thresholds }));
    expect(loadSpy.mock.calls[0][0].thresholds).toBe(thresholds);
    expect(r.load?.thresholds.strongWarningRatio.value).toBe(0.4);
    /* And the risk engine then reads the USER ratio, not the config one — one home, all the way down. */
    expect(riskSpy.mock.calls[0][0].safeLoadRatio.value).toBe(0.4);
  });

  it('returns no load result and a stated reason when income is unknown — never a zero ratio', () => {
    const r = evaluateSurfaceEngines(ctx({ profile: profile({ monthlyIncome: 0 }) }));
    expect(r.load).toBeNull();
    expect(r.absent.find((a) => a.engine === 'load')?.because).toBe('NO_INCOME');
    expect(r.absent.find((a) => a.engine === 'load')?.detail).toContain('denominator');
    /* And nothing downstream invented a day: risk says why it could not run, rather than saying safe. */
    expect(r.risk).toBeNull();
    expect(r.absent.find((a) => a.engine === 'risk')?.because).toBe('LOAD_UNAVAILABLE');
  });

  it('separates "no profile yet" from "a profile with no income"', () => {
    const r = evaluateSurfaceEngines(ctx({ profile: null }));
    expect(r.absent.find((a) => a.engine === 'load')?.because).toBe('NO_PROFILE');
  });

  it('returns no risk result and a stated reason when no card carries a usable billing day', () => {
    const r = evaluateSurfaceEngines(ctx({
      cards: [card({ billingCycle: { statementClosingDay: 0, billingDayOfMonth: 0 } })],
      installments: [],
    }));
    expect(r.load).not.toBeNull();
    expect(r.risk).toBeNull();
    expect(r.absent.find((a) => a.engine === 'risk')?.because).toBe('NO_BILLING_DATES');
  });

  it('returns no ranking and a stated reason when the vault holds no card', () => {
    const r = evaluateSurfaceEngines(ctx({ cards: [], installments: [] }));
    expect(r.scoring).toBeNull();
    expect(r.absent.find((a) => a.engine === 'scoring')?.because).toBe('NO_CARDS');
  });

  it('reports a card whose cost this context cannot price as unknown-cost, not as a zero-cost winner', () => {
    const r = evaluateSurfaceEngines(ctx());
    expect(r.scoring?.unknownCostCards).toEqual(['card:max:platinum']);
    expect(r.scoring?.ranked).toEqual([]);
  });

  it('ranks on the costs the context supplies, once it supplies them', () => {
    const r = evaluateSurfaceEngines(ctx({
      cards: [card(), card({ cardId: 'card:cal:gold', displayName: 'CAL Gold' })],
      scoringCosts: { 'card:max:platinum': 42, 'card:cal:gold': 17 },
    }));
    expect(r.scoring?.ranked.map((c) => c.cardId)).toEqual(['card:cal:gold', 'card:max:platinum']);
    expect(r.scoring?.unknownCostCards).toEqual([]);
  });

  it('lets the load engine release a held limit for Paid early — the mechanism A4 measures', () => {
    const before = evaluateSurfaceEngines(ctx());
    const after = evaluateSurfaceEngines(ctx({ paidEarlyCommitmentIds: ['inst:1'] }));
    const positionBefore = before.load?.cardLimits.find((p) => p.cardId === 'card:max:platinum');
    const positionAfter = after.load?.cardLimits.find((p) => p.cardId === 'card:max:platinum');
    expect(positionBefore).toBeDefined();
    expect(positionAfter).toBeDefined();
    expect(positionAfter?.releasedByEarlyPayoffIls.value).toBeGreaterThan(0);
    expect(positionAfter?.availableAfterChangesIls.value)
      .toBeGreaterThan(positionBefore?.availableAfterChangesIls.value as number);
    /* The seam did not do the releasing. The engine records it in paidEarlyCommitmentIds. */
    expect(after.load?.paidEarlyCommitmentIds).toEqual(['inst:1']);
  });

  it('carries the context it was evaluated from, so no property can compare two contexts', () => {
    const c = ctx();
    expect(evaluateSurfaceEngines(c).context).toBe(c);
  });

  it('does not link an installment to a card the vault does not hold', () => {
    const r = evaluateSurfaceEngines(ctx({ installments: [installment({ billingCardId: 'card:gone' })] }));
    /* The obligation still counts against income — it is money the user owes — but it holds no
       limit on a card that is not there, and the engine is not handed an input it would refuse. */
    expect(r.load?.current.monthlyObligationsIls.value).toBe(1_000);
    const position = r.load?.cardLimits.find((p) => p.cardId === 'card:max:platinum');
    expect(position?.activeInstallmentHoldsIls.value).toBe(0);
  });
});
