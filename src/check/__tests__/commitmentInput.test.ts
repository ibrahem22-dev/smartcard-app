/**
 * THE CHECK VERDICT READS THE USER'S EXISTING COMMITMENTS — Owner ruling OQ-P5-001, 2026-08-29.
 *
 *   > *"Implement the ruling at the canonical authority/engine boundary, not in a presentation
 *   > surface … preserve one canonical source of financial truth … Your tests must distinguish at
 *   > minimum: A. known zero commitments; B. known non-zero commitments; C. unknown/unavailable
 *   > commitment state; D. a purchase whose result changes because commitments exist. The test must
 *   > be falsifiable: prove that removing or bypassing commitment input changes/fails the expected
 *   > result rather than merely checking that commitment-shaped code exists."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE NEGATIVE CONTROL IS THE FIRST CASE IN THIS FILE AND NOT THE LAST
 *
 * P2 shipped four checks that reported green while being incapable of failing, and every one of
 * them was written control-last: the assertion first, the proof that it could fail bolted on
 * afterwards, if at all. So `describe('D — …')` opens by EXECUTING the defect — the empty
 * commitment list the shipped app used to pass unconditionally — and asserting that the verdict it
 * produces is the wrong one. Everything after it is a claim about code whose failure mode has
 * already been demonstrated in the same run.
 *
 * "Commitment-shaped code exists" is what this file must not settle for. `expect(commitments)
 * .toHaveLength(2)` would pass against a loop that assembled the list and then threw it away.
 * Every case below reads a VERDICT or a RATIO — the thing the user is shown.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE NUMBERS ARE THE OWNER QUESTION'S OWN
 *
 * `OQ-P5-001` measured one vault: a single ₪7,000-a-month installment with 6 months remaining on a
 * ₪20,000 limit. The Verdict reported `currentMonthlyCommitmentsIls: 0`, a projected load ratio of
 * 0.06 after a ₪1,200 purchase, and an impact strip of ₪18,800, while the load engine reported
 * ₪42,000 of active holds and an available limit of MINUS ₪22,000 for the same vault. Those are the
 * figures below, so the case that produced the ruling is the case the repair is measured on.
 */
import { evaluateFinancialLoad } from '../../engines/load';
import { evaluateSurfaceEngines } from '../../surfaces/surfaceEngines';
import type { SurfaceContext } from '../../surfaces/surfaceContext';
import {
  CardIssuer,
  CardNetwork,
  type CardRole,
  type EngineCard,
} from '../../types/card.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import type { ImportedInstallment } from '../../types/installment.types';
import type { Loan } from '../../types/loan.types';
import type { UserProfile } from '../../types/user.types';
import type { CheckInputDraft } from '../../screens/check/CheckInputScreen';
import { verdictPropsFromDraft, type CheckLoopInput } from '../checkLoop';
import {
  commitmentState,
  commitmentsFromVault,
  stillOwed,
  type CommitmentReadiness,
} from '../commitmentInput';
import { purchaseContextFromProfile } from '../incomeAnchor';

const TODAY = '2026-08-27';
const CARD_ID = 'card-max';
const LIMIT = 20_000;
const INCOME = 20_000;
const PURCHASE = 1_200;

const draft: CheckInputDraft = {
  amount: PURCHASE,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: CARD_ID,
};

const profile: UserProfile = {
  id: 'user-1',
  monthlyIncome: INCOME,
  payday: { kind: 'day', day: 10 },
  createdAt: 1,
  updatedAt: 1,
};

const cards = [{ cardId: CARD_ID, creditLimit: LIMIT }] as const;

/** The ₪7,000-a-month, 6-months-remaining installment the Owner question measured. */
const installment: ImportedInstallment = {
  installmentId: 'inst:sofa',
  merchantName: 'Sofa',
  totalAmount: 84_000,
  monthsRemaining: 6,
  monthlyPayment: 7_000,
  billingCardId: CARD_ID,
  source: 'imported',
};

/** A loan holds no card limit unless it names a card, so it exercises the other arm of the mapper. */
const loan: Loan = {
  id: 'loan:car',
  loanType: 'personal',
  lenderName: 'Bank',
  originalAmount: 60_000,
  remainingBalance: 30_000,
  monthlyPayment: 1_500,
  annualInterestRate: 6,
  startDate: '2025-01-01',
  totalMonths: 48,
  monthsPaid: 12,
};

const KNOWN: CommitmentReadiness = { installments: 'KNOWN_POPULATED', loans: 'KNOWN_POPULATED' };
const KNOWN_EMPTY: CommitmentReadiness = { installments: 'KNOWN_EMPTY', loans: 'KNOWN_EMPTY' };

const input = (over: Partial<CheckLoopInput> = {}): CheckLoopInput => ({
  profile,
  cards,
  purchases: [],
  todayIso: TODAY,
  installments: [],
  loans: [],
  commitmentReadiness: KNOWN_EMPTY,
  ...over,
});

const verdictFor = (over: Partial<CheckLoopInput> = {}) => verdictPropsFromDraft(draft, input(over));

const ratioOf = (props: ReturnType<typeof verdictFor>): number | null =>
  props.result?.financialImpact.thresholdMath.projectedLoadRatio.value ?? null;

const commitmentsOf = (props: ReturnType<typeof verdictFor>): number | null =>
  props.result?.financialImpact.thresholdMath.currentMonthlyCommitmentsIls.value ?? null;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   D — AND ITS NEGATIVE CONTROL, FIRST.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('D — a purchase whose result changes because commitments exist', () => {
  /**
   * THE CONTROL. This is the shipped behaviour before the ruling, executed rather than described.
   *
   * If a future edit reverts the wiring — deletes the `installments` input, restores
   * `commitments: []`, defaults the readiness to trusted — the two verdicts below become equal and
   * THIS TEST FAILS, before any of the positive cases get a chance to. That is the difference
   * between a test that proves the input is read and a test that proves commitment-shaped code
   * exists somewhere in the file.
   */
  it('the bypassed input produces the WRONG answer, which is what makes the rest falsifiable', () => {
    const bypassed = verdictFor({ installments: [], loans: [], commitmentReadiness: KNOWN_EMPTY });
    const real = verdictFor({ installments: [installment], loans: [], commitmentReadiness: KNOWN });

    /* Spec §9 names this exact shape as the canonical defect: "Good to go" at 41% of income
       against a 35% threshold. Both halves are asserted, so neither can drift alone. */
    expect(bypassed.result?.verdict).toBe('good_to_go');
    expect(real.result?.verdict).not.toBe('good_to_go');

    expect(commitmentsOf(bypassed)).toBe(0);
    expect(commitmentsOf(real)).toBe(installment.monthlyPayment);

    const bypassedRatio = ratioOf(bypassed);
    const realRatio = ratioOf(real);
    if (bypassedRatio === null || realRatio === null) throw new Error('both vaults must produce a verdict');
    expect(realRatio).toBeGreaterThan(bypassedRatio);
  });

  it('the pill crosses a threshold it could not reach with an invented empty list', () => {
    const real = verdictFor({ installments: [installment], loans: [], commitmentReadiness: KNOWN });
    const math = real.result?.financialImpact.thresholdMath;
    if (math === undefined) throw new Error('a known vault must produce a verdict');

    /* Derived from the engine's own published thresholds, never from a literal 0.35 here. */
    expect(math.projectedLoadRatio.value).toBeGreaterThan(math.safeRatio.value);
    expect(math.projectedLoadRatio.value).toBeLessThanOrEqual(math.hardRatio.value);
    expect(real.result?.verdict).toBe('caution');
  });

  it('and the impact strip moves with it, because the holds reached the load engine too', () => {
    const bypassed = verdictFor({ installments: [], loans: [], commitmentReadiness: KNOWN_EMPTY });
    const real = verdictFor({ installments: [installment], loans: [], commitmentReadiness: KNOWN });

    /* 20,000 − 1,200 with no holds; 20,000 − 42,000 − 1,200 with the installment's remaining hold.
       The second is negative, which is the honest answer for a card already over its limit — the
       load engine says so and the strip repeats it rather than clamping at zero. */
    expect(bypassed.impactStrip?.availableAfterPurchaseIls.value).toBe(LIMIT - PURCHASE);
    expect(real.impactStrip?.availableAfterPurchaseIls.value).toBe(
      LIMIT - installment.monthlyPayment * installment.monthsRemaining - PURCHASE,
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   A, B, C — the three states an empty list used to stand for.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('A — known zero commitments', () => {
  it('produces a real verdict, and a commitments total that is a measured zero', () => {
    const props = verdictFor({ commitmentReadiness: KNOWN_EMPTY });
    expect(props.result).toBeDefined();
    expect(commitmentsOf(props)).toBe(0);
    expect(props.result?.verdict).toBe('good_to_go');
  });

  it('is a DIFFERENT state from unknown, and the boundary says which', () => {
    const known = commitmentState({ cards, installments: [], loans: [] }, KNOWN_EMPTY);
    expect(known).toEqual({ known: true, commitments: [] });
  });
});

describe('B — known non-zero commitments', () => {
  it('every vault obligation reaches the verdict engine, installments and loans alike', () => {
    const props = verdictFor({
      installments: [installment],
      loans: [loan],
      commitmentReadiness: KNOWN,
    });
    expect(commitmentsOf(props)).toBe(installment.monthlyPayment + loan.monthlyPayment);
  });

  it('an unlinked loan adds a monthly obligation and holds no card limit', () => {
    const withLoanOnly = verdictFor({ loans: [loan], commitmentReadiness: KNOWN });
    expect(commitmentsOf(withLoanOnly)).toBe(loan.monthlyPayment);
    /* No linkedCardId, so nothing is held: the strip is the plain limit minus the purchase. */
    expect(withLoanOnly.impactStrip?.availableAfterPurchaseIls.value).toBe(LIMIT - PURCHASE);
  });

  it('ONE CANONICAL SOURCE: the Verdict and the five P5 surfaces read the same commitments', () => {
    const context: SurfaceContext = {
      asOfDate: TODAY,
      throughDate: '2026-09-27',
      profile,
      cards: [engineCard()],
      installments: [installment],
      loans: [loan],
      purchases: [],
    };
    const surfaces = evaluateSurfaceEngines(context);
    const verdict = verdictFor({
      installments: [installment],
      loans: [loan],
      commitmentReadiness: KNOWN,
    });

    /* The P5 seam's load result and P4's Verdict, over one vault, in one run. Before the ruling
       these were 8,500 and 0 — the disagreement A2 recorded and OQ-P5-001 raised. */
    expect(surfaces.load?.current.monthlyObligationsIls.value)
      .toBe(commitmentsOf(verdict));
  });

  it('and the mapper is literally the same function, not a second one that agrees today', () => {
    const source = { cards, installments: [installment], loans: [loan] };
    const state = commitmentState(source, KNOWN);
    if (!state.known) throw new Error('KNOWN readiness must produce commitments');
    expect(state.commitments).toEqual(commitmentsFromVault(source));

    /* And the load engine accepts it unchanged — the holds are real, not decorative. */
    const load = evaluateFinancialLoad({
      monthlyIncomeIls: { value: INCOME, provenance: 'USER' },
      commitments: state.commitments,
      cards: [{
        cardId: CARD_ID,
        creditLimitIls: { value: LIMIT, provenance: 'USER' },
        loggedThisCyclePurchasesIls: { value: 0, provenance: 'USER' },
      }],
    });
    expect(load.cardLimits[0]?.activeInstallmentHoldsIls.value)
      .toBe(installment.monthlyPayment * installment.monthsRemaining);
  });
});

describe('C — unknown or unavailable commitment state', () => {
  it.each([
    ['PENDING', { installments: 'PENDING', loans: 'KNOWN_EMPTY' }, 'COMMITMENTS_PENDING'],
    ['PENDING on loans', { installments: 'KNOWN_EMPTY', loans: 'PENDING' }, 'COMMITMENTS_PENDING'],
    ['UNAVAILABLE', { installments: 'UNAVAILABLE', loans: 'KNOWN_EMPTY' }, 'COMMITMENTS_UNAVAILABLE'],
    ['UNAVAILABLE on loans', { installments: 'KNOWN_EMPTY', loans: 'UNAVAILABLE' }, 'COMMITMENTS_UNAVAILABLE'],
  ] as const)('%s: the boundary refuses and names the reason', (_label, readiness, because) => {
    const state = commitmentState({ cards, installments: [], loans: [] }, readiness);
    expect(state.known).toBe(false);
    if (state.known) throw new Error('unreachable');
    expect(state.because).toBe(because);
    expect(state.detail.length).toBeGreaterThan(0);
  });

  it('a failure outranks a pending read, because it is the more specific fact', () => {
    const state = commitmentState(
      { cards, installments: [], loans: [] },
      { installments: 'PENDING', loans: 'UNAVAILABLE' },
    );
    expect(state.known).toBe(false);
    if (state.known) throw new Error('unreachable');
    expect(state.because).toBe('COMMITMENTS_UNAVAILABLE');
  });

  it('NO VERDICT IS PRODUCED, and an empty list is never substituted for one', () => {
    const pending = verdictFor({
      installments: [installment],
      commitmentReadiness: { installments: 'PENDING', loans: 'KNOWN_EMPTY' },
    });
    expect(pending.result).toBeUndefined();
    expect(pending.impactStrip).toBeUndefined();
    /* The context line is still painted: what the user typed is known even when the vault is not. */
    expect(pending.contextLine?.amount).toBe(PURCHASE);
  });

  it('and it is NOT the good_to_go an empty list would have produced', () => {
    const pending = verdictFor({ commitmentReadiness: { installments: 'PENDING', loans: 'PENDING' } });
    const knownEmpty = verdictFor({ commitmentReadiness: KNOWN_EMPTY });

    /* The two vaults hold the same zero installments and zero loans. The only difference is whether
       anyone has LOOKED, and the answers must differ — that is the whole distinction, and it is the
       one an unconditional `commitments: []` erased. */
    expect(knownEmpty.result?.verdict).toBe('good_to_go');
    expect(pending.result).toBeUndefined();
  });

  it('the absence reaches the caller as a named cause, not a bare null', () => {
    const unavailable = purchaseContextFromProfile(profile, TODAY, {
      known: false,
      because: 'COMMITMENTS_UNAVAILABLE',
      detail: 'the vault could not be read',
    });
    expect(unavailable.kind).toBe('ABSENT');
    if (unavailable.kind !== 'ABSENT') throw new Error('unreachable');
    expect(unavailable.because).toBe('COMMITMENTS_UNAVAILABLE');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   PAID EARLY — the second half of the same input, and criterion A4's third clause.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

describe('Paid early reaches the Verdict, and the two engines read it differently on purpose', () => {
  it('a settled commitment stops counting toward the verdict pill', () => {
    const owed = verdictFor({ installments: [installment], commitmentReadiness: KNOWN });
    const settled = verdictFor({
      installments: [installment],
      commitmentReadiness: KNOWN,
      paidEarlyCommitmentIds: [installment.installmentId],
    });
    expect(commitmentsOf(owed)).toBe(installment.monthlyPayment);
    expect(commitmentsOf(settled)).toBe(0);
    expect(settled.result?.verdict).toBe('good_to_go');
  });

  it('and its hold is released on the impact strip, by the load engine and not by the loop', () => {
    const settled = verdictFor({
      installments: [installment],
      commitmentReadiness: KNOWN,
      paidEarlyCommitmentIds: [installment.installmentId],
    });
    expect(settled.impactStrip?.availableAfterPurchaseIls.value).toBe(LIMIT - PURCHASE);
  });

  it('stillOwed removes only what was settled, and leaves the list alone otherwise', () => {
    const all = commitmentsFromVault({ cards, installments: [installment], loans: [loan] });
    expect(stillOwed(all, undefined)).toBe(all);
    expect(stillOwed(all, [])).toBe(all);
    expect(stillOwed(all, [installment.installmentId]).map((c) => c.commitmentId)).toEqual([loan.id]);
  });
});

/** A minimal vault card, so the surface seam and the check loop can be run over one vault. */
function engineCard(): EngineCard {
  return {
    cardId: CARD_ID,
    displayName: 'Max',
    last4: '4321',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: LIMIT, currentBalance: 3_000 },
    billingCycle: { statementClosingDay: 25, billingDayOfMonth: 10 },
    roleTags: [] as readonly CardRole[],
    primaryRole: null,
    rewardCategories: [] as readonly PurchaseCategory[],
    cashbackRate: 0,
    foreignTransactionFee: 0,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
  };
}
