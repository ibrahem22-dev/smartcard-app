import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useInterestResult } from '../hooks/useInterestResult';
import { useMoney } from '../hooks/useMoney';
import { TABULAR_NUMERALS } from '../utils/money';
import { useTranslation } from '../hooks/useTranslation';
import { useCardsStore } from '../store/useCardsStore';
import type { CardInput } from '../types/card.types';
import type { InterestResult } from '../types/interest.types';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';

type CalcTab = 'installment' | 'cardLoan';

function parsePositive(value: string, max: number): number | null {
  const normalized = value.trim().replace(/[₪,\s]/g, '');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return null;
  return parsed;
}

function parseMonths(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 360 ? parsed : null;
}

function parseRate(value: string): number | null {
  const normalized = value.trim().replace(/[%\s]/g, '');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 30 ? parsed : null;
}

// formatILS lived here and hardcoded 'he-IL'. A7: one formatter, in src/utils/money.ts.

const INPUT_CLASS =
  `min-h-[48px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`;
const LABEL_CLASS = `mb-1 mt-3 text-sm font-bold ${TEXT.body}`;

export function InterestCalculatorScreen(): React.ReactElement {
  const { t } = useTranslation();
  // Destructured as money only: this screen already has a local amount — the parsed input —
  // and shadowing it with a formatter would be a rename waiting to be misread.
  const { money, amount: formatDigits } = useMoney();
  const { textAlign, writingDirection } = useAppDirection();
  const route = useRoute();
  const initialCardId = (route.params as { cardId?: string } | undefined)?.cardId;
  const cards = useCardsStore(state => state.cards);

  const cardsWithRates = useMemo(
    (): CardInput[] => cards.filter(card => card.cardRates !== undefined),
    [cards],
  );

  const [activeTab, setActiveTab] = useState<CalcTab>('installment');
  const [amountText, setAmountText] = useState('');
  const [monthsText, setMonthsText] = useState('12');
  const [rateText, setRateText] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(
    initialCardId,
  );

  function applyCardRate(card: CardInput, tab: CalcTab): void {
    setSelectedCardId(card.cardId);
    if (card.cardRates === undefined) return;
    const rate =
      tab === 'installment'
        ? card.cardRates.installmentInterestRate
        : card.cardRates.cardLoanInterestRate;
    setRateText(String(rate));
  }

  function switchTab(tab: CalcTab): void {
    setActiveTab(tab);
    const selected = cardsWithRates.find(c => c.cardId === selectedCardId);
    if (selected !== undefined) {
      applyCardRate(selected, tab);
    }
  }

  const amount = parsePositive(amountText, 9_999_999);
  const months = parseMonths(monthsText);
  const rate = parseRate(rateText);
  const rateInvalid = rateText.trim() !== '' && rate === null;

  const result = useInterestResult(activeTab, amount, months, rate);

  const inputStyle = { textAlign, writingDirection };

  return (
    <RtlScreen safe className={`${SURFACE.page}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <RtlScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="min-h-full w-full p-5">
            <AppText className={`text-2xl font-black ${TEXT.heading}`}>
              {t('מחשבון ריבית')}
            </AppText>

            {/* Tabs */}
            <RtlRow className={`mt-3 overflow-hidden rounded-lg border ${BORDER.hairline}`}>
              {(['installment', 'cardLoan'] as const).map(tab => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab }}
                  className={`min-h-[44px] flex-1 items-center justify-center ${
                    activeTab === tab ? `${ACCENT.solid}` : `${SURFACE.card}`
                  }`}
                  key={tab}
                  onPress={(): void => switchTab(tab)}
                >
                  <AppText
                    className={`text-center text-sm font-bold ${
                      activeTab === tab
                        ? `${TEXT.onAccent}`
                        : `${TEXT.body}`
                    }`}
                  >
                    {tab === 'installment' ? t('ריבית תשלומים') : t('הלוואה מהכרטיס')}
                  </AppText>
                </Pressable>
              ))}
            </RtlRow>

            {/* Card selector — only when ≥2 cards have rates */}
            {cardsWithRates.length >= 2 ? (
              <>
                <AppText className={LABEL_CLASS}>{t('בחר כרטיס למילוי ריבית')}</AppText>
                <RtlRow className="flex-wrap gap-2">
                  {cardsWithRates.map(card => {
                    const isSelected = card.cardId === selectedCardId;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        className={`min-h-[40px] items-center justify-center rounded-lg border px-3 ${
                          isSelected
                            ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                            : `${BORDER.hairline} ${SURFACE.card}`
                        }`}
                        key={card.cardId}
                        onPress={(): void => applyCardRate(card, activeTab)}
                      >
                        <AppText
                          className={`text-sm font-bold ${
                            isSelected
                              ? `${ACCENT.text}`
                              : `${TEXT.body}`
                          }`}
                        >
                          {card.displayName}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </RtlRow>
              </>
            ) : null}

            {/* Inputs */}
            <AppText className={LABEL_CLASS}>{t('סכום (₪)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setAmountText}
              style={inputStyle}
              value={amountText}
            />
            <AppText className={LABEL_CLASS}>{t('מספר חודשים (1–360)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="number-pad"
              onChangeText={setMonthsText}
              style={inputStyle}
              value={monthsText}
            />
            <AppText className={LABEL_CLASS}>{t('ריבית שנתית (0–30%)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setRateText}
              style={inputStyle}
              value={rateText}
            />
            {rateInvalid ? (
              <AppText className={`mt-1 text-sm font-bold ${ROLE_TEXT.danger}`}>
                {t('הריבית חייבת להיות בין 0% ל-30%.')}
              </AppText>
            ) : null}

            {/* Results */}
            {result !== null ? (
              <View className={`mt-5 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}>
                <RtlRow className="items-center justify-between">
                  <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
                    {t('תשלום חודשי')}
                  </AppText>
                  <AppText
                    className={`text-sm font-extrabold ${TEXT.heading}`}
                    style={TABULAR_NUMERALS}
                  >
                    {money(result.monthlyPayment)}
                  </AppText>
                </RtlRow>
                <RtlRow className="mt-1 items-center justify-between">
                  <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
                    {t('סך הריבית')}
                  </AppText>
                  <AppText
                    className={`text-sm font-extrabold ${ROLE_TEXT.advisory}`}
                    style={TABULAR_NUMERALS}
                  >
                    {money(result.totalInterest)}
                  </AppText>
                </RtlRow>
                <RtlRow className="mt-1 items-center justify-between">
                  <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
                    {t('עלות כוללת')}
                  </AppText>
                  <AppText
                    className={`text-sm font-extrabold ${TEXT.heading}`}
                    style={TABULAR_NUMERALS}
                  >
                    {money(result.totalCost)}
                  </AppText>
                </RtlRow>

                {/* Amortization table */}
                <RtlRow className={`mt-4 border-b pb-1 ${BORDER.hairline}`}>
                  <AppText className={`flex-1 text-xs font-extrabold ${TEXT.muted}`}>
                    {t('חודש')}
                  </AppText>
                  <AppText className={`flex-1 text-xs font-extrabold ${TEXT.muted}`}>
                    {t('קרן')}
                  </AppText>
                  <AppText className={`flex-1 text-xs font-extrabold ${TEXT.muted}`}>
                    {t('ריבית')}
                  </AppText>
                  <AppText className={`flex-1 text-xs font-extrabold ${TEXT.muted}`}>
                    {t('יתרה')}
                  </AppText>
                </RtlRow>
                {result.schedule.map(row => (
                  <RtlRow
                    className={`border-b py-1 ${BORDER.subtle}`}
                    key={row.month}
                  >
                    <AppText className={`flex-1 text-xs ${TEXT.body}`}>
                      {row.month}
                    </AppText>
                    <AppText className={`flex-1 text-xs ${TEXT.body}`} style={TABULAR_NUMERALS}>
                      {formatDigits(row.principal, 0)}
                    </AppText>
                    <AppText className={`flex-1 text-xs ${TEXT.body}`} style={TABULAR_NUMERALS}>
                      {formatDigits(row.interest, 0)}
                    </AppText>
                    <AppText className={`flex-1 text-xs ${TEXT.body}`} style={TABULAR_NUMERALS}>
                      {formatDigits(row.remainingBalance, 0)}
                    </AppText>
                  </RtlRow>
                ))}
              </View>
            ) : null}

            <AppText className={`mt-4 text-xs ${TEXT.muted}`}>
              {t('לצורך הדגמה בלבד — לא ייעוץ פיננסי')}
            </AppText>
          </View>
        </RtlScrollView>
      </KeyboardAvoidingView>
    </RtlScreen>
  );
}
