import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { useTranslation } from '../hooks/useTranslation';
import type { CardsStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import {
  CardIssuer,
  type CardFeeInfo,
  type CardInput,
  type CardRates,
} from '../types/card.types';
import { inputStyle, rtl } from '../utils/rtlStyles';

type CardDetailScreenProps = NativeStackScreenProps<
  CardsStackParamList,
  'CardDetail'
>;

const ISSUER_LABELS: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parse a non-negative number within [min, max]; null when invalid. */
function parseBounded(value: string, min: number, max: number): number | null {
  const normalized = value.trim().replace(/[%₪\s]/g, '');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

const INPUT_CLASS =
  'min-h-[48px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white';
const LABEL_CLASS = 'mb-1 mt-3 text-sm font-bold text-slate-700 dark:text-slate-200';

export function CardDetailScreen({
  navigation,
  route,
}: CardDetailScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const card = useCardsStore(state =>
    state.cards.find(c => c.cardId === route.params.cardId),
  );
  const updateCard = useCardsStore(state => state.updateCard);

  const rates: CardRates | undefined = card?.cardRates;
  const fee: CardFeeInfo | undefined = card?.cardFee;

  // --- editable state (initialized from the card) ---
  const [billingDay, setBillingDay] = useState(
    card ? String(card.billingCycle.billingDayOfMonth) : '',
  );
  const [creditLimit, setCreditLimit] = useState(
    card ? String(card.framework.creditLimit) : '',
  );
  const [hasRates, setHasRates] = useState(rates !== undefined);
  const [creditRate, setCreditRate] = useState(
    rates ? String(rates.creditInterestRate) : '',
  );
  const [installmentRate, setInstallmentRate] = useState(
    rates ? String(rates.installmentInterestRate) : '',
  );
  const [cardLoanRate, setCardLoanRate] = useState(
    rates ? String(rates.cardLoanInterestRate) : '',
  );
  const [fxCommission, setFxCommission] = useState(
    rates ? String(rates.foreignExchangeCommission) : '',
  );
  const [monthlyFee, setMonthlyFee] = useState(
    rates ? String(rates.monthlyFee) : '',
  );
  const [hasForeignAccount, setHasForeignAccount] = useState(
    card?.hasForeignCurrencyAccount ?? false,
  );
  const [foreignCurrency, setForeignCurrency] = useState(
    card?.foreignCurrencyType ?? '',
  );
  const [bankFx, setBankFx] = useState(
    card?.bankFxCommission !== undefined ? String(card.bankFxCommission) : '',
  );
  const [issuanceDate, setIssuanceDate] = useState(
    card?.cardIssuanceDate ?? '',
  );
  const [feeOriginal, setFeeOriginal] = useState(
    fee ? String(fee.originalFee) : '',
  );
  const [feeDiscount, setFeeDiscount] = useState(
    fee ? String(fee.discountPercent) : '',
  );
  const [feeEndDate, setFeeEndDate] = useState(fee?.discountEndDate ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (card === undefined) {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-50 dark:bg-app-dark"
        edges={['top', 'bottom']}
      >
        <View className="flex-1 items-center justify-center p-5">
          <AppText className="text-base text-slate-500 dark:text-slate-300">
            {t('הכרטיס לא נמצא')}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const effectiveFeePreview = ((): number | null => {
    const original = parseBounded(feeOriginal, 0, 999_999);
    const discount = parseBounded(feeDiscount, 0, 100);
    if (original === null || discount === null) return null;
    return Math.round(original * (1 - discount / 100) * 100) / 100;
  })();

  function handleSave(): void {
    if (card === undefined) return;
    setSaved(false);

    const billing = parseBounded(billingDay, 1, 31);
    const limit = parseBounded(creditLimit, 0, 9_999_999);
    if (billing === null || limit === null) {
      setSaveError(t('יום חיוב (1–31) וסכום מסגרת חייבים להיות תקינים.'));
      return;
    }

    let updates: Partial<CardInput> = {
      billingCycle: { ...card.billingCycle, billingDayOfMonth: billing },
      framework: { ...card.framework, creditLimit: limit },
      hasForeignCurrencyAccount: hasForeignAccount,
    };

    if (hasRates) {
      const credit = parseBounded(creditRate, 0, 30);
      const installment = parseBounded(installmentRate, 0, 30);
      const cardLoan = parseBounded(cardLoanRate, 0, 30);
      const fx = parseBounded(fxCommission, 0, 10);
      const mFee = parseBounded(monthlyFee, 0, 9_999);
      if (
        credit === null ||
        installment === null ||
        cardLoan === null ||
        fx === null ||
        mFee === null
      ) {
        setSaveError(
          t('שיעורי הריבית חייבים להיות 0–30%, עמלת המרה 0–10%, דמי כרטיס תקינים.'),
        );
        return;
      }
      const newRates: CardRates = {
        creditInterestRate: credit,
        installmentInterestRate: installment,
        cardLoanInterestRate: cardLoan,
        foreignExchangeCommission: fx,
        monthlyFee: mFee,
        source: 'manual',
        lastUpdated: todayISO(),
      };
      updates = { ...updates, cardRates: newRates };
    }

    if (hasForeignAccount) {
      const trimmedCurrency = foreignCurrency.trim().toUpperCase();
      if (trimmedCurrency !== '') {
        updates = { ...updates, foreignCurrencyType: trimmedCurrency };
      }
      const parsedBankFx = parseBounded(bankFx, 0, 10);
      if (parsedBankFx !== null) {
        updates = { ...updates, bankFxCommission: parsedBankFx };
      }
    }

    if (issuanceDate.trim() !== '') {
      updates = { ...updates, cardIssuanceDate: issuanceDate.trim() };
    }

    const original = parseBounded(feeOriginal, 0, 999_999);
    const discount = parseBounded(feeDiscount, 0, 100);
    if (original !== null && discount !== null) {
      const feeInfo: CardFeeInfo = {
        originalFee: original,
        discountPercent: discount,
        effectiveFee: Math.round(original * (1 - discount / 100) * 100) / 100,
        discountSource: 'manual',
        ...(feeEndDate.trim() !== '' ? { discountEndDate: feeEndDate.trim() } : {}),
      };
      updates = { ...updates, cardFee: feeInfo };
    }

    updateCard(card.cardId, updates);
    setSaveError(null);
    setSaved(true);
  }

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={[rtl.scrollInner, { paddingBottom: 32 }]}
          keyboardShouldPersistTaps="handled"
          style={rtl.scrollOuter}
        >
          <View className="w-full gap-1 p-5">
            {/* Header */}
            <AppText className="text-2xl font-black text-slate-900 dark:text-white">
              {card.displayName}
            </AppText>
            <AppText className="text-base text-slate-600 dark:text-slate-300">
              {t(ISSUER_LABELS[card.issuer])} ·{' '}
              {card.bankName === undefined ? t('מועדון רגיל') : t(card.bankName)} ·{' '}
              {t('מסתיים ב-{{last4}}', { last4: card.last4 })}
            </AppText>

            <AppText className={LABEL_CLASS}>{t('יום חיוב (1–31)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="number-pad"
              onChangeText={setBillingDay}
              style={inputStyle()}
              value={billingDay}
            />

            <AppText className={LABEL_CLASS}>{t('מסגרת אשראי (₪)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setCreditLimit}
              style={inputStyle()}
              value={creditLimit}
            />

            {/* Rates */}
            <AppText className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
              {t('שיעורי ריבית ועמלות')}
            </AppText>

            {!hasRates ? (
              <Pressable
                accessibilityRole="button"
                className="mt-2 min-h-[48px] items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
                onPress={(): void => setHasRates(true)}
              >
                <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
                  {t('הוסף שיעורי ריבית')}
                </AppText>
              </Pressable>
            ) : (
              <>
                <AppText className={LABEL_CLASS}>{t('ריבית קרדיט (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setCreditRate}
                  style={inputStyle()}
                  value={creditRate}
                />
                <AppText className={LABEL_CLASS}>{t('ריבית תשלומים (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setInstallmentRate}
                  style={inputStyle()}
                  value={installmentRate}
                />
                <AppText className={LABEL_CLASS}>{t('ריבית הלוואה (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setCardLoanRate}
                  style={inputStyle()}
                  value={cardLoanRate}
                />
                <AppText className={LABEL_CLASS}>{t('עמלת המרה (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setFxCommission}
                  style={inputStyle()}
                  value={fxCommission}
                />
                <AppText className={LABEL_CLASS}>{t('דמי כרטיס חודשיים (₪)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setMonthlyFee}
                  style={inputStyle()}
                  value={monthlyFee}
                />

                <AppText className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('המידע מוצג לנוחות — בדוק מול חברת הכרטיסים. עודכן: {{date}}', {
                    date: rates?.lastUpdated ?? todayISO(),
                  })}
                </AppText>
              </>
            )}

            {/* Card fee / discount */}
            <AppText className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
              {t('דמי כרטיס והנחה')}
            </AppText>
            <AppText className={LABEL_CLASS}>{t('דמי כרטיס מקוריים (₪)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setFeeOriginal}
              style={inputStyle()}
              value={feeOriginal}
            />
            <AppText className={LABEL_CLASS}>{t('אחוז הנחה (0–100)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setFeeDiscount}
              style={inputStyle()}
              value={feeDiscount}
            />
            {effectiveFeePreview !== null ? (
              <AppText className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                {t('דמי כרטיס בפועל: {{amount}} ₪', {
                  amount: effectiveFeePreview.toLocaleString('he-IL', {
                    maximumFractionDigits: 2,
                  }),
                })}
              </AppText>
            ) : null}
            <AppText className={LABEL_CLASS}>
              {t('תאריך סיום הנחה (YYYY-MM-DD, אופציונלי)')}
            </AppText>
            <TextInput
              className={INPUT_CLASS}
              onChangeText={setFeeEndDate}
              placeholder="2026-12-31"
              placeholderTextColor="#94A3B8"
              style={inputStyle()}
              value={feeEndDate}
            />

            {/* Foreign-currency account */}
            <AppText className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
              {t('חשבון מט"ח')}
            </AppText>
            <View
              className="mt-2 min-h-[48px] flex-row items-center justify-between"
              style={rtl.row}
            >
              <AppText className="text-base text-slate-700 dark:text-slate-200">
                {t('כרטיס מחובר לחשבון מט"ח')}
              </AppText>
              <Switch onValueChange={setHasForeignAccount} value={hasForeignAccount} />
            </View>
            {hasForeignAccount ? (
              <>
                <AppText className={LABEL_CLASS}>{t('מטבע (USD/EUR/GBP)')}</AppText>
                <TextInput
                  autoCapitalize="characters"
                  className={INPUT_CLASS}
                  onChangeText={setForeignCurrency}
                  placeholder="USD"
                  placeholderTextColor="#94A3B8"
                  style={inputStyle()}
                  value={foreignCurrency}
                />
                <AppText className={LABEL_CLASS}>{t('עמלת המרה בנקאית (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setBankFx}
                  style={inputStyle()}
                  value={bankFx}
                />
              </>
            ) : null}

            <AppText className={LABEL_CLASS}>
              {t('תאריך הנפקת הכרטיס (YYYY-MM-DD, אופציונלי)')}
            </AppText>
            <TextInput
              className={INPUT_CLASS}
              onChangeText={setIssuanceDate}
              placeholder="2024-01-01"
              placeholderTextColor="#94A3B8"
              style={inputStyle()}
              value={issuanceDate}
            />

            {saveError !== null ? (
              <AppText className="mt-3 text-sm font-bold text-red-600 dark:text-red-300">
                {saveError}
              </AppText>
            ) : null}
            {saved ? (
              <AppText className="mt-3 text-sm font-bold text-green-700 dark:text-green-300">
                {t('הפרטים נשמרו ✓')}
              </AppText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              className="mt-4 min-h-[50px] items-center justify-center rounded-lg bg-blue-600"
              onPress={handleSave}
            >
              <AppText className="text-center text-base font-extrabold text-white">
                {t('שמור שינויים')}
              </AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              className="mt-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
              onPress={(): void =>
                navigation.navigate('InterestCalculator', { cardId: card.cardId })
              }
            >
              <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
                {t('מחשבון ריבית')}
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
