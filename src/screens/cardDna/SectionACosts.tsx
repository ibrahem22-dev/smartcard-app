import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney, type UseMoneyResult } from '../../hooks/useMoney';
import {
  useTranslation,
  type UseTranslationResult,
} from '../../hooks/useTranslation';
import { BORDER, TEXT } from '../../theme/tokens';
import {
  readCardCost,
  type CardCostReading,
} from '../../store/cardCostResolution';
import { writeCardCostOverride } from '../../store/cardOverrides';
import type { EngineCard } from '../../types/card.types';
import { TABULAR_NUMERALS } from '../../utils/money';
import { CARD_COST_ROWS, type CardCostRowId } from './costRows';

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

function formattedValue(
  id: CardCostRowId,
  reading: Extract<CardCostReading, { readonly kind: 'known' }>,
  format: Pick<UseMoneyResult, 'money' | 'percent'>,
): string {
  const numeric = Number(reading.value);
  switch (id) {
    case 'annual-fee':
    case 'monthly-fee':
    case 'foreign-atm-fee':
    case 'other-costs':
      return Number.isFinite(numeric) ? format.money(numeric) : reading.value;
    case 'fx-commission':
      return Number.isFinite(numeric) ? format.percent(numeric) : reading.value;
    case 'interest-rates':
      return reading.value
        .split('|')
        .map((part) => {
          const rate = Number(part);
          return Number.isFinite(rate) ? format.percent(rate) : part;
        })
        .join(' · ');
  }
}

export function SectionACosts({ card }: SectionACostsProps): React.ReactElement {
  const { t } = useTranslation();
  const { money, percent } = useMoney();
  const [editingRow, setEditingRow] = useState<CardCostRowId | null>(null);
  const [draft, setDraft] = useState('');

  const openEditor = (rowId: CardCostRowId, reading: CardCostReading): void => {
    setEditingRow(rowId);
    setDraft(reading.kind === 'known' ? reading.value : '');
  };

  const saveDraft = (rowId: CardCostRowId): void => {
    if (card === undefined || draft.trim().length === 0) return;
    writeCardCostOverride(card.cardId, rowId, draft.trim());
    setEditingRow(null);
    setDraft('');
  };

  return (
    <View>
      {CARD_COST_ROWS.map((row) => {
        const reading = readCardCost(card, row.id);

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
              {reading.kind === 'known' ? (
                <RtlRow className="items-center gap-2">
                  <AppText
                    className={`text-sm font-extrabold ${TEXT.heading}`}
                    style={TABULAR_NUMERALS}
                    testID={`${row.testID}-value`}
                  >
                    {formattedValue(row.id, reading, { money, percent })}
                  </AppText>
                  <ProvenanceChip
                    testID={`${row.testID}-chip`}
                    view={{ chip: reading.chip, stale: false }}
                  />
                </RtlRow>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[44px] justify-center"
                  onPress={(): void => openEditor(row.id, reading)}
                  testID={`${row.testID}-add`}
                >
                  <AppText className={`text-sm ${TEXT.muted}`}>
                    {t('להוסיף את זה')}
                  </AppText>
                </Pressable>
              )}
              {editingRow === row.id ? (
                <RtlRow className="items-center gap-2">
                  <TextInput
                    accessibilityLabel={labelFor(row.id, t)}
                    className={`min-h-[44px] flex-1 rounded-lg border px-3 ${BORDER.hairline}`}
                    keyboardType="decimal-pad"
                    onChangeText={setDraft}
                    testID={`${row.testID}-input`}
                    value={draft}
                  />
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-[44px] justify-center px-3"
                    onPress={(): void => saveDraft(row.id)}
                    testID={`${row.testID}-save`}
                  >
                    <AppText className={`text-sm font-bold ${TEXT.body}`}>
                      {t('שמירה')}
                    </AppText>
                  </Pressable>
                </RtlRow>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel={t('עריכה')}
              accessibilityRole="button"
              className="min-h-[44px] min-w-[44px] items-center justify-center"
              onPress={(): void => openEditor(row.id, reading)}
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
