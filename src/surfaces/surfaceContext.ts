/**
 * THE P5 SURFACE CONTEXT — the vault-shaped inputs the five P5 surfaces are rendered from.
 *
 * P5 is the first phase in which four new surfaces read the same engines, and spec §20's rule
 * finally has something to be about: *"any two surfaces showing different numbers for the same
 * inputs is a P0 bug."* A context is what "the same inputs" means. Two surfaces are only comparable
 * when they were handed one of these and one set of engine results computed from it — which is what
 * `evaluateSurfaceEngines` produces, and what the group-A properties assert over.
 *
 * THIS FILE DESCRIBES INPUTS. IT DECIDES NOTHING. There is no arithmetic here and there is none in
 * `surfaceEngines.ts` either: load ratios, bands, rankings, per-day risk levels and available limits
 * are all produced inside `src/engines/`, and a number computed on the way to a screen is a P3 bug
 * filed late (contract §5, criterion B1).
 *
 * WHY A DATE IS AN INPUT AND NOT A CLOCK READING. `src/engines/risk.ts` takes `asOfDate` and
 * `throughDate` as strict `yyyy-mm-dd` and contains no `Date.now()` anywhere — assumption A15,
 * confirmed against the code. A seam that read the clock would make two surfaces rendered a
 * millisecond apart incomparable on the day the window rolls over, which is exactly the class of
 * disagreement group A exists to catch. The caller supplies the day.
 */
import type { LoggedPurchase } from '../types/activity.types';
import type { EngineCard } from '../types/card.types';
import type { ImportedInstallment } from '../types/installment.types';
import type { Loan } from '../types/loan.types';
import type { UserProfile } from '../types/user.types';
import type { LoadThresholds } from '../engines/load';

/**
 * Everything the five P5 surfaces are rendered from, in one record.
 *
 * Every field is either vault state, catalog state composed at the store boundary, or a caller
 * decision (the dates, the paid-early set, the thresholds). Nothing here is derived.
 */
export interface SurfaceContext {
  /** Inclusive UTC start of the planning window, strict `yyyy-mm-dd`. Supplied, never read from a clock. */
  readonly asOfDate: string;
  /** Inclusive UTC end of the planning window, strict `yyyy-mm-dd`. */
  readonly throughDate: string;
  /** The vault profile. `null` before hydration and when no profile exists — the two are different and the seam says which. */
  readonly profile: UserProfile | null;
  /** The composed engine view of the user's cards. Empty is a legitimate state, not an error. */
  readonly cards: readonly EngineCard[];
  /** Imported תשלומים. Each becomes one monthly obligation and, when it names a card, one limit hold. */
  readonly installments: readonly ImportedInstallment[];
  /** Loans and mortgages. Monthly obligations that hold no card limit. */
  readonly loans: readonly Loan[];
  /** Purchases logged this billing cycle — P4's L1 record, summed per card by `activityMapper`. */
  readonly purchases: readonly LoggedPurchase[];
  /**
   * Commitment ids the user has marked **Paid early** (spec §15; criteria J4 and A4).
   * The load engine releases their held limit; no surface releases anything itself.
   */
  readonly paidEarlyCommitmentIds?: readonly string[];
  /**
   * The user's edited load thresholds. Spec §7 and criterion H3 make the 35% and 50% ticks
   * editable in More, so they travel with the context rather than being read a second time
   * downstream. Omitted means the three canonical ratios in `src/config/financial.ts`.
   */
  readonly thresholds?: LoadThresholds;
  /**
   * The per-card cost, in shekels, of whatever this context is pricing — the input the scoring
   * engine ranks on. Produced by the FX/cost lane, keyed by cardId.
   *
   * OMITTED IS A REAL STATE AND IT IS NOT A ZERO. `ScoringCard.costIls` is optional by contract:
   * absent means the cost could not be resolved, and the engine reports that card in
   * `unknownCostCards` rather than ranking it — *"an absent cost is never a zero and never a
   * ranking position"*. At PHASE-1 nothing supplies this yet, so a ranking over the vault is
   * honestly empty and every card is reported as unknown-cost. PHASE-4 supplies it, and criterion
   * A1 is what proves the Wallet chips, Card DNA section C and Check all rank the same result.
   */
  readonly scoringCosts?: Readonly<Record<string, number>>;
}

/**
 * Why an engine produced no result for this context.
 *
 * AN ABSENCE IS A RENDER, NOT A ZERO. Criterion H4 requires the 7-day strip to *"degrade
 * gracefully"* without billing dates, and the validation plan is explicit that degrading gracefully
 * means rendering the honest unknown rather than rendering green. Criteria H1 and H3 require the
 * hero and the load bar to appear **only when income exists**. A seam that returned a zero ratio for
 * a user with no income would have handed every surface a number that looks like an answer, and
 * `0% — safe` is the most dangerous possible render of "we do not know".
 *
 * So a missing result is a first-class value carrying the reason, and the surfaces render the
 * reason.
 */
export interface SurfaceEngineAbsence {
  readonly engine: 'load' | 'risk' | 'scoring';
  /** A machine-checkable cause, so a surface can branch without parsing prose. */
  readonly because:
    | 'NO_PROFILE'
    | 'NO_INCOME'
    | 'NO_CARDS'
    | 'NO_BILLING_DATES'
    | 'LOAD_UNAVAILABLE';
  /** The same fact in words, for the render and for a failing property's message. */
  readonly detail: string;
}

/** The absence catalogue, in one place, so two surfaces cannot word the same state differently. */
export const ABSENCE_DETAIL: Readonly<Record<SurfaceEngineAbsence['because'], string>> = {
  NO_PROFILE: 'no vault profile is loaded, so there is no income to measure against',
  NO_INCOME: 'no monthly income has been captured; a load ratio has no denominator',
  NO_CARDS: 'no cards are in the vault; there is nothing to rank or to hold a limit',
  NO_BILLING_DATES: 'no card carries a usable billing day, so no day in the window has a known outflow',
  LOAD_UNAVAILABLE: 'the load result this engine reads is itself unavailable',
};

export const absence = (
  engine: SurfaceEngineAbsence['engine'],
  because: SurfaceEngineAbsence['because'],
): SurfaceEngineAbsence => ({ engine, because, detail: ABSENCE_DETAIL[because] });
