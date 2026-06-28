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
import {
  calculateCardLoan,
  calculateInstallmentInterest,
} from '../engines/interestCalculator';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import { useCardsStore } from '../store/useCardsStore';
import type { CardInput } from '../types/card.types';
import type { InterestResult } from '../types/interest.types';

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

function formatILS(amount: number): string {
  return `${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`;
}

const INPUT_CLASS =
  'min-h-[48px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white';
const LABEL_CLASS = 'mb-1 mt-3 text-sm font-bold text-slate-700 dark:text-slate-200';

export function InterestCalculatorScreen(): React.ReactElement {
  const { t } = useTranslation();
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

  const result = useMemo<InterestResult | null>(() => {
    if (amount === null || months === null || rate === null) return null;
    try {
      return activeTab === 'installment'
        ? calculateInstallmentInterest(amount, months, rate)
        : calculateCardLoan(amount, months, rate);
    } catch {
      return null;
    }
  }, [activeTab, amount, months, rate]);

  const inputStyle = { textAlign, writingDirection };

  return (
    <RtlScreen safe className="bg-slate-50 dark:bg-app-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <RtlScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="min-h-full w-full p-5">
            <AppText className="text-2xl font-black text-slate-900 dark:text-white">
              {t('מחשבון ריבית')}
            </AppText>

            {/* Tabs */}
            <RtlRow className="mt-3 overflow-hidden rounded-lg border border-slate-300 dark:border-neutral-700">
              {(['installment', 'cardLoan'] as const).map(tab => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab }}
                  className={`min-h-[44px] flex-1 items-center justify-center ${
                    activeTab === tab ? 'bg-blue-600' : 'bg-white dark:bg-dark-surface'
                  }`}
                  key={tab}
                  onPress={(): void => switchTab(tab)}
                >
                  <AppText
                    className={`text-center text-sm font-bold ${
                      activeTab === tab
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-200'
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
                            ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                            : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-dark-surface'
                        }`}
                        key={card.cardId}
                        onPress={(): void => applyCardRate(card, activeTab)}
                      >
                        <AppText
                          className={`text-sm font-bold ${
                            isSelected
                              ? 'text-blue-700 dark:text-blue-200'
                              : 'text-slate-700 dark:text-slate-200'
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
              <AppText className="mt-1 text-sm font-bold text-red-600 dark:text-red-300">
                {t('הריבית חייבת להיות בין 0% ל-30%.')}
              </AppText>
            ) : null}

            {/* Results */}
            {result !== null ? (
              <View className="mt-5 rounded-lg border border-slate-300 bg-white p-4 dark:border-neutral-700 dark:bg-dark-surface">
                <RtlRow className="items-center justify-between">
                  <AppText className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {t('תשלום חודשי')}
                  </AppText>
                  <AppText className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatILS(result.monthlyPayment)}
                  </AppText>
                </RtlRow>
                <RtlRow className="mt-1 items-center justify-between">
                  <AppText className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {t('סך הריבית')}
                  </AppText>
                  <AppText className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                    {formatILS(result.totalInterest)}
                  </AppText>
                </RtlRow>
                <RtlRow className="mt-1 items-center justify-between">
                  <AppText className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {t('עלות כוללת')}
                  </AppText>
                  <AppText className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatILS(result.totalCost)}
                  </AppText>
                </RtlRow>

                {/* Amortization table */}
                <RtlRow className="mt-4 border-b border-slate-300 pb-1 dark:border-neutral-700">
                  <AppText className="flex-1 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                    {t('חודש')}
                  </AppText>
                  <AppText className="flex-1 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                    {t('קרן')}
                  </AppText>
                  <AppText className="flex-1 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                    {t('ריבית')}
                  </AppText>
                  <AppText className="flex-1 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                    {t('יתרה')}
                  </AppText>
                </RtlRow>
                {result.schedule.map(row => (
                  <RtlRow
                    className="border-b border-slate-100 py-1 dark:border-neutral-800"
                    key={row.month}
                  >
                    <AppText className="flex-1 text-xs text-slate-700 dark:text-slate-200">
                      {row.month}
                    </AppText>
                    <AppText className="flex-1 text-xs text-slate-700 dark:text-slate-200">
                      {row.principal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                    </AppText>
                    <AppText className="flex-1 text-xs text-slate-700 dark:text-slate-200">
                      {row.interest.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                    </AppText>
                    <AppText className="flex-1 text-xs text-slate-700 dark:text-slate-200">
                      {row.remainingBalance.toLocaleString('he-IL', {
                        maximumFractionDigits: 0,
                      })}
                    </AppText>
                  </RtlRow>
                ))}
              </View>
            ) : null}

            <AppText className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {t('לצורך הדגמה בלבד — לא ייעוץ פיננסי')}
            </AppText>
          </View>
        </RtlScrollView>
      </KeyboardAvoidingView>
    </RtlScreen>
  );
}
