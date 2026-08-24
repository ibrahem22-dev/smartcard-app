import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import { useCardsStore } from '../store/useCardsStore';
import { CardIssuer } from '../types/card.types';
import type { WalletStackParamList } from '../navigation/types';
import { createManualCard } from '../utils/manualCard';
import { parseAmount } from '../utils/parseAmount';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';

type AddCardNavigation = NativeStackNavigationProp<
  WalletStackParamList,
  'AddCard'
>;

const ISSUER_OPTIONS: readonly { value: CardIssuer; label: string }[] = [
  { value: CardIssuer.Max, label: 'Max' },
  { value: CardIssuer.Isracard, label: 'Isracard' },
  { value: CardIssuer.Cal, label: 'CAL' },
];

function parseDayOfMonth(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31
    ? parsed
    : null;
}

/** Parses an optional FX-fee percent input into a fraction. Returns:
 *  - a fraction (0-1) when a valid percent is entered,
 *  - undefined when left blank (stays unknown),
 *  - null when the input is present but invalid. */
function parseFeePercent(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed.replace(/[%\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed / 100
    : null;
}

export function AddCardScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const navigation = useNavigation<AddCardNavigation>();
  const addCard = useCardsStore(state => state.addCard);

  const [displayName, setDisplayName] = useState('');
  const [issuer, setIssuer] = useState<CardIssuer | null>(null);
  const [last4, setLast4] = useState('');
  const [creditLimitText, setCreditLimitText] = useState('');
  const [currentBalanceText, setCurrentBalanceText] = useState('');
  const [billingDayText, setBillingDayText] = useState('');
  const [feePercentText, setFeePercentText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function saveCard(): void {
    const creditLimit = parseAmount(creditLimitText);
    const currentBalance = parseAmount(currentBalanceText);
    const fee = parseFeePercent(feePercentText);
    const billingDay =
      billingDayText.trim() === '' ? undefined : parseDayOfMonth(billingDayText);

    if (
      displayName.trim() === '' ||
      issuer === null ||
      !/^\d{4}$/.test(last4) ||
      creditLimit === null ||
      currentBalance === null ||
      billingDay === null ||
      fee === null
    ) {
      setFormError(
        t(
          'יש למלא שם, מנפיק, 4 ספרות, מסגרת וחיוב תקינים. יום חיוב 1–31 ועמלת מט"ח 0–100% הם אופציונליים.',
        ),
      );
      return;
    }

    const card = createManualCard({
      displayName: displayName.trim(),
      last4,
      issuer,
      creditLimit,
      currentBalance,
      ...(billingDay === undefined ? {} : { billingDayOfMonth: billingDay }),
      ...(fee === undefined ? {} : { foreignTransactionFee: fee }),
    });

    addCard(card);
    navigation.goBack();
  }

  const inputStyle = { textAlign, writingDirection };
  const inputClass =
    `min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`;
  const labelClass =
    `text-sm font-bold ${TEXT.body}`;

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full gap-3 p-5">
          <AppText className={`text-2xl font-black ${TEXT.heading}`}>
            {t('הוסף כרטיס')}
          </AppText>

          <AppText className={labelClass}>{t('שם הכרטיס')}</AppText>
          <TextInput
            className={inputClass}
            onChangeText={setDisplayName}
            style={inputStyle}
            value={displayName}
          />

          <AppText className={labelClass}>{t('חברת האשראי')}</AppText>
          <RtlRow className="flex-wrap gap-2">
            {ISSUER_OPTIONS.map(option => {
              const isSelected = issuer === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`min-h-[46px] min-w-24 items-center justify-center rounded-lg border px-3 ${
                    isSelected
                      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                      : `${BORDER.hairline} ${SURFACE.card}`
                  }`}
                  key={option.value}
                  onPress={(): void => setIssuer(option.value)}
                >
                  <AppText className={`text-center text-sm font-extrabold ${TEXT.heading}`}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>

          <AppText className={labelClass}>{t('4 ספרות אחרונות')}</AppText>
          <TextInput
            className={inputClass}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setLast4}
            style={inputStyle}
            value={last4}
          />

          <AppText className={labelClass}>{t('מסגרת אשראי (₪)')}</AppText>
          <TextInput
            className={inputClass}
            keyboardType="decimal-pad"
            onChangeText={setCreditLimitText}
            style={inputStyle}
            value={creditLimitText}
          />

          <AppText className={labelClass}>{t('חיוב נוכחי (₪)')}</AppText>
          <TextInput
            className={inputClass}
            keyboardType="decimal-pad"
            onChangeText={setCurrentBalanceText}
            style={inputStyle}
            value={currentBalanceText}
          />

          <AppText className={labelClass}>
            {t('יום חיוב בחודש (אופציונלי)')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={setBillingDayText}
            style={inputStyle}
            value={billingDayText}
          />

          <AppText className={labelClass}>
            {t('עמלת המרת מט"ח % (אופציונלי)')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="decimal-pad"
            onChangeText={setFeePercentText}
            style={inputStyle}
            value={feePercentText}
          />
          <AppText className={`text-xs font-bold ${TEXT.muted}`}>
            {t('שדות לא ידועים נשארים לא ידועים — האפליקציה לא תמציא ערך.')}
          </AppText>

          {formError !== null ? (
            <AppText className={`text-sm font-bold ${ROLE_TEXT.danger}`}>
              {formError}
            </AppText>
          ) : null}

          <Pressable
            accessibilityRole="button"
            className={`mt-2 min-h-[50px] items-center justify-center rounded-lg ${ACCENT.solid}`}
            onPress={saveCard}
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
              {t('שמור כרטיס')}
            </AppText>
          </Pressable>
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
