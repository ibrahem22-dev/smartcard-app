import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney, type UseMoneyResult } from '../../hooks/useMoney';
import {
  useTranslation,
  type UseTranslationResult,
} from '../../hooks/useTranslation';
import { BORDER, TEXT } from '../../theme/tokens';
import type { ProvenanceChip as ProvenanceChipState } from '../../authority/provenanceChip';
import type { EngineCard } from '../../types/card.types';
import { TABULAR_NUMERALS } from '../../utils/money';
import { CARD_COST_ROWS, type CardCostRowId } from './costRows';

type CostRowValue =
  | { readonly kind: 'known'; readonly text: string; readonly chip: ProvenanceChipState }
  | { readonly kind: 'unknown' };

export interface SectionACostsProps {
  readonly card: EngineCard | undefined;
}

function labelFor(
  id: CardCostRowId,
  t: UseTranslationResult['t'],
): string {
  switch (id) {
    case 'annual-fee':
      return t('דמי כרטיס שנתיים');
    case 'monthly-fee':
      return t('דמי כרטיס חודשיים');
    case 'fx-commission':
      return t('עמלת מט"ח');
    case 'foreign-atm-fee':
      return t('עמלת משיכת מזומן בחו"ל');
    case 'interest-rates':
      return t('שיעורי ריבית');
    case 'other-costs':
      return t('עלויות נוספות');
  }
}

function cardRatesChip(card: EngineCard): ProvenanceChipState {
  return card.cardRates?.source === 'manual' ? 'USER' : 'ESTIMATE';
}

function valueFor(
  id: CardCostRowId,
  card: EngineCard | undefined,
  format: Pick<UseMoneyResult, 'money' | 'percent'>,
): CostRowValue {
  if (card === undefined) return { kind: 'unknown' };

  switch (id) {
    case 'annual-fee':
      // annualFee is required, so 0 cannot be distinguished from missing; calling the card free would be a fake number.
      return card.annualFee === 0
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            text: format.money(card.annualFee),
            chip: 'ESTIMATE',
          };
    case 'monthly-fee':
      return card.cardRates === undefined
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            text: format.money(card.cardRates.monthlyFee),
            chip: cardRatesChip(card),
          };
    case 'fx-commission':
      // foreignTransactionFee is required, so 0 cannot be distinguished from missing; calling the card free would be a fake number.
      return card.foreignTransactionFee === 0
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            text: format.percent(card.foreignTransactionFee * 100),
            chip: 'ESTIMATE',
          };
    case 'foreign-atm-fee':
      // EngineCard has no field for a foreign ATM fee, so there is no known value to display.
      return { kind: 'unknown' };
    case 'interest-rates':
      return card.cardRates === undefined
        ? { kind: 'unknown' }
        : {
            kind: 'known',
            text: [
              format.percent(card.cardRates.creditInterestRate),
              format.percent(card.cardRates.installmentInterestRate),
              format.percent(card.cardRates.cardLoanInterestRate),
            ].join(' · '),
            chip: cardRatesChip(card),
          };
    case 'other-costs':
      // EngineCard has no general other-costs field, so there is no known value to display.
      return { kind: 'unknown' };
  }
}

export function SectionACosts({ card }: SectionACostsProps): React.ReactElement {
  const { t } = useTranslation();
  const { money, percent } = useMoney();

  return (
    <View>
      {CARD_COST_ROWS.map((row) => {
        const value = valueFor(row.id, card, { money, percent });

        return (
          <RtlRow
            className={`min-h-[64px] items-center border-b py-3 ${BORDER.subtle}`}
            key={row.id}
            testID={row.testID}
          >
            <View className="flex-1 gap-1">
              <AppText className={`text-sm font-bold ${TEXT.body}`}>
                {labelFor(row.id, t)}
              </AppText>
              {value.kind === 'known' ? (
                <RtlRow className="items-center gap-2">
                  <AppText
                    className={`text-sm font-extrabold ${TEXT.heading}`}
                    style={TABULAR_NUMERALS}
                    testID={`${row.testID}-value`}
                  >
                    {value.text}
                  </AppText>
                  <ProvenanceChip
                    testID={`${row.testID}-chip`}
                    view={{ chip: value.chip, stale: false }}
                  />
                </RtlRow>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[44px] justify-center"
                  testID={`${row.testID}-add`}
                >
                  <AppText className={`text-sm ${TEXT.muted}`}>
                    {t('להוסיף את זה')}
                  </AppText>
                </Pressable>
              )}
            </View>
            <Pressable
              accessibilityLabel={t('עריכה')}
              accessibilityRole="button"
              className="min-h-[44px] min-w-[44px] items-center justify-center"
              testID={`${row.testID}-pencil`}
            >
              <AppText className={`text-base ${TEXT.secondary}`}>✎</AppText>
            </Pressable>
          </RtlRow>
        );
      })}
    </View>
  );
}
