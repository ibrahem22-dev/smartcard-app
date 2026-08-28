import type {
  SurfaceEngineResults,
} from '../../surfaces';

type LoadResult = NonNullable<SurfaceEngineResults['load']>;

export interface ActiveNowInstallmentRow {
  readonly id: string;
  readonly merchantName: string;
  readonly canPayEarly: boolean;
}

export interface ActiveNowFeeWaiver {
  readonly throughDate: string;
}

export interface ActiveNowRows {
  readonly cardLimit: LoadResult['cardLimits'][number] | null;
  readonly loadBand: LoadResult['current']['band'] | null;
  readonly currentLoadRatio: LoadResult['current']['ratioOfIncome'] | null;
  readonly thresholds: LoadResult['thresholds'] | null;
  readonly activeInstallments: readonly ActiveNowInstallmentRow[];
  readonly feeWaiver: ActiveNowFeeWaiver | null;
  readonly seasonalOffers: readonly never[];
}

/**
 * Select the fields Section D paints. Financial figures stay wrapped in the exact
 * ProvenancedNumber objects returned by the surface-engine seam.
 */
export function activeNowRowsFor(
  cardId: string | undefined,
  result: SurfaceEngineResults,
): ActiveNowRows {
  const load = result.load;
  const card = result.context.cards.find((candidate) => candidate.cardId === cardId);
  const cardLimit = load?.cardLimits.find((position) => position.cardId === cardId) ?? null;
  const paidEarly = new Set(load?.paidEarlyCommitmentIds ?? []);

  const activeInstallments = cardId === undefined
    ? []
    : result.context.installments
      .filter((installment) =>
        installment.billingCardId === cardId && !paidEarly.has(installment.installmentId))
      .map((installment): ActiveNowInstallmentRow => ({
        id: installment.installmentId,
        merchantName: installment.merchantName,
        canPayEarly: cardLimit !== null,
      }));

  const feeWaiver = card?.cardFee?.discountPercent === 100
    && card.cardFee.discountEndDate !== undefined
    ? { throughDate: card.cardFee.discountEndDate }
    : null;

  return {
    cardLimit,
    loadBand: load?.current.band ?? null,
    currentLoadRatio: load?.current.ratioOfIncome ?? null,
    thresholds: load?.thresholds ?? null,
    activeInstallments,
    feeWaiver,
    // BenefitsDB has no season or validity field. An offer cannot be evidenced from this context.
    seasonalOffers: [],
  };
}
