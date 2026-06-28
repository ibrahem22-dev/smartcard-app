import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useCardDatabaseRates } from '../hooks/useCardRatesDatabase';
import { useTranslation } from '../hooks/useTranslation';
import type { CardsStackParamList } from '../navigation/types';
import { scheduleDiscountReminders } from '../services/notificationScheduler';
import { useCardsStore } from '../store/useCardsStore';
import {
  CardIssuer,
  type CardFeeInfo,
  type CardInput,
  type CardRates,
} from '../types/card.types';

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

function formatLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month &&
    parsed.getDate() === day
    ? parsed
    : null;
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
  const { textAlign, writingDirection } = useAppDirection();
  const card = useCardsStore(state =>
    state.cards.find(c => c.cardId === route.params.cardId),
  );
  const updateCard = useCardsStore(state => state.updateCard);

  const rates: CardRates | undefined = card?.cardRates;
  const databaseRates = useCardDatabaseRates(card);
  const fee: CardFeeInfo | undefined = card?.cardFee;

  // --- editable state (initialized from the card) ---
  const [billingDay, setBillingDay] = useState(
    card ? String(card.billingCycle.billingDayOfMonth) : '',
  );
  const [creditLimit, setCreditLimit] = useState(
    card ? String(card.framework.creditLimit) : '',
  );
  const [hasRates, setHasRates] = useState(
    rates !== undefined || databaseRates !== null,
  );
  const [creditRate, setCreditRate] = useState(
    rates !== undefined
      ? String(rates.creditInterestRate)
      : databaseRates?.creditInterestRate === null ||
          databaseRates?.creditInterestRate === undefined
        ? ''
        : String(databaseRates.creditInterestRate),
  );
  const [installmentRate, setInstallmentRate] = useState(
    rates !== undefined
      ? String(rates.installmentInterestRate)
      : databaseRates?.installmentInterestRate === null ||
          databaseRates?.installmentInterestRate === undefined
        ? ''
        : String(databaseRates.installmentInterestRate),
  );
  const [cardLoanRate, setCardLoanRate] = useState(
    rates !== undefined
      ? String(rates.cardLoanInterestRate)
      : databaseRates?.cardLoanInterestRate === null ||
          databaseRates?.cardLoanInterestRate === undefined
        ? ''
        : String(databaseRates.cardLoanInterestRate),
  );
  const [fxCommission, setFxCommission] = useState(
    rates !== undefined
      ? String(rates.foreignExchangeCommission)
      : databaseRates?.foreignExchangeCommission === null ||
          databaseRates?.foreignExchangeCommission === undefined
        ? ''
        : String(databaseRates.foreignExchangeCommission),
  );
  const [monthlyFee, setMonthlyFee] = useState(
    rates !== undefined
      ? String(rates.monthlyFee)
      : databaseRates?.monthlyFee === null ||
          databaseRates?.monthlyFee === undefined
        ? ''
        : String(databaseRates.monthlyFee),
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
    fee
      ? String(fee.originalFee)
      : String(rates?.monthlyFee ?? databaseRates?.monthlyFee ?? 0),
  );
  const [feeDiscount, setFeeDiscount] = useState(
    fee ? String(fee.discountPercent) : '0',
  );
  const [feeEndDate, setFeeEndDate] = useState(fee?.discountEndDate ?? '');
  const [annualReminder, setAnnualReminder] = useState(
    fee !== undefined &&
      fee.discountEndDate === undefined &&
      card?.cardIssuanceDate !== undefined,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const inputStyle = { textAlign, writingDirection };

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

  async function handleSave(): Promise<void> {
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
      const hasInvalidEnteredRate =
        (creditRate.trim() !== '' && credit === null) ||
        (installmentRate.trim() !== '' && installment === null) ||
        (cardLoanRate.trim() !== '' && cardLoan === null) ||
        (fxCommission.trim() !== '' && fx === null) ||
        (monthlyFee.trim() !== '' && mFee === null);
      if (hasInvalidEnteredRate) {
        setSaveError(
          t('שיעורי הריבית חייבים להיות 0–30%, עמלת המרה 0–10%, דמי כרטיס תקינים.'),
        );
        return;
      }
      if (
        credit !== null &&
        installment !== null &&
        cardLoan !== null &&
        fx !== null &&
        mFee !== null
      ) {
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

    const parsedIssuanceDate =
      issuanceDate.trim() === '' ? null : parseLocalISO(issuanceDate.trim());
    if (issuanceDate.trim() !== '' && parsedIssuanceDate === null) {
      setSaveError(t('יש להזין תאריך הנפקת כרטיס תקין.'));
      return;
    }
    if (parsedIssuanceDate !== null) {
      updates = {
        ...updates,
        cardIssuanceDate: formatLocalISO(parsedIssuanceDate),
      };
    }

    const original = parseBounded(feeOriginal, 0, 999_999);
    const discount = parseBounded(feeDiscount, 0, 100);
    if (original === null || discount === null) {
      setSaveError(t('אחוז ההנחה חייב להיות בין 0 ל-100 ודמי הכרטיס חייבים להיות תקינים.'));
      return;
    }
    const parsedEndDate = annualReminder
      ? null
      : parseLocalISO(feeEndDate.trim());
    if (!annualReminder && parsedEndDate === null) {
      setSaveError(t('יש לבחור תאריך סיום הנחה תקין.'));
      return;
    }
    if (
      parsedEndDate !== null &&
      parsedEndDate.getTime() <= new Date().setHours(0, 0, 0, 0)
    ) {
      setSaveError(t('תאריך סיום ההנחה חייב להיות בעתיד.'));
      return;
    }
    if (annualReminder && parsedIssuanceDate === null) {
      setSaveError(t('לתזכורת שנתית יש להזין תאריך הנפקת כרטיס תקין.'));
      return;
    }
    const feeInfo: CardFeeInfo = {
      originalFee: original,
      discountPercent: discount,
      effectiveFee: Math.round(original * (1 - discount / 100) * 100) / 100,
      discountSource: 'manual',
      ...(parsedEndDate === null
        ? {}
        : { discountEndDate: formatLocalISO(parsedEndDate) }),
    };
    updates = { ...updates, cardFee: feeInfo };

    updateCard(card.cardId, updates);
    try {
      await scheduleDiscountReminders({ ...card, ...updates });
      setSaveError(null);
      setSaved(true);
    } catch {
      setSaveError(t('הפרטים נשמרו, אך לא ניתן היה לתזמן את התזכורת.'));
    }
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
        <RtlScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
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
              style={inputStyle}
              value={billingDay}
            />

            <AppText className={LABEL_CLASS}>{t('מסגרת אשראי (₪)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setCreditLimit}
              style={inputStyle}
              value={creditLimit}
            />

            {/* Rates */}
            <AppText className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
              {t('שיעורי ריבית ועמלות')}
            </AppText>
            {rates === undefined && databaseRates !== null ? (
              <AppText className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                {t('ערכים ממאגר תעריפי הכרטיסים')}
              </AppText>
            ) : null}

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
                  placeholder={t('לא פורסם — הזן ידנית')}
                  placeholderTextColor="#94A3B8"
                  style={inputStyle}
                  value={creditRate}
                />
                <AppText className={LABEL_CLASS}>{t('ריבית תשלומים (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setInstallmentRate}
                  placeholder={t('לא פורסם — הזן ידנית')}
                  placeholderTextColor="#94A3B8"
                  style={inputStyle}
                  value={installmentRate}
                />
                <AppText className={LABEL_CLASS}>{t('ריבית הלוואה (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setCardLoanRate}
                  placeholder={t('לא פורסם — הזן ידנית')}
                  placeholderTextColor="#94A3B8"
                  style={inputStyle}
                  value={cardLoanRate}
                />
                <AppText className={LABEL_CLASS}>{t('עמלת המרה (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setFxCommission}
                  style={inputStyle}
                  value={fxCommission}
                />
                <AppText className={LABEL_CLASS}>{t('דמי כרטיס חודשיים (₪)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setMonthlyFee}
                  style={inputStyle}
                  value={monthlyFee}
                />

                <AppText className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('המידע מוצג לנוחות — בדוק מול חברת הכרטיסים. עודכן: {{date}}', {
                    date:
                      rates?.lastUpdated ??
                      databaseRates?.lastUpdated ??
                      todayISO(),
                  })}
                </AppText>
              </>
            )}

            {/* Card fee / discount */}
            <AppText className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
              {t('הנחת דמי כרטיס')}
            </AppText>
            <AppText className={LABEL_CLASS}>{t('דמי כרטיס מקוריים (₪)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setFeeOriginal}
              style={inputStyle}
              value={feeOriginal}
            />
            <AppText className={LABEL_CLASS}>{t('אחוז הנחה (0–100)')}</AppText>
            <TextInput
              className={INPUT_CLASS}
              keyboardType="decimal-pad"
              onChangeText={setFeeDiscount}
              style={inputStyle}
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
            <RtlRow className="mt-3 min-h-[48px] items-center justify-between">
              <AppText className="me-3 flex-1 text-base text-slate-700 dark:text-slate-200">
                {t('לא ידוע — תזכיר שנתי')}
              </AppText>
              <Switch
                onValueChange={(enabled: boolean): void => {
                  setAnnualReminder(enabled);
                  setShowDatePicker(false);
                  if (enabled) setFeeEndDate('');
                }}
                value={annualReminder}
              />
            </RtlRow>
            {!annualReminder ? (
              <>
                <AppText className={LABEL_CLASS}>
                  {t('תאריך סיום ההנחה')}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[48px] justify-center rounded-lg border border-slate-300 bg-white px-4 shadow-sm dark:border-neutral-700 dark:bg-dark-surface"
                  onPress={(): void => setShowDatePicker(true)}
                >
                  <AppText className="text-base text-slate-900 dark:text-white">
                    {feeEndDate === ''
                      ? t('בחר תאריך')
                      : feeEndDate}
                  </AppText>
                </Pressable>
                {showDatePicker ? (
                  <DateTimePicker
                    minimumDate={new Date()}
                    mode="date"
                    onChange={(
                      event: DateTimePickerEvent,
                      selectedDate?: Date,
                    ): void => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (event.type === 'set' && selectedDate !== undefined) {
                        setFeeEndDate(formatLocalISO(selectedDate));
                      }
                    }}
                    value={parseLocalISO(feeEndDate) ?? new Date()}
                  />
                ) : null}
              </>
            ) : null}

            {/* Foreign-currency account */}
            <AppText className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
              {t('חשבון מט"ח')}
            </AppText>
            <RtlRow className="mt-2 min-h-[48px] items-center justify-between">
              <AppText className="text-base text-slate-700 dark:text-slate-200">
                {t('כרטיס מחובר לחשבון מט"ח')}
              </AppText>
              <Switch onValueChange={setHasForeignAccount} value={hasForeignAccount} />
            </RtlRow>
            {hasForeignAccount ? (
              <>
                <AppText className={LABEL_CLASS}>{t('מטבע (USD/EUR/GBP)')}</AppText>
                <TextInput
                  autoCapitalize="characters"
                  className={INPUT_CLASS}
                  onChangeText={setForeignCurrency}
                  placeholder="USD"
                  placeholderTextColor="#94A3B8"
                  style={inputStyle}
                  value={foreignCurrency}
                />
                <AppText className={LABEL_CLASS}>{t('עמלת המרה בנקאית (%)')}</AppText>
                <TextInput
                  className={INPUT_CLASS}
                  keyboardType="decimal-pad"
                  onChangeText={setBankFx}
                  style={inputStyle}
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
              style={inputStyle}
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
              onPress={(): void => {
                void handleSave();
              }}
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
        </RtlScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
