import React from 'react';
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
import { usePaidEarly } from '../../surfaces/usePaidEarly';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { loadBandLabelKey } from '../../theme/riskPresentation';
import { TABULAR_NUMERALS } from '../../utils/money';
import { activeNowRowsFor } from './activeNowRows';

type PaintedNumber = NonNullable<SurfaceEngineResults['load']>['thresholds']['warningRatio'];

export interface SectionDActiveNowProps {
  readonly cardId?: string;
  readonly context?: SurfaceContext;
}

/*
 * THE ELEMENT THAT STYLES A NUMBER FORMATS IT.
 *
 * FigureRow used to take an already-formatted string built at the call site, while the tabular
 * style lived here, on the AppText that renders it. Two consequences, one of them not cosmetic:
 *
 *   · A7 checks that every formatter call sits inside an element carrying TABULAR_NUMERALS, and it
 *     reads the six lines above the call. At the call site those lines are the FigureRow opening,
 *     so all nine rows read as unstyled amounts and P5 left a closed P2 criterion red.
 *   · More to the point, formatting and styling could drift. A row could be handed a formatter the
 *     styled element never expected, and nothing would have compared them.
 *
 * Taking a format discriminator instead puts both in one place. Every call site already formatted
 * exactly number.value, so this is the same output by a shorter route.
 */
interface FigureRowProps {
  readonly label: string;
  readonly number: PaintedNumber;
  readonly format: 'money' | 'percent';
  readonly testID: string;
}

function FigureRow({
  label,
  number,
  format,
  testID,
}: FigureRowProps): React.ReactElement {
  /* The hook, not an import: this app's formatter takes the reader's language. */
  const { money, ratioPercent } = useMoney();
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
          {format === 'money' ? money(number.value) : ratioPercent(number.value)}
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
  const { money } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);
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
  const {
    context: activeContext,
    markPaidEarly,
    paidEarlyCommitmentIds,
  } = usePaidEarly(baseContext);
  const rows = activeNowRowsFor(cardId, evaluateSurfaceEngines(activeContext));

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
              accessibilityValue={{ text: t(loadBandLabelKey(rows.loadBand)) }}
              className={`text-sm ${TEXT.body}`}
              testID="card-dna-load-band"
            >
              {t('רצועת עומס')}: {t(loadBandLabelKey(rows.loadBand))}
            </AppText>
          )}
          {rows.currentLoadRatio === null ? null : (
            <FigureRow
              format="percent"
              label={t('יחס העומס הנוכחי להכנסה')}
              number={rows.currentLoadRatio}
              testID="card-dna-load-ratio"
            />
          )}
          <FigureRow
            format="money"
            label={t('מסגרת אשראי')}
            number={rows.cardLimit.creditLimitIls}
            testID="card-dna-utilization-limit"
          />
          <FigureRow
            format="money"
            label={t('מסגרת תפוסה בתשלומים')}
            number={rows.cardLimit.activeInstallmentHoldsIls}
            testID="card-dna-utilization-holds"
          />
          <FigureRow
            format="money"
            label={t('מסגרת פנויה לפני שינויים')}
            number={rows.cardLimit.availableBeforeChangesIls}
            testID="card-dna-utilization-before"
          />
          <FigureRow
            format="money"
            label={t('מסגרת פנויה אחרי שינויים')}
            number={rows.cardLimit.availableAfterChangesIls}
            testID="card-dna-utilization-available"
          />
          {paidEarlyCommitmentIds.length === 0 ? null : (
            <FigureRow
              format="money"
              label={t('מסגרת ששוחררה בתשלום מוקדם')}
              number={rows.cardLimit.releasedByEarlyPayoffIls}
              testID="card-dna-utilization-released"
            />
          )}
          <FigureRow
            format="percent"
            label={t('סף אזהרה')}
            number={rows.thresholds.warningRatio}
            testID="card-dna-threshold-warning"
          />
          <FigureRow
            format="percent"
            label={t('סף אזהרה חזקה')}
            number={rows.thresholds.strongWarningRatio}
            testID="card-dna-threshold-strong-warning"
          />
          <FigureRow
            format="percent"
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
