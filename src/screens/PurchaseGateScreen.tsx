import React, { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { usePurchaseGate } from '../hooks/usePurchaseGate';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { PurchaseGateStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import type { DecisionVerdict } from '../types/decision.types';
import { parseAmount } from '../utils/parseAmount';
import { ACCENT, BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';

type PurchaseGateNavigation = NativeStackNavigationProp<
  PurchaseGateStackParamList,
  'PurchaseGateRoot'
>;

const VERDICT_CLASSES: Record<
  DecisionVerdict,
  {
    readonly banner: string;
    readonly title: string;
  }
> = {
  approved: {
    banner: `${ROLE_SURFACE_BG.positive} ${ROLE_BORDER.positive}`,
    title: 'מאושר',
  },
  warning: {
    banner: `${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory}`,
    title: 'אזהרה',
  },
  blocked: {
    banner: `${ROLE_SURFACE_BG.danger} ${ROLE_BORDER.danger}`,
    title: 'חסום',
  },
  wait_24h: {
    banner: `${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory}`,
    title: 'להמתין 24 שעות',
  },
};

export function PurchaseGateScreen(): React.ReactElement {
  const theme = useTheme();
  const { textAlign, writingDirection } = useAppDirection();
  const { t } = useTranslation();
  const navigation = useNavigation<PurchaseGateNavigation>();
  const hasCards = useCardsStore(state => state.cards.length > 0);
  const {
    setAmount,
    isInternational,
    setIsInternational,
    selectedCardId,
    setSelectedCardId,
    cards,
    verdict,
    decision,
    exchangeFeeWarning,
    fxComparison,
    evaluate,
  } = usePurchaseGate();
  const [amountText, setAmountText] = useState('');

  const parsedAmount = parseAmount(amountText);
  const isAmountInvalid = amountText.trim().length > 0 && parsedAmount === null;
  const isSubmitDisabled = parsedAmount === null;
  const verdictClass = verdict === null ? null : VERDICT_CLASSES[verdict];
  const shouldShowExchangeWarning =
    isInternational &&
    (verdict === 'approved' || verdict === 'warning') &&
    exchangeFeeWarning !== null;

  function handleEvaluate(): void {
    if (parsedAmount === null) {
      return;
    }

    setAmount(parsedAmount);
    // Carry the engine's own reason through to the Decision screen.
    // MVP_SCOPE §4: reasons are shown from the actual engine output.
    const nextDecision = evaluate();
    navigation.navigate('Decision', {
      verdict: nextDecision.verdict,
      reason: nextDecision.reason,
      ...(nextDecision.exchangeFeeWarning === undefined
        ? {}
        : { exchangeFeeWarning: nextDecision.exchangeFeeWarning }),
      fxComparison,
    });
  }

  function handleAmountChange(value: string): void {
    setAmountText(value);

    const nextAmount = parseAmount(value);
    if (nextAmount !== null) {
      setAmount(nextAmount);
    }
  }

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={`min-h-full w-full p-5 ${SURFACE.pageDarkOnly}`}>
          <View className="mb-5 w-full items-stretch">
            <AppText
              className={`text-3xl font-extrabold ${TEXT.heading}`}
              style={[
                {
                  textDecorationColor: theme.bankColor,
                  textDecorationLine: 'underline',
                },
              ]}
            >
              {t('בדיקת רכישה')}
            </AppText>
            <AppText
              className={`mt-1.5 text-base leading-6 ${TEXT.secondary}`}
            >
              {t('בדקו אם הרכישה מתאימה לתזרים הנוכחי.')}
            </AppText>
          </View>

          {hasCards ? (
            <>
              <RtlRow
                accessibilityRole="tablist"
                className={`mb-6 gap-2 rounded-lg p-1 ${SURFACE.sunken}`}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !isInternational }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-md ${
                    !isInternational ? `${SURFACE.card}` : ''
                  }`}
                  onPress={(): void => setIsInternational(false)}
                >
                  <AppText
                    className={`text-center text-base font-bold ${ !isInternational ? `${TEXT.heading}` : `${TEXT.secondary}` }`}
                  >
                    {t('בארץ 🇮🇱')}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isInternational }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-md ${
                    isInternational ? `${SURFACE.card}` : ''
                  }`}
                  onPress={(): void => setIsInternational(true)}
                >
                  <AppText
                    className={`text-center text-base font-bold ${ isInternational ? `${TEXT.heading}` : `${TEXT.secondary}` }`}
                  >
                    {t('חו"ל ✈️')}
                  </AppText>
                </Pressable>
              </RtlRow>

              {cards.length > 0 ? (
                <View className="mb-5 w-full">
                  <AppText
                    className={`mb-2 text-sm font-bold ${TEXT.body}`}
                  >
                    {t('בחר כרטיס', undefined, 'Choose a card')}
                  </AppText>
                  <RtlRow
                    accessibilityRole="tablist"
                    className="flex-wrap gap-2"
                  >
                    {cards.map(card => {
                      const isSelected = card.cardId === selectedCardId;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          className={`min-h-11 items-center justify-center rounded-md border px-3 ${
                            isSelected
                              ? `${ACCENT.border} ${SURFACE.card}`
                              : `border-transparent ${SURFACE.sunken}`
                          }`}
                          key={card.cardId}
                          onPress={(): void => setSelectedCardId(card.cardId)}
                        >
                          <AppText
                            className={`text-center text-sm font-bold ${
                              isSelected
                                ? `${TEXT.heading}`
                                : `${TEXT.secondary}`
                            }`}
                          >
                            {card.displayName}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </RtlRow>
                </View>
              ) : null}

              <View className="mb-5 w-full">
                <AppText
                  className={`mb-2 text-sm font-bold ${TEXT.body}`}
                >
                  {t('סכום הרכישה')}
                </AppText>
                <RtlRow className={`min-h-[54px] items-center rounded-lg border px-3.5 ${BORDER.hairline} ${SURFACE.card}`}>
                  <AppText
                    className={`ms-2 text-xl font-extrabold ${TEXT.heading}`}
                  >
                    ₪
                  </AppText>
                  <TextInput
                    accessibilityLabel={t('סכום הרכישה')}
                    className={`min-h-[52px] flex-1 p-0 text-xl ${TEXT.heading}`}
                    keyboardType="numeric"
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    style={{ textAlign, writingDirection }}
                    value={amountText}
                  />
                </RtlRow>
                {isAmountInvalid ? (
                  <AppText
                    className={`mt-1.5 text-sm font-bold ${ROLE_TEXT.danger}`}
                  >
                    {t('סכום לא תקין')}
                  </AppText>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitDisabled }}
                className={`min-h-[50px] items-center justify-center rounded-lg ${
                  isSubmitDisabled ? `${SURFACE.raised}` : `${ACCENT.solid}`
                }`}
                disabled={isSubmitDisabled}
                onPress={handleEvaluate}
                style={
                  isSubmitDisabled
                    ? undefined
                    : { backgroundColor: theme.companyAccent }
                }
              >
                <AppText
                  className={`text-center text-base font-extrabold ${TEXT.onAccent}`}
                >
                  {t('בדוק רכישה')}
                </AppText>
              </Pressable>
            </>
          ) : (
            <View className={`rounded-lg border p-[18px] ${ROLE_BORDER.advisory} ${ROLE_SURFACE_BG.advisory}`}>
              <AppText
                className={`text-lg font-extrabold ${ROLE_TEXT.advisory}`}
              >
                {t('לא נמצאו כרטיסים — הוסף כרטיס תחילה')}
              </AppText>
            </View>
          )}

          <View className="mt-6 min-h-[150px] w-full">
            {verdictClass === null || decision === null ? (
              <AppText
                className={`rounded-lg border p-[18px] text-base leading-6 ${BORDER.hairline} ${SURFACE.card} ${TEXT.muted}`}
              >
                {t('ההחלטה תופיע כאן אחרי הבדיקה.')}
              </AppText>
            ) : (
              <View className={`rounded-lg border p-[18px] ${verdictClass.banner}`}>
                <AppText
                  className={`text-xl font-extrabold ${TEXT.heading}`}
                >
                  {t(verdictClass.title)}
                </AppText>
                <AppText
                  className={`mt-1.5 text-base leading-6 ${TEXT.heading}`}
                >
                  {t(decision.reason)}
                </AppText>
              </View>
            )}

            {shouldShowExchangeWarning ? (
              <AppText
                className={`mt-3 rounded-lg p-3.5 text-sm leading-5 ${ROLE_SURFACE_BG.advisory} ${ROLE_TEXT.advisory}`}
              >
                {t(exchangeFeeWarning)}
              </AppText>
            ) : null}
          </View>
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
