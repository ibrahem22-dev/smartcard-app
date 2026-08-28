import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineResults,
} from '../../surfaces';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';
import { activeNowRowsFor } from './activeNowRows';

type PaintedNumber = NonNullable<SurfaceEngineResults['load']>['thresholds']['warningRatio'];

export interface SectionDActiveNowProps {
  readonly cardId?: string;
  readonly context?: SurfaceContext;
}

interface FigureRowProps {
  readonly label: string;
  readonly number: PaintedNumber;
  readonly formatted: string;
  readonly testID: string;
}

function FigureRow({
  label,
  number,
  formatted,
  testID,
}: FigureRowProps): React.ReactElement {
  return (
    <RtlRow className={`items-center justify-between gap-3 border-b py-2 ${BORDER.subtle}`}>
      <AppText className={`flex-1 text-sm ${TEXT.body}`}>{label}</AppText>
      <View className="gap-1">
        <AppText
          accessibilityValue={{ text: String(number.value) }}
          className={`text-sm font-extrabold ${TEXT.heading}`}
          style={TABULAR_NUMERALS}
          testID={testID}
        >
          {formatted}
        </AppText>
        <ProvenanceChip
          testID={`${testID}-provenance`}
          view={{ chip: number.provenance, stale: false }}
        />
      </View>
    </RtlRow>
  );
}

export function SectionDActiveNow({
  cardId,
  context,
}: SectionDActiveNowProps): React.ReactElement {
  const { t } = useTranslation();
  const { money, percent } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);
  const initialPaidEarly = context?.paidEarlyCommitmentIds ?? [];
  const [paidEarlyCommitmentIds, setPaidEarlyCommitmentIds] = useState<readonly string[]>(
    initialPaidEarly,
  );

  const fallbackContext: SurfaceContext = {
    asOfDate: '1970-01-01',
    throughDate: '1970-01-01',
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const baseContext = context ?? fallbackContext;
  const activeContext: SurfaceContext = {
    ...baseContext,
    ...(paidEarlyCommitmentIds.length === 0
      ? {}
      : { paidEarlyCommitmentIds }),
  };
  const rows = activeNowRowsFor(cardId, evaluateSurfaceEngines(activeContext));

  const markPaidEarly = (id: string): void => {
    setPaidEarlyCommitmentIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  };

  return (
    <View className="gap-4 py-4">
      {rows.feeWaiver === null ? null : (
        <View
          className={`gap-1 rounded-lg border p-3 ${SURFACE.raised} ${BORDER.subtle}`}
          testID="card-dna-active-waiver"
        >
          <AppText className={`text-sm font-bold ${TEXT.heading}`}>
            {t('פטור מדמי כרטיס')}
          </AppText>
          <AppText className={`text-sm ${TEXT.body}`}>
            {t('הפטור בתוקף עד')} {rows.feeWaiver.throughDate}
          </AppText>
        </View>
      )}

      {rows.seasonalOffers.length === 0 ? null : (
        <View testID="card-dna-active-offers" />
      )}

      {rows.cardLimit === null || rows.thresholds === null ? null : (
        <View
          className={`gap-1 rounded-lg border p-3 ${SURFACE.raised} ${BORDER.subtle}`}
          testID="card-dna-active-utilization"
        >
          <AppText className={`text-sm font-bold ${TEXT.heading}`}>
            {t('מצב מסגרת מול האזור הבטוח')}
          </AppText>
          {rows.loadBand === null ? null : (
            <AppText
              accessibilityValue={{ text: rows.loadBand }}
              className={`text-sm ${TEXT.body}`}
              testID="card-dna-load-band"
            >
              {t('רצועת עומס')}: {rows.loadBand}
            </AppText>
          )}
          {rows.currentLoadRatio === null ? null : (
            <FigureRow
              formatted={percent(rows.currentLoadRatio.value)}
              label={t('יחס העומס הנוכחי להכנסה')}
              number={rows.currentLoadRatio}
              testID="card-dna-load-ratio"
            />
          )}
          <FigureRow
            formatted={money(rows.cardLimit.creditLimitIls.value)}
            label={t('מסגרת אשראי')}
            number={rows.cardLimit.creditLimitIls}
            testID="card-dna-utilization-limit"
          />
          <FigureRow
            formatted={money(rows.cardLimit.activeInstallmentHoldsIls.value)}
            label={t('מסגרת תפוסה בתשלומים')}
            number={rows.cardLimit.activeInstallmentHoldsIls}
            testID="card-dna-utilization-holds"
          />
          <FigureRow
            formatted={money(rows.cardLimit.availableBeforeChangesIls.value)}
            label={t('מסגרת פנויה לפני שינויים')}
            number={rows.cardLimit.availableBeforeChangesIls}
            testID="card-dna-utilization-before"
          />
          <FigureRow
            formatted={money(rows.cardLimit.availableAfterChangesIls.value)}
            label={t('מסגרת פנויה אחרי שינויים')}
            number={rows.cardLimit.availableAfterChangesIls}
            testID="card-dna-utilization-available"
          />
          {paidEarlyCommitmentIds.length === 0 ? null : (
            <FigureRow
              formatted={money(rows.cardLimit.releasedByEarlyPayoffIls.value)}
              label={t('מסגרת ששוחררה בתשלום מוקדם')}
              number={rows.cardLimit.releasedByEarlyPayoffIls}
              testID="card-dna-utilization-released"
            />
          )}
          <FigureRow
            formatted={percent(rows.thresholds.warningRatio.value)}
            label={t('סף אזהרה')}
            number={rows.thresholds.warningRatio}
            testID="card-dna-threshold-warning"
          />
          <FigureRow
            formatted={percent(rows.thresholds.strongWarningRatio.value)}
            label={t('סף אזהרה חזקה')}
            number={rows.thresholds.strongWarningRatio}
            testID="card-dna-threshold-strong-warning"
          />
          <FigureRow
            formatted={percent(rows.thresholds.blockedRatio.value)}
            label={t('סף חסימה')}
            number={rows.thresholds.blockedRatio}
            testID="card-dna-threshold-blocked"
          />
        </View>
      )}

      {rows.activeInstallments.length === 0 ? null : (
        <View className="gap-2" testID="card-dna-active-installments">
          <AppText className={`text-sm font-bold ${TEXT.heading}`}>
            {t('תשלומים פעילים בכרטיס הזה')}
          </AppText>
          {rows.activeInstallments.map((installment) => (
            <RtlRow
              className={`items-center justify-between gap-3 rounded-lg border p-3 ${BORDER.subtle}`}
              key={installment.id}
              testID={`card-dna-installment-${installment.id}`}
            >
              <AppText className={`flex-1 text-sm ${TEXT.body}`}>
                {installment.merchantName}
              </AppText>
              {installment.canPayEarly ? (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[44px] justify-center px-2"
                  onPress={(): void => markPaidEarly(installment.id)}
                  testID={`card-dna-installment-${installment.id}-paid-early`}
                >
                  <AppText className={`text-sm font-bold ${TEXT.body}`}>
                    {t('שולם מוקדם')}
                  </AppText>
                </Pressable>
              ) : null}
            </RtlRow>
          ))}
        </View>
      )}
    </View>
  );
}
