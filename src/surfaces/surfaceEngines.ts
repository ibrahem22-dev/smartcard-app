/**
 * THE P5 ENGINE-READ SEAM — WP-1.1, criterion B1, and the thing every group-A property is built on.
 *
 *   > **B1.** *"No P5 surface holds recommendation logic in either direction: every number a
 *   > surface shows came from an engine call…"* (contract §5; spec §20)
 *
 *   > **§2 rule 10.** *"An agreement claim is measured across surfaces in one run. A property that
 *   > says two surfaces agree must obtain both values in the same process, from the same inputs,
 *   > in one execution."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ONE FUNCTION AND NOT FIVE HOOKS
 *
 * P4 had one seam because it had one loop: `runPurchaseCheck` makes one engine call and the pill
 * and the panel are fields of one result, so *"they cannot disagree because they are not produced
 * separately."* P5 has five surfaces and three engines, and the same sentence has to hold across
 * screens that are built four phases apart.
 *
 * If each surface called its own engine, every one would be individually correct and the property
 * *"Home's load bar and Plan Commitments' summary show the same ratio"* would be comparing two
 * engine results rather than two renders of one. Two calls can differ — a different default, a
 * different rounding path, a different day — and the property would then be true of the fixtures and
 * silent about the product. **So there is exactly one call per engine per context, here, and every
 * surface reads fields of the objects this returns.**
 *
 * That is also what makes group A writable at all: a property calls this once and hands the SAME
 * result object to every participating surface, so the comparison is between renders and not
 * between computations.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE MAPS. IT DOES NOT DECIDE. — the sentence `src/check/runPurchaseCheck.ts` carries, for
 * the same reason.
 *
 * Assembling an obligation list, summing logged purchases per card and turning a payday chip into a
 * date are input assembly. Ratios, bands, rankings, per-day risk levels and available limits are
 * produced inside `src/engines/` and are returned **unchanged** — no re-rounding, no re-shaping, no
 * convenience field that is a second home for an engine's number. If you find yourself dividing by
 * income here, stop.
 *
 * Where P4 already assembles an input, this reuses it rather than writing a second one:
 * `loadCardsFromVault` and `nextPaydayIso` are P4's, and criterion B4 forbids re-deriving a named
 * interface.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * RISK IS FED FROM LOAD, ON PURPOSE.
 *
 * `evaluateRiskPlanning` needs `currentMonthlyObligationsIls` and a `safeLoadRatio`. Both already
 * exist inside the load result — `current.monthlyObligationsIls` and
 * `thresholds.strongWarningRatio` — so they are taken from there rather than recomputed or read a
 * second time from config. That makes A2 and A3 consistent **by construction** instead of by
 * assertion: Home's load bar and Plan Calendar's dots cannot disagree about the obligation total,
 * because there is only one.
 */
import { evaluateFinancialLoad, type FinancialLoadResult, type LoadCommitment, type LoadThresholds } from '../engines/load';
import { evaluateRiskPlanning, type PlanningBilling, type PlanningCommitment, type PlanningSalary, type RiskPlanningResult } from '../engines/risk';
import { scoreCards, type ScoringCard, type ScoringResult } from '../engines/scoring';
import { provenanced } from '../engines/provenance';
import { loadCardsFromVault } from '../check/activityMapper';
import { nextPaydayIso } from '../check/incomeAnchor';
import { absence, type SurfaceContext, type SurfaceEngineAbsence } from './surfaceContext';

/**
 * One set of engine results for one context.
 *
 * Each field is the engine's own result object, unchanged. A surface reads a FIELD of one of these;
 * it does not receive a pre-flattened view, because a flattened view is a second place a number can
 * come from and §2 rule 11 requires a rendered figure to be traceable to the engine result field
 * that produced it.
 */
export interface SurfaceEngineResults {
  /** `null` when income is unknown. Never a zero ratio: see `SurfaceEngineAbsence`. */
  readonly load: FinancialLoadResult | null;
  /** `null` when the window has no known outflow. H4's honest unknown, not a green day. */
  readonly risk: RiskPlanningResult | null;
  /** `null` when the vault holds no card. A ranking over zero cards is a vacuous pass. */
  readonly scoring: ScoringResult | null;
  /** Why each `null` is null. Empty when all three ran. */
  readonly absent: readonly SurfaceEngineAbsence[];
  /** The context these results are of, so a property can never compare results of two contexts. */
  readonly context: SurfaceContext;
}

/** A monthly obligation and, when it reserves credit, the card it is held against. */
const commitmentsFrom = (ctx: SurfaceContext): readonly LoadCommitment[] => {
  const fromInstallments = ctx.installments.map((i): LoadCommitment => ({
    commitmentId: i.installmentId,
    monthlyAmountIls: provenanced(i.monthlyPayment, 'USER'),
    /* A hold only exists where the installment names a card the vault actually holds. Naming a
       card that is not there would make the load engine refuse the whole input, and an unlinked
       installment is a real state — LOCK-007 in the P3-era mapper made the same distinction. */
    ...(ctx.cards.some((c) => c.cardId === i.billingCardId)
      ? {
        linkedCardId: i.billingCardId,
        remainingHoldIls: provenanced(i.monthlyPayment * i.monthsRemaining, 'ESTIMATE'),
      }
      : {}),
  }));
  const fromLoans = ctx.loans.map((l): LoadCommitment => ({
    commitmentId: l.id,
    monthlyAmountIls: provenanced(l.monthlyPayment, 'USER'),
    ...(l.linkedCardId !== undefined && ctx.cards.some((c) => c.cardId === l.linkedCardId)
      ? {
        linkedCardId: l.linkedCardId,
        remainingHoldIls: provenanced(l.remainingBalance, 'ESTIMATE'),
      }
      : {}),
  }));
  return [...fromInstallments, ...fromLoans];
};

/** Day-of-month → the next occurrence on or after `asOfDate`, within the window. Calendar, not policy. */
const billingDatesInWindow = (dayOfMonth: number, asOfDate: string, throughDate: string): readonly string[] => {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return [];
  const out: string[] = [];
  const start = new Date(asOfDate + 'T00:00:00Z');
  const end = new Date(throughDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    /* A card billing on the 31st bills on the last day of a short month. Clamping is the Israeli
       billing model, not an approximation of it. */
    const day = Math.min(dayOfMonth, daysInMonth);
    const d = new Date(Date.UTC(y, m, day));
    if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
      out.push(d.toISOString().slice(0, 10));
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
};

const billingsFrom = (ctx: SurfaceContext): readonly PlanningBilling[] => {
  const rows: PlanningBilling[] = [];
  for (const card of ctx.cards) {
    for (const date of billingDatesInWindow(card.billingCycle.billingDayOfMonth, ctx.asOfDate, ctx.throughDate)) {
      rows.push({
        billingId: card.cardId + '@' + date,
        date,
        amountIls: provenanced(card.framework.currentBalance, 'ESTIMATE'),
        /* Zero is valid and is stated rather than guessed: knowing WHICH obligations end at a
           given billing event is a Plan Commitments fact that P5 does not have at PHASE-1. */
        monthlyObligationsEndingIls: provenanced(0, 'ESTIMATE'),
      });
    }
  }
  return rows;
};

const salariesFrom = (ctx: SurfaceContext): readonly PlanningSalary[] => {
  const profile = ctx.profile;
  if (profile === null || profile.payday === undefined) return [];
  const first = nextPaydayIso(profile.payday, ctx.asOfDate);
  const rows: PlanningSalary[] = [];
  let date = first;
  let guard = 0;
  while (date <= ctx.throughDate && guard < 24) {
    rows.push({ salaryId: 'salary@' + date, date, amountIls: provenanced(profile.monthlyIncome, 'USER') });
    const next = new Date(date + 'T00:00:00Z');
    next.setUTCMonth(next.getUTCMonth() + 1);
    date = nextPaydayIso(profile.payday, next.toISOString().slice(0, 10));
    guard += 1;
  }
  return rows;
};

/** Loans and installments as dated outflows. A commitment with no known date is not invented onto one. */
const planningCommitmentsFrom = (ctx: SurfaceContext): readonly PlanningCommitment[] => {
  const rows: PlanningCommitment[] = [];
  for (const i of ctx.installments) {
    const card = ctx.cards.find((c) => c.cardId === i.billingCardId);
    if (card === undefined) continue;
    for (const date of billingDatesInWindow(card.billingCycle.billingDayOfMonth, ctx.asOfDate, ctx.throughDate)) {
      rows.push({ commitmentId: i.installmentId + '@' + date, date, amountIls: provenanced(i.monthlyPayment, 'USER') });
    }
  }
  return rows;
};

const scoringCardsFrom = (ctx: SurfaceContext): readonly ScoringCard[] =>
  ctx.cards.map((c): ScoringCard => {
    const cost = ctx.scoringCosts?.[c.cardId];
    return {
      cardId: c.cardId,
      available: c.isActive,
      /* Absent when the context prices nothing yet. The engine then reports the card in
         unknownCostCards instead of ranking it, which is the honest lane and not a zero. */
      ...(typeof cost === "number" && Number.isFinite(cost) ? { costIls: provenanced(cost, "ESTIMATE") } : {}),
    };
  });

/**
 * THE ONE CALL SITE. Three engines, at most once each, from one context.
 *
 * It does not catch engine errors. An engine throws on an input it cannot honestly evaluate, and
 * swallowing that would put a surface in front of a user with no number and no reason. What it DOES
 * do is state, before calling, the conditions it can name — no profile, no income, no cards, no
 * billing dates — and return `null` with that reason, because those are product states rather than
 * defects and each one has a criterion about how it must render.
 */
export function evaluateSurfaceEngines(ctx: SurfaceContext): SurfaceEngineResults {
  const absent: SurfaceEngineAbsence[] = [];

  const income = ctx.profile?.monthlyIncome;
  const hasIncome = ctx.profile !== null && typeof income === 'number' && Number.isFinite(income) && income > 0;

  const loadCards = loadCardsFromVault(
    ctx.cards.map((c) => ({ cardId: c.cardId, creditLimit: c.framework.creditLimit })),
    ctx.purchases,
  );

  let load: FinancialLoadResult | null = null;
  if (ctx.profile === null) absent.push(absence('load', 'NO_PROFILE'));
  else if (!hasIncome) absent.push(absence('load', 'NO_INCOME'));
  else {
    const thresholds: LoadThresholds | undefined = ctx.thresholds;
    load = evaluateFinancialLoad({
      monthlyIncomeIls: provenanced(income as number, 'USER'),
      commitments: commitmentsFrom(ctx),
      cards: loadCards,
      ...(ctx.paidEarlyCommitmentIds ? { paidEarlyCommitmentIds: ctx.paidEarlyCommitmentIds } : {}),
      ...(thresholds ? { thresholds } : {}),
    });
  }

  const billings = billingsFrom(ctx);
  let risk: RiskPlanningResult | null = null;
  if (load === null) absent.push(absence('risk', 'LOAD_UNAVAILABLE'));
  else if (billings.length === 0) absent.push(absence('risk', 'NO_BILLING_DATES'));
  else {
    risk = evaluateRiskPlanning({
      asOfDate: ctx.asOfDate,
      throughDate: ctx.throughDate,
      ...(ctx.profile?.currentBalance !== undefined
        ? { openingBalanceIls: provenanced(ctx.profile.currentBalance, 'USER') }
        : {}),
      dangerThresholdIls: provenanced(ctx.profile?.dangerThreshold ?? 0, 'USER'),
      monthlyIncomeIls: provenanced(income as number, 'USER'),
      /* FROM THE LOAD RESULT, not recomputed. A2 and A3 agree by construction. */
      currentMonthlyObligationsIls: load.current.monthlyObligationsIls,
      prospectiveMonthlyObligationIls: provenanced(0, 'ESTIMATE'),
      safeLoadRatio: load.thresholds.strongWarningRatio,
      salaries: salariesFrom(ctx),
      billings,
      commitments: planningCommitmentsFrom(ctx),
    });
  }

  let scoring: ScoringResult | null = null;
  if (ctx.cards.length === 0) absent.push(absence('scoring', 'NO_CARDS'));
  else scoring = scoreCards({ cards: scoringCardsFrom(ctx) });

  return { load, risk, scoring, absent, context: ctx };
}
