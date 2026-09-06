import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';
import type { BottomLineReading } from './bottomLine';

/**
 * CARD DNA'S TOP SUMMARY — השורה התחתונה · الخلاصة · Bottom Line.
 *
 * It sits above sections A–D and answers, in one glance, the question the four sections answer in
 * detail. It is the only part of Card DNA that is never collapsed, which is what makes collapsing
 * the rest an improvement in hierarchy rather than a loss of information.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT REFUSES TO SAY
 *
 * A net monthly value needs a fee AND a realised benefit value. The app has a fee for 14 of 378
 * products as a single figure, and has never measured a realised benefit for any card. So this
 * card usually shows the fee (or the candidate set, or the absence), the number of benefits the
 * estate evidences, and a plain statement that the net value is not available — rather than a
 * confident figure assembled from a guess and a zero.
 *
 * THREE STATES ARE KEPT APART because they are three different sentences to the holder: "your
 * tariff depends on a card level we cannot read", "no tariff row reaches this card", and "this is
 * not a catalogued product". Only the first is something the holder can resolve by telling us
 * which card they have.
 *
 * B1: this component renders `reading`. It performs no subtraction and reads no pack.
 */
export interface BottomLineCardProps {
  /**
   * OPTIONAL, because E2's harness mounts every file under `src/screens/**` with no props. A
   * summary with nothing to summarise renders nothing rather than an empty card.
   */
  readonly reading?: BottomLineReading;
}

export function BottomLineCard({ reading }: BottomLineCardProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { money } = useMoney();

  if (reading === undefined) return null;

  return (
    <View
      className={`mb-4 gap-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
      testID="card-dna-bottom-line"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('השורה התחתונה')}
      </AppText>

      {reading.state === 'AVAILABLE' && reading.netMonthlyValueIls !== undefined ? (
        <View className="gap-1" testID="card-dna-bottom-line-net">
          <AppText className={`text-xs ${TEXT.secondary}`}>{t('ערך נטו לחודש')}</AppText>
          <AppText
            accessibilityValue={{ text: String(reading.netMonthlyValueIls) }}
            className={`text-h1 font-black ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="card-dna-bottom-line-net-value"
          >
            {money(reading.netMonthlyValueIls)}
          </AppText>
        </View>
      ) : (
        <View className="gap-1" testID="card-dna-bottom-line-net-absent">
          <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`}>
            {t('אין ערך נטו חודשי שאפשר להציג')}
          </AppText>
          {/* Each reason is its own literal t(): a helper feeding t(variable) is invisible to the
              i18n coverage suite and would fall back to Hebrew in Arabic and English. */}
          <AppText
            className={`text-xs ${TEXT.secondary}`}
            testID="card-dna-bottom-line-net-absent-reason"
          >
            {reading.state === 'NOT_A_CANONICAL_PRODUCT'
              ? t('הכרטיס הזה אינו מוצר מהקטלוג, ולכן אין אליו תעריפון')
              : reading.state === 'FEE_UNKNOWN'
                ? t('לא פורסם דמי כרטיס חודשיים שחלים על הכרטיס הזה')
                : reading.state === 'FEE_NEEDS_LEVEL'
                  ? t('התעריפון מפרסם כמה סכומים לפי דרגת כרטיס, והנתונים אינם מציינים את הדרגה שלך')
                  : t('לא נמדד שווי הטבות בפועל, ולכן אי אפשר לחשב ערך נטו')}
          </AppText>
        </View>
      )}

      {reading.monthlyFee !== undefined ? (
        <RtlRow className="items-center gap-2" testID="card-dna-bottom-line-fee">
          <AppText className={`text-sm ${TEXT.body}`}>{t('דמי כרטיס חודשיים')}</AppText>
          <AppText
            accessibilityValue={{ text: String(reading.monthlyFee.value) }}
            className={`text-sm font-extrabold ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="card-dna-bottom-line-fee-value"
          >
            {reading.monthlyFee.unit === 'ILS'
              ? money(reading.monthlyFee.value)
              : `${reading.monthlyFee.value} ${reading.monthlyFee.unit}`}
          </AppText>
          <ProvenanceChip
            testID="card-dna-bottom-line-fee-chip"
            view={{ chip: reading.monthlyFee.chip === 'VERIFIED' ? 'VERIFIED' : 'UNKNOWN', stale: false }}
          />
        </RtlRow>
      ) : null}

      {reading.state === 'FEE_NEEDS_LEVEL' ? (
        <View className="gap-1" testID="card-dna-bottom-line-fee-candidates">
          <AppText className={`text-xs font-bold ${TEXT.body}`}>
            {t('הסכומים שהתעריפון מפרסם לכרטיסים מהסוג הזה')}
          </AppText>
          {reading.feeCandidates.map((candidate, index) => (
            <AppText
              accessibilityValue={{ text: String(candidate.value) }}
              className={`text-xs ${TEXT.secondary}`}
              key={`${candidate.value}-${candidate.unit}-${index}`}
              style={TABULAR_NUMERALS}
              testID={`card-dna-bottom-line-fee-candidate-${index}`}
            >
              {`${candidate.levels.join(' · ')} — ${
                candidate.unit === 'ILS' ? money(candidate.value) : `${candidate.value} ${candidate.unit}`
              }`}
            </AppText>
          ))}
        </View>
      ) : null}

      <RtlRow className="items-center gap-2" testID="card-dna-bottom-line-benefits">
        <AppText className={`text-sm ${TEXT.body}`}>{t('הטבות מתועדות לכרטיס הזה')}</AppText>
        <AppText
          accessibilityValue={{ text: String(reading.showableBenefits.length) }}
          className={`text-sm font-extrabold ${TEXT.heading}`}
          style={TABULAR_NUMERALS}
          testID="card-dna-bottom-line-benefit-count"
        >
          {String(reading.showableBenefits.length)}
        </AppText>
      </RtlRow>
      <AppText className={`text-xs ${TEXT.muted}`} testID="card-dna-bottom-line-benefit-note">
        {t('זהו מספר ההטבות שיש להן עדות במאגר, ולא שווי שנמדד בפועל')}
      </AppText>

      {reading.state === 'AVAILABLE' && reading.realisedBenefitValueIls !== undefined ? (
        <RtlRow className="items-center gap-2" testID="card-dna-bottom-line-realised">
          <AppText className={`text-sm ${TEXT.body}`}>{t('שווי הטבות שמומש')}</AppText>
          <AppText
            accessibilityValue={{ text: String(reading.realisedBenefitValueIls) }}
            className={`text-sm font-extrabold ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="card-dna-bottom-line-realised-value"
          >
            {money(reading.realisedBenefitValueIls)}
          </AppText>
        </RtlRow>
      ) : null}
    </View>
  );
}
