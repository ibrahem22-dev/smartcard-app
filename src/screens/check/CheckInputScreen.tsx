import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { chipStateFor } from '../../components/provenanceChipState';
import { stalenessReading } from '../../data/adapter/fxStaleness';
import { RtlButton, RtlRow, RtlScreen } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { TABULAR_NUMERALS } from '../../utils/money';
import { useTranslation } from '../../hooks/useTranslation';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { Currency, PurchaseCategory } from '../../types/purchase.types';

/**
 * CHECK INPUT — criteria **C1–C5** (spec §8).
 *
 *   C1 amount > 0 and currency, shekel default; category, plan and card optional.
 *   C2 ≤4 taps plus the amount: currency switcher, custom keypad, category chips,
 *      collapsed card picker.
 *   C3 installments stepper only in installments mode; ≈ monthly preview from the
 *      live typed amount (user figures echoed, not a recommendation).
 *   C4 foreign currency auto-activates the FX lane and the BOI reference line.
 *      The rate is a prop from the adapter/engine — this file does not fetch one.
 *   C5 benefit-hint chip only when a real match is supplied; omission invents nothing.
 *
 * No engine is called here. Draft fields leave as the user's figures.
 */

export interface CheckInputDraft {
  readonly amount: number;
  readonly currency: Currency;
  readonly category: PurchaseCategory | null;
  readonly installments: number | null;
  readonly cardId: string | null;
}

export interface CheckInputOwnedCard {
  readonly cardId: string;
  readonly displayName: string;
}

export interface CheckInputFxReference {
  readonly rateIlsPerQuoteUnit: number;
  readonly rateDate: string;
}

export interface CheckInputBenefitHint {
  readonly label: string;
}

export interface CheckInputScreenProps {
  readonly onCheck?: (draft: CheckInputDraft) => void;
  /** Owned cards for the collapsed picker. Absent/empty: Recommend-for-me is the only row. */
  readonly ownedCards?: readonly CheckInputOwnedCard[];
  /**
   * BOI reference for a foreign currency. Painted only when the selected currency is
   * not the shekel. Absent on a foreign mount: the line is omitted rather than invented.
   */
  readonly fxReference?: CheckInputFxReference;
  /** Controlled staleness clock. A supplied FX reference is not rendered without it. */
  readonly asOfDate?: string;
  /**
   * Quiet benefit hint. Present only when a real match exists. Absent: no chip.
   */
  readonly benefitHint?: CheckInputBenefitHint;
}

const CURRENCIES: readonly Currency[] = Object.values(Currency);
const CATEGORIES: readonly PurchaseCategory[] = Object.values(PurchaseCategory);
const KEYPAD: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

const CURRENCY_SYMBOL: Readonly<Record<Currency, string>> = {
  [Currency.ILS]: '₪',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
};

const CATEGORY_WORD: Readonly<Record<PurchaseCategory, string>> = {
  [PurchaseCategory.Groceries]: 'מכולת',
  [PurchaseCategory.Dining]: 'מסעדות',
  [PurchaseCategory.Fuel]: 'דלק',
  [PurchaseCategory.Transport]: 'תחבורה',
  [PurchaseCategory.Travel]: 'נסיעות',
  [PurchaseCategory.Subscriptions]: 'מנויים',
  [PurchaseCategory.Education]: 'חינוך',
  [PurchaseCategory.Health]: 'בריאות',
  [PurchaseCategory.Entertainment]: 'בידור',
  [PurchaseCategory.Shopping]: 'קניות',
  [PurchaseCategory.Utilities]: 'חשבונות',
  [PurchaseCategory.Other]: 'אחר',
};

const parseTypedAmount = (typed: string): number | null => {
  const trimmed = typed.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
};

export function CheckInputScreen({
  asOfDate,
  onCheck,
  ownedCards,
  fxReference,
  benefitHint,
}: CheckInputScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();

  const [typedAmount, setTypedAmount] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>(Currency.ILS);
  const [category, setCategory] = useState<PurchaseCategory | null>(null);
  const [installmentsMode, setInstallmentsMode] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [cardId, setCardId] = useState<string | null>(null);
  const [cardPickerOpen, setCardPickerOpen] = useState<boolean>(false);

  const amount = useMemo((): number | null => parseTypedAmount(typedAmount), [typedAmount]);
  const canCheck = amount !== null;
  const foreign = currency !== Currency.ILS;
  const cards = ownedCards ?? [];
  const fxStaleness = fxReference === undefined || asOfDate === undefined
    ? undefined
    : stalenessReading(fxReference.rateDate, asOfDate);

  const monthlyPreview = useMemo((): number | null => {
    if (!installmentsMode || amount === null) {
      return null;
    }
    return amount / installmentCount;
  }, [amount, installmentCount, installmentsMode]);

  const typeKey = useCallback((key: string): void => {
    if (key === '⌫') {
      setTypedAmount((current) => current.slice(0, -1));
      return;
    }
    setTypedAmount((current) => current + key);
  }, []);

  const check = useCallback((): void => {
    if (amount === null) {
      return;
    }
    onCheck?.({
      amount,
      currency,
      category,
      installments: installmentsMode ? installmentCount : null,
      cardId,
    });
  }, [amount, cardId, category, currency, installmentCount, installmentsMode, onCheck]);

  return (
    <RtlScreen className={SURFACE.page} safe>
      <View className={`m-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}>
        <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{t('בדיקת רכישה')}</AppText>

        <AppText className={`mt-4 text-sm font-bold ${TEXT.body}`}>{t('סכום הרכישה')}</AppText>
        <TextInput
          accessibilityLabel={t('סכום הרכישה')}
          className={`mt-1 rounded-lg border p-3 text-lg ${SURFACE.sunken} ${BORDER.hairline}`}
          keyboardType="decimal-pad"
          onChangeText={setTypedAmount}
          testID="check-input-amount"
          value={typedAmount}
        />
        <View className="mt-2 gap-2" testID="check-input-keypad">
          {[0, 1, 2, 3].map((row) => (
            <RtlRow className="gap-2" key={row}>
              {KEYPAD.slice(row * 3, row * 3 + 3).map((key) => (
                <Pressable
                  accessibilityRole="button"
                  className={`flex-1 items-center rounded-lg border p-3 ${SURFACE.sunken} ${BORDER.hairline}`}
                  key={key}
                  onPress={(): void => typeKey(key)}
                  testID={`check-input-key-${key}`}
                >
                  <AppText className={`text-base font-bold ${TEXT.body}`}>{key}</AppText>
                </Pressable>
              ))}
            </RtlRow>
          ))}
        </View>

        <AppText className={`mt-4 text-sm font-bold ${TEXT.body}`}>{t('מטבע')}</AppText>
        {/* rtl-ok */}
        <RtlRow className="mt-1 gap-2">
          {CURRENCIES.map((option: Currency) => {
            const selected = option === currency;
            return (
              <Pressable
                accessibilityLabel={CURRENCY_SYMBOL[option] + ' ' + option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-lg border px-3 py-2 ${
                  selected ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
                }`}
                key={option}
                onPress={(): void => setCurrency(option)}
                testID={`check-input-currency-${option}`}
              >
                <AppText className={`text-sm font-bold ${selected ? ACCENT.text : TEXT.body}`}>
                  {CURRENCY_SYMBOL[option] + ' ' + option}
                </AppText>
              </Pressable>
            );
          })}
        </RtlRow>

        {foreign && fxReference && fxStaleness ? (
          <RtlRow className="mt-2" testID="check-input-fx-lane">
            <AppText
              accessibilityValue={{
                text: `${fxReference.rateIlsPerQuoteUnit}|${fxReference.rateDate}`,
              }}
              className={`text-sm ${TEXT.body}`}
              testID="check-input-fx-rate"
            >
              {`${t('שער בנק ישראל')} ${fxReference.rateIlsPerQuoteUnit} · ${fxReference.rateDate}`}
            </AppText>
            <ProvenanceChip
              asOfDate={fxReference.rateDate}
              testID="check-input-fx-rate-chip"
              view={{ chip: 'ESTIMATE', stale: fxStaleness.stale }}
            />
          </RtlRow>
        ) : null}

        <AppText className={`mt-4 text-sm font-bold ${TEXT.body}`}>{t('קטגוריה')}</AppText>
        <View className="mt-1 gap-2" testID="check-input-categories">
          <RtlRow className="flex-wrap gap-2">
            {CATEGORIES.map((option) => {
              const selected = option === category;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`rounded-full border px-3 py-1 ${
                    selected ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
                  }`}
                  key={option}
                  onPress={(): void => setCategory(option)}
                  testID={`check-input-category-${option}`}
                >
                  <AppText className={`text-xs font-bold ${selected ? ACCENT.text : TEXT.body}`}>
                    {t(CATEGORY_WORD[option])}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>
        </View>

        <RtlRow className="mt-4 gap-2" testID="check-input-plan">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !installmentsMode }}
            className={`rounded-lg border px-3 py-2 ${
              !installmentsMode ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
            }`}
            onPress={(): void => setInstallmentsMode(false)}
            testID="check-input-plan-one"
          >
            <AppText className={`text-sm font-bold ${!installmentsMode ? ACCENT.text : TEXT.body}`}>
              {t('תשלום אחד')}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: installmentsMode }}
            className={`rounded-lg border px-3 py-2 ${
              installmentsMode ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
            }`}
            onPress={(): void => setInstallmentsMode(true)}
            testID="check-input-plan-installments"
          >
            <AppText className={`text-sm font-bold ${installmentsMode ? ACCENT.text : TEXT.body}`}>
              {t('תשלומים')}
            </AppText>
          </Pressable>
        </RtlRow>

        {installmentsMode ? (
          <View className="mt-3" testID="check-input-stepper">
            <RtlRow className="items-center gap-3">
              <Pressable
                accessibilityRole="button"
                className={`rounded-lg border px-3 py-2 ${SURFACE.sunken} ${BORDER.hairline}`}
                onPress={(): void => setInstallmentCount((n) => Math.max(2, n - 1))}
                testID="check-input-stepper-minus"
              >
                <AppText className={`text-base font-bold ${TEXT.body}`}>−</AppText>
              </Pressable>
              <AppText
                accessibilityValue={{ text: String(installmentCount) }}
                className={`text-base font-bold ${TEXT.body}`}
                testID="check-input-stepper-count"
              >
                {String(installmentCount)}
              </AppText>
              <ProvenanceChip
                testID="check-input-stepper-count-chip"
                view={chipStateFor('UNVERIFIED_INPUT', 'USER')}
              />
              <Pressable
                accessibilityRole="button"
                className={`rounded-lg border px-3 py-2 ${SURFACE.sunken} ${BORDER.hairline}`}
                onPress={(): void => setInstallmentCount((n) => n + 1)}
                testID="check-input-stepper-plus"
              >
                <AppText className={`text-base font-bold ${TEXT.body}`}>+</AppText>
              </Pressable>
            </RtlRow>
            {monthlyPreview !== null ? (
              <RtlRow className="mt-2 items-center gap-2">
                <AppText
                  accessibilityValue={{ text: String(monthlyPreview) }}
                  className={`text-sm ${TEXT.muted}`}
                  style={TABULAR_NUMERALS}
                  testID="check-input-monthly-preview"
                >
                  {`≈ ${money(monthlyPreview)}`}
                </AppText>
                <ProvenanceChip
                  testID="check-input-monthly-preview-chip"
                  view={chipStateFor('UNVERIFIED_INPUT', 'USER')}
                />
              </RtlRow>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: cardPickerOpen }}
          className={`mt-4 rounded-lg border p-3 ${SURFACE.sunken} ${BORDER.hairline}`}
          onPress={(): void => setCardPickerOpen((open) => !open)}
          testID="check-input-card-picker"
        >
          <AppText className={`text-sm font-bold ${TEXT.body}`}>
            {cardId === null
              ? t('לשלם בכרטיס מסוים?')
              : (cards.find((card) => card.cardId === cardId)?.displayName ?? t('המליצי בשבילי'))}
          </AppText>
        </Pressable>
        {cardPickerOpen ? (
          <View className="mt-2 gap-2" testID="check-input-card-list">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: cardId === null }}
              className={`rounded-lg border p-3 ${
                cardId === null ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
              }`}
              onPress={(): void => {
                setCardId(null);
                setCardPickerOpen(false);
              }}
              testID="check-input-card-recommend"
            >
              <AppText className={`text-sm font-bold ${TEXT.body}`}>{t('המליצי בשבילי')}</AppText>
            </Pressable>
            {cards.map((card) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: cardId === card.cardId }}
                className={`rounded-lg border p-3 ${
                  cardId === card.cardId ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
                }`}
                key={card.cardId}
                onPress={(): void => {
                  setCardId(card.cardId);
                  setCardPickerOpen(false);
                }}
                testID={`check-input-card-${card.cardId}`}
              >
                <AppText className={`text-sm font-bold ${TEXT.body}`}>{card.displayName}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {benefitHint ? (
          <AppText className={`mt-3 text-xs ${TEXT.secondary}`} testID="check-input-benefit-hint">
            {benefitHint.label}
          </AppText>
        ) : null}

        {!canCheck ? (
          <AppText className={`mt-4 text-sm font-bold ${ROLE_TEXT.advisory}`} testID="check-input-refusal">
            {t('צריך סכום גדול מאפס כדי להמשיך')}
          </AppText>
        ) : null}

        <AppText className={`mt-2 text-xs ${TEXT.muted}`}>
          {t('קטגוריה, תשלומים ובחירת כרטיס אינם חובה')}
        </AppText>

        <RtlButton
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCheck }}
          className={`mt-4 items-center rounded-lg p-3 ${canCheck ? ACCENT.solid : SURFACE.raised}`}
          disabled={!canCheck}
          label={t('בדוק רכישה')}
          labelClassName={`text-base font-extrabold ${canCheck ? TEXT.onAccent : TEXT.muted}`}
          onPress={check}
          testID="check-input-submit"
        />
      </View>
    </RtlScreen>
  );
}
