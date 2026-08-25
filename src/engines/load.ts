/**
 * THE INSTALLMENT / FINANCIAL LOAD ENGINE — criterion N4, product spec §20.5.
 *
 * One call accounts for three related views of the same local-vault facts:
 *   1. current monthly obligations divided by income;
 *   2. the same load after commitments marked "Paid early" are removed;
 *   3. the projected load after an optional prospective commitment is added.
 *
 * Card availability follows product spec §10 exactly: user limit minus active installment holds
 * minus purchases logged this cycle. Paying early releases that commitment's remaining hold
 * immediately. A prospective linked-card commitment then places its total hold, not merely its
 * monthly payment. The engine does not mutate commitments or cards; persistence belongs to P4.
 */
import {
  INSTALLMENT_BLOCKED_RATIO_OF_INCOME,
  INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME,
  INSTALLMENT_WARNING_RATIO_OF_INCOME,
} from '../config/financial';
import { provenanced, type ProvenancedNumber } from './provenance';
import { step, trace, type ReasonTrace } from './reasonTrace';

export type FinancialLoadBand = 'safe' | 'warning' | 'strong_warning' | 'blocked';

export interface LoadCommitment {
  readonly commitmentId: string;
  readonly monthlyAmountIls: ProvenancedNumber;
  /** Required when this commitment reserves credit on a card. */
  readonly linkedCardId?: string;
  /** The amount still reserved against the linked card's limit. */
  readonly remainingHoldIls?: ProvenancedNumber;
}

export interface LoadCard {
  readonly cardId: string;
  readonly creditLimitIls: ProvenancedNumber;
  /** Non-installment purchases already logged in the active billing cycle. */
  readonly loggedThisCyclePurchasesIls: ProvenancedNumber;
}

export interface LoadThresholds {
  readonly warningRatio: ProvenancedNumber;
  readonly strongWarningRatio: ProvenancedNumber;
  readonly blockedRatio: ProvenancedNumber;
}

export interface FinancialLoadInput {
  readonly monthlyIncomeIls: ProvenancedNumber;
  readonly commitments: readonly LoadCommitment[];
  readonly cards: readonly LoadCard[];
  /** Existing commitment ids the user has marked Paid early in this calculation. */
  readonly paidEarlyCommitmentIds?: readonly string[];
  /** A possible new installment or other obligation. It is not persisted by this engine. */
  readonly prospectiveCommitment?: LoadCommitment;
  /** User overrides; omission uses the three canonical config ratios. */
  readonly thresholds?: LoadThresholds;
}

export interface LoadSnapshot {
  readonly monthlyObligationsIls: ProvenancedNumber;
  readonly ratioOfIncome: ProvenancedNumber;
  readonly band: FinancialLoadBand;
}

export interface CardLimitPosition {
  readonly cardId: string;
  readonly creditLimitIls: ProvenancedNumber;
  readonly activeInstallmentHoldsIls: ProvenancedNumber;
  readonly loggedThisCyclePurchasesIls: ProvenancedNumber;
  readonly availableBeforeChangesIls: ProvenancedNumber;
  readonly releasedByEarlyPayoffIls: ProvenancedNumber;
  readonly prospectiveHoldIls: ProvenancedNumber;
  readonly availableAfterChangesIls: ProvenancedNumber;
  /** A prospective hold may not fit even when the account was already over its nominal limit. */
  readonly prospectiveHoldFits: boolean;
}

export interface FinancialLoadResult {
  readonly current: LoadSnapshot;
  readonly afterEarlyPayoff: LoadSnapshot;
  readonly projected: LoadSnapshot;
  readonly thresholds: LoadThresholds;
  readonly cardLimits: readonly CardLimitPosition[];
  readonly paidEarlyCommitmentIds: readonly string[];
  readonly trace: ReasonTrace;
}

const DEFAULT_THRESHOLDS: LoadThresholds = {
  warningRatio: { value: INSTALLMENT_WARNING_RATIO_OF_INCOME, provenance: 'VERIFIED' },
  strongWarningRatio: {
    value: INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME,
    provenance: 'VERIFIED',
  },
  blockedRatio: { value: INSTALLMENT_BLOCKED_RATIO_OF_INCOME, provenance: 'VERIFIED' },
};

function assertUsableNonNegative(label: string, number: ProvenancedNumber): void {
  if (!Number.isFinite(number.value) || number.value < 0) {
    throw new Error(label + ': refusing a negative or non-finite monetary input');
  }
  if (number.provenance === 'UNKNOWN') {
    throw new Error(label + ': UNKNOWN cannot accompany a calculable number');
  }
}

function assertId(label: string, id: string): void {
  if (!id.trim()) throw new Error(label + ': expected a non-empty id');
}

function classify(ratio: number, thresholds: LoadThresholds): FinancialLoadBand {
  // These inequalities retain installmentGate's established boundary semantics:
  // exactly 25% warns, exactly 35% remains warning, and exactly 50% remains strong warning.
  if (ratio > thresholds.blockedRatio.value) return 'blocked';
  if (ratio > thresholds.strongWarningRatio.value) return 'strong_warning';
  if (ratio >= thresholds.warningRatio.value) return 'warning';
  return 'safe';
}

function snapshot(monthlyObligations: number, income: number, thresholds: LoadThresholds): LoadSnapshot {
  const ratio = monthlyObligations / income;
  return {
    monthlyObligationsIls: provenanced(monthlyObligations, 'ESTIMATE'),
    ratioOfIncome: provenanced(ratio, 'ESTIMATE'),
    band: classify(ratio, thresholds),
  };
}

/** Calculate load, limit holds and early-payoff relief without mutating the caller's vault data. */
export function evaluateFinancialLoad(input: FinancialLoadInput): FinancialLoadResult {
  assertUsableNonNegative('monthlyIncomeIls', input.monthlyIncomeIls);
  if (input.monthlyIncomeIls.value === 0) {
    throw new Error('monthlyIncomeIls: zero income cannot produce a load ratio');
  }

  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  assertUsableNonNegative('thresholds.warningRatio', thresholds.warningRatio);
  assertUsableNonNegative('thresholds.strongWarningRatio', thresholds.strongWarningRatio);
  assertUsableNonNegative('thresholds.blockedRatio', thresholds.blockedRatio);
  if (
    thresholds.warningRatio.value >= thresholds.strongWarningRatio.value
    || thresholds.strongWarningRatio.value >= thresholds.blockedRatio.value
    || thresholds.blockedRatio.value > 1
  ) {
    throw new Error('thresholds: expected 0 <= warningRatio < strongWarningRatio < blockedRatio <= 1');
  }

  const cardsById = new Map<string, LoadCard>();
  for (const card of input.cards) {
    assertId('cardId', card.cardId);
    if (cardsById.has(card.cardId)) throw new Error(card.cardId + ': duplicate cardId');
    assertUsableNonNegative(card.cardId + ' creditLimitIls', card.creditLimitIls);
    assertUsableNonNegative(
      card.cardId + ' loggedThisCyclePurchasesIls',
      card.loggedThisCyclePurchasesIls,
    );
    cardsById.set(card.cardId, card);
  }

  const commitmentsById = new Map<string, LoadCommitment>();
  const validateCommitment = (commitment: LoadCommitment, prospective: boolean): void => {
    assertId('commitmentId', commitment.commitmentId);
    if (!prospective && commitmentsById.has(commitment.commitmentId)) {
      throw new Error(commitment.commitmentId + ': duplicate commitmentId');
    }
    assertUsableNonNegative(
      commitment.commitmentId + ' monthlyAmountIls',
      commitment.monthlyAmountIls,
    );
    if (commitment.linkedCardId !== undefined) {
      assertId(commitment.commitmentId + ' linkedCardId', commitment.linkedCardId);
      if (!cardsById.has(commitment.linkedCardId)) {
        throw new Error(commitment.commitmentId + ': linkedCardId does not name an input card');
      }
      if (commitment.remainingHoldIls === undefined) {
        throw new Error(commitment.commitmentId + ': a linked-card commitment requires remainingHoldIls');
      }
    }
    if (commitment.remainingHoldIls !== undefined) {
      if (commitment.linkedCardId === undefined) {
        throw new Error(commitment.commitmentId + ': a limit hold requires linkedCardId');
      }
      assertUsableNonNegative(
        commitment.commitmentId + ' remainingHoldIls',
        commitment.remainingHoldIls,
      );
    }
  };

  for (const commitment of input.commitments) {
    validateCommitment(commitment, false);
    commitmentsById.set(commitment.commitmentId, commitment);
  }
  if (input.prospectiveCommitment !== undefined) {
    validateCommitment(input.prospectiveCommitment, true);
    if (commitmentsById.has(input.prospectiveCommitment.commitmentId)) {
      throw new Error(input.prospectiveCommitment.commitmentId + ': prospective commitment id already exists');
    }
  }

  const paidEarlyIds = input.paidEarlyCommitmentIds ?? [];
  const paidEarly = new Set<string>();
  for (const id of paidEarlyIds) {
    assertId('paidEarlyCommitmentId', id);
    if (paidEarly.has(id)) throw new Error(id + ': duplicate paid-early commitment id');
    if (!commitmentsById.has(id)) throw new Error(id + ': paid-early commitment does not exist');
    paidEarly.add(id);
  }

  const currentMonthly = input.commitments.reduce(
    (sum, commitment) => sum + commitment.monthlyAmountIls.value,
    0,
  );
  const afterPayoffMonthly = input.commitments.reduce(
    (sum, commitment) => sum + (paidEarly.has(commitment.commitmentId)
      ? 0
      : commitment.monthlyAmountIls.value),
    0,
  );
  const projectedMonthly = afterPayoffMonthly
    + (input.prospectiveCommitment?.monthlyAmountIls.value ?? 0);

  const cardLimits = input.cards.map((card): CardLimitPosition => {
    const holds = input.commitments.filter(
      (commitment) => commitment.linkedCardId === card.cardId,
    );
    const activeHolds = holds.reduce(
      (sum, commitment) => sum + (commitment.remainingHoldIls?.value ?? 0),
      0,
    );
    const released = holds.reduce(
      (sum, commitment) => sum + (paidEarly.has(commitment.commitmentId)
        ? commitment.remainingHoldIls?.value ?? 0
        : 0),
      0,
    );
    const prospectiveHold = input.prospectiveCommitment?.linkedCardId === card.cardId
      ? input.prospectiveCommitment.remainingHoldIls?.value ?? 0
      : 0;
    const availableBefore = card.creditLimitIls.value
      - activeHolds
      - card.loggedThisCyclePurchasesIls.value;
    const availableAfterPayoff = availableBefore + released;
    const availableAfter = availableAfterPayoff - prospectiveHold;

    return {
      cardId: card.cardId,
      creditLimitIls: card.creditLimitIls,
      activeInstallmentHoldsIls: provenanced(activeHolds, 'ESTIMATE'),
      loggedThisCyclePurchasesIls: card.loggedThisCyclePurchasesIls,
      availableBeforeChangesIls: provenanced(availableBefore, 'ESTIMATE'),
      releasedByEarlyPayoffIls: provenanced(released, 'ESTIMATE'),
      prospectiveHoldIls: provenanced(prospectiveHold, 'ESTIMATE'),
      availableAfterChangesIls: provenanced(availableAfter, 'ESTIMATE'),
      prospectiveHoldFits: prospectiveHold <= Math.max(0, availableAfterPayoff),
    };
  });

  const current = snapshot(currentMonthly, input.monthlyIncomeIls.value, thresholds);
  const afterEarlyPayoff = snapshot(afterPayoffMonthly, input.monthlyIncomeIls.value, thresholds);
  const projected = snapshot(projectedMonthly, input.monthlyIncomeIls.value, thresholds);

  return {
    current,
    afterEarlyPayoff,
    projected,
    thresholds,
    cardLimits,
    paidEarlyCommitmentIds: [...paidEarly],
    trace: trace('load', [
      step(
        'product spec §20.5 obligations over income',
        'divided current, post-payoff and prospective monthly obligations by monthly income and '
          + 'classified each ratio at the canonical installment thresholds',
        ['commitments', 'paidEarlyCommitmentIds', 'prospectiveCommitment', 'monthlyIncomeIls'],
      ),
      step(
        'product spec §10 available-limit rule',
        'subtracted active installment holds and logged-this-cycle purchases from each user limit',
        ['cards', 'commitments'],
      ),
      step(
        'product spec §15 Paid early',
        'removed each paid-early monthly obligation and released its linked-card hold immediately '
          + 'before applying any prospective commitment',
        ['paidEarlyCommitmentIds', 'prospectiveCommitment'],
      ),
    ]),
  };
}
