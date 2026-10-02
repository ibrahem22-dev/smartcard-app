/**
 * THE CHECK VERDICT CARRIES A RECOMMENDATION — Owner ruling OQ-P5-002, 2026-08-29.
 *
 *   > *"Repair the missing Check Verdict recommendation now … The implementation belongs at the
 *   > canonical authority/engine composition boundary, not in the presentation surface. The Verdict
 *   > must receive the recommendation, runner-up and reason trace from the same canonical scoring
 *   > derivation used by the other product surfaces … Tests must be falsifiable and distinguish at
 *   > least: user-selected card; let-app-choose; a DON'T-BUY result; removal/bypass of scoring input
 *   > must make the relevant property fail."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CONTROL IS THE FIRST CASE, AGAIN
 *
 * The same reason as `commitmentInput.test.ts`: P2 shipped four checks that reported green while
 * being incapable of failing, and every one was written control-last. So the file opens by removing
 * the scoring input and asserting the recommendation DISAPPEARS — the shipped behaviour before this
 * ruling, executed rather than described.
 *
 * "Recommendation-shaped code exists" is what this must not settle for. Every case reads the
 * composed props a screen would receive, and the identity of the card named in them.
 */
import { evaluateSurfaceEngines } from '../../surfaces/surfaceEngines';
import type { SurfaceContext } from '../../surfaces/surfaceContext';
import { Currency } from '../../types/purchase.types';
import type { UserProfile } from '../../types/user.types';
import type { CheckInputDraft } from '../../screens/check/CheckInputScreen';
import { verdictPropsFromDraft, type CheckLoopInput } from '../checkLoop';
import { composeRecommendation } from '../recommendation';
import { scoreFromVault } from '../scoringInput';
import { vaultCard } from './cardFixture';

const TODAY = '2026-08-27';

/** Three cards, priced so the ranking is unambiguous: A cheapest, then B, then C. */
const CARDS = [
  vaultCard({ cardId: 'card-a', displayName: 'Alpha', framework: { creditLimit: 20_000, currentBalance: 0 } }),
  vaultCard({ cardId: 'card-b', displayName: 'Bravo', framework: { creditLimit: 20_000, currentBalance: 0 } }),
  vaultCard({ cardId: 'card-c', displayName: 'Charlie', framework: { creditLimit: 20_000, currentBalance: 0 } }),
];
const COSTS = { 'card-a': 10, 'card-b': 20, 'card-c': 30 } as const;

const profile: UserProfile = {
  id: 'user-1',
  monthlyIncome: 20_000,
  payday: { kind: 'day', day: 10 },
  createdAt: 1,
  updatedAt: 1,
};

const draft = (over: Partial<CheckInputDraft> = {}): CheckInputDraft => ({
  amount: 1_200,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
  ...over,
});

const input = (over: Partial<CheckLoopInput> = {}): CheckLoopInput => ({
  profile,
  cards: CARDS,
  purchases: [],
  todayIso: TODAY,
  installments: [],
  loans: [],
  commitmentReadiness: { installments: 'KNOWN_EMPTY', loans: 'KNOWN_EMPTY' },
  scoringCosts: COSTS,
  ...over,
});

const propsFor = (d: Partial<CheckInputDraft> = {}, i: Partial<CheckLoopInput> = {}) =>
  verdictPropsFromDraft(draft(d), input(i));

const named = (p: ReturnType<typeof propsFor>): string | undefined =>
  (p.recommendation as { cardId?: string } | undefined)?.cardId;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE CONTROL, FIRST.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('bypassing the scoring input removes the recommendation', () => {
  /**
   * If a future edit stops passing `scoringCosts`, stops passing engine cards, or reverts
   * `checkLoop` to the state OQ-P5-002 described, these two shapes become identical and THIS TEST
   * FAILS before any positive case runs.
   */
  it('no prices means no recommendation, and prices means one — the difference is the repair', () => {
    const priced = propsFor();
    const { scoringCosts: _dropped, ...withoutPrices } = input();
    const unpriced = verdictPropsFromDraft(draft(), withoutPrices);

    expect(priced.recommendation).toBeDefined();
    expect(priced.runnerUp).toBeDefined();
    expect(unpriced.recommendation).toBeUndefined();
    expect(unpriced.runnerUp).toBeUndefined();

    /* And the verdict itself is unaffected either way: scoring does not decide affordability. */
    expect(unpriced.result?.verdict).toBe(priced.result?.verdict);
  });

  it('an empty vault removes it too, and does not invent a placeholder card', () => {
    const noCards = verdictPropsFromDraft(draft(), { ...input(), cards: [] });
    expect(noCards.recommendation).toBeUndefined();
    expect(noCards.runnerUp).toBeUndefined();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE FOUR CASES THE RULING NAMES.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('let-app-choose — the המליצי בשבילי button', () => {
  it('leads somewhere: the Verdict names the engine best card and its runner-up', () => {
    const p = propsFor({ cardId: null });
    expect(named(p)).toBe('card-a');
    expect(p.recommendation?.displayName).toBe('Alpha');
    expect((p.runnerUp as { cardId?: string } | undefined)?.cardId).toBe('card-b');
  });

  it('and it is the SAME ranking the Wallet chips and Card DNA §C read', () => {
    const ctx: SurfaceContext = {
      asOfDate: TODAY,
      throughDate: '2026-09-27',
      profile,
      cards: CARDS,
      installments: [],
      loans: [],
      purchases: [],
      scoringCosts: COSTS,
    };
    const surfaces = evaluateSurfaceEngines(ctx).scoring;
    const p = propsFor({ cardId: null });
    expect(named(p)).toBe(surfaces?.ranked[0]?.cardId);
    expect((p.runnerUp as { cardId?: string } | undefined)?.cardId).toBe(surfaces?.ranked[1]?.cardId);
  });

  it('carries the engine own reason trace, not a sentence this lane wrote', () => {
    const p = propsFor({ cardId: null });
    const reasons = (p.recommendation as { reasons?: { steps: readonly unknown[] } } | undefined)?.reasons;
    const engine = scoreFromVault({ cards: CARDS, scoringCosts: COSTS });
    expect(reasons).toBeDefined();
    expect(reasons).toEqual(engine?.ranked[0]?.trace);
  });
});

describe('user-selected card', () => {
  it('still names the engine best card — the user pick is not an input to the ranking', () => {
    const chosen = propsFor({ cardId: 'card-c' });
    expect(named(chosen)).toBe('card-a');
  });

  /**
   * THE INVARIANT A1's NEGATIVE CONTROL PROTECTS. A ranking that moved with the user's selection
   * would be a second ranking path, and the Best-For chips would stop matching what Check
   * recommends for the same context — which is the criterion, in as many words.
   */
  it('and the recommendation is IDENTICAL whichever card the user picked', () => {
    const letApp = propsFor({ cardId: null });
    const pickedB = propsFor({ cardId: 'card-b' });
    const pickedC = propsFor({ cardId: 'card-c' });
    expect(named(pickedB)).toBe(named(letApp));
    expect(named(pickedC)).toBe(named(letApp));
    expect(pickedC.runnerUp).toEqual(letApp.runnerUp);
  });

  it('while the impact strip DOES follow the chosen card, which is a different question', () => {
    const a = propsFor({ cardId: 'card-a' }, { purchases: [] });
    const c = propsFor({ cardId: 'card-c' }, { purchases: [] });
    expect(a.impactStrip).toBeDefined();
    expect(c.impactStrip).toBeDefined();
    expect(a.logCardId).toBe('card-a');
    expect(c.logCardId).toBe('card-c');
  });
});

describe("a DON'T-BUY result", () => {
  /** Income 20,000 and a 12,000 monthly commitment: over the hard threshold whatever is bought. */
  const brokeInput = {
    profile: { ...profile, monthlyIncome: 10_000 },
  } as Partial<CheckLoopInput>;

  it('is a DONT-BUY, from the verdict engine and not from anything here', () => {
    const p = propsFor({ amount: 6_000 }, brokeInput);
    expect(p.result?.verdict).toBe('dont_buy_now');
  });

  it('does not let the card recommendation override the purchase decision', () => {
    const p = propsFor({ amount: 6_000 }, brokeInput);
    /* The recommendation may be shown — the ruling permits it — but only subordinately. */
    expect(p.recommendation).toBeDefined();
    expect((p.recommendation as { emphasis?: string }).emphasis).toBe('subordinate');
  });

  it('and a BUY keeps it primary, so the flag tracks the verdict rather than being constant', () => {
    const p = propsFor({ amount: 1_200 });
    expect(p.result?.verdict).toBe('good_to_go');
    expect((p.recommendation as { emphasis?: string }).emphasis).toBe('primary');
  });

  it('the emphasis is decided at the boundary, from the verdict, for every verdict state', () => {
    const scoring = scoreFromVault({ cards: CARDS, scoringCosts: COSTS });
    for (const verdict of ['good_to_go', 'caution', 'wait_until_billing_passes'] as const) {
      expect(composeRecommendation(scoring, CARDS, verdict).recommendation?.emphasis).toBe('primary');
    }
    expect(composeRecommendation(scoring, CARDS, 'dont_buy_now').recommendation?.emphasis)
      .toBe('subordinate');
  });
});

describe('the three owners stay separate', () => {
  it('scoring does not move the verdict: same purchase, different prices, same pill', () => {
    const cheap = propsFor({ amount: 1_200 }, { scoringCosts: { 'card-a': 1, 'card-b': 2, 'card-c': 3 } });
    const dear = propsFor({ amount: 1_200 }, { scoringCosts: { 'card-a': 900, 'card-b': 950, 'card-c': 999 } });
    expect(cheap.result?.verdict).toBe(dear.result?.verdict);
    expect(cheap.result?.financialImpact.thresholdMath.projectedLoadRatio.value)
      .toBe(dear.result?.financialImpact.thresholdMath.projectedLoadRatio.value);
  });

  it('the verdict does not move the ranking: a DONT-BUY still names the same best card', () => {
    const ok = propsFor({ amount: 1_200 });
    const no = propsFor({ amount: 6_000 }, { profile: { ...profile, monthlyIncome: 10_000 } });
    expect(no.result?.verdict).toBe('dont_buy_now');
    expect(named(no)).toBe(named(ok));
  });

  it('a card the engine could not price is never recommended', () => {
    /* Only card-c is priced, so it is the only rankable card and the other two are reported. */
    const p = propsFor({ cardId: null }, { scoringCosts: { 'card-c': 30 } });
    expect(named(p)).toBe('card-c');
    expect(p.runnerUp).toBeUndefined();
  });

  it('an inactive card is never recommended, however cheap', () => {
    const cards = [
      vaultCard({ cardId: 'card-a', displayName: 'Alpha', isActive: false }),
      vaultCard({ cardId: 'card-b', displayName: 'Bravo' }),
    ];
    const p = verdictPropsFromDraft(draft({ cardId: null }), { ...input(), cards });
    expect(named(p)).toBe('card-b');
  });
});
