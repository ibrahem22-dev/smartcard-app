import React, { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  Alert,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useMoney } from '../hooks/useMoney';
import { TABULAR_NUMERALS } from '../utils/money';
import { useCardsStore } from '../store/useCardsStore';
import { useTranslation } from '../hooks/useTranslation';
import type { ImportedInstallment } from '../types/installment.types';
import { parseAmount } from '../utils/parseAmount';
import { ACCENT, BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';

function parseMonths(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 360
    ? parsed
    : null;
}

export function InstallmentImportScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const { textAlign, writingDirection } = useAppDirection();
  const cards = useCardsStore(state => state.cards);
  const obligations = useCardsStore(state => state.obligations);
  const hydrate = useCardsStore(state => state.hydrate);
  const addObligation = useCardsStore(state => state.addObligation);
  const updateObligation = useCardsStore(state => state.updateObligation);
  const deleteObligation = useCardsStore(state => state.deleteObligation);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [totalAmountText, setTotalAmountText] = useState('');
  const [monthsRemainingText, setMonthsRemainingText] = useState('');
  const [monthlyPaymentText, setMonthlyPaymentText] = useState('');
  const [billingCardId, setBillingCardId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function resetForm(): void {
    setEditingId(null);
    setMerchantName('');
    setTotalAmountText('');
    setMonthsRemainingText('');
    setMonthlyPaymentText('');
    setBillingCardId('');
    setNotes('');
    setFormError(null);
  }

  function beginEdit(obligation: ImportedInstallment): void {
    setEditingId(obligation.installmentId);
    setMerchantName(obligation.merchantName);
    setTotalAmountText(String(obligation.totalAmount));
    setMonthsRemainingText(String(obligation.monthsRemaining));
    setMonthlyPaymentText(String(obligation.monthlyPayment));
    setBillingCardId(obligation.billingCardId);
    setNotes(obligation.notes ?? '');
    setFormError(null);
  }

  function saveObligation(): void {
    const totalAmount = parseAmount(totalAmountText);
    const monthlyPayment = parseAmount(monthlyPaymentText);
    const monthsRemaining = parseMonths(monthsRemainingText);

    if (
      merchantName.trim() === '' ||
      totalAmount === null ||
      monthlyPayment === null ||
      monthsRemaining === null ||
      billingCardId === ''
    ) {
      setFormError(
        t(
          'יש למלא את כל שדות החובה. סכומים עד 999,999 ₪ ומספר חודשים בין 1 ל־360.',
        ),
      );
      return;
    }

    const installmentId = editingId ?? Crypto.randomUUID();
    const trimmedNotes = notes.trim();
    const obligation: ImportedInstallment =
      trimmedNotes === ''
        ? {
            installmentId,
            merchantName: merchantName.trim(),
            totalAmount,
            monthsRemaining,
            monthlyPayment,
            billingCardId,
            source: 'imported',
          }
        : {
            installmentId,
            merchantName: merchantName.trim(),
            totalAmount,
            monthsRemaining,
            monthlyPayment,
            billingCardId,
            notes: trimmedNotes,
            source: 'imported',
          };

    if (editingId === null) {
      addObligation(obligation);
    } else {
      updateObligation(editingId, obligation);
    }
    resetForm();
  }

  function confirmDelete(obligation: ImportedInstallment): void {
    Alert.alert(
      t('מחיקת תשלומים'),
      t('למחוק את התשלומים של {{name}}?', {
        name: obligation.merchantName,
      }),
      [
        { text: t('ביטול'), style: 'cancel' },
        {
          text: t('מחיקה'),
          style: 'destructive',
          onPress: (): void => {
            deleteObligation(obligation.installmentId);
            if (editingId === obligation.installmentId) {
              resetForm();
            }
          },
        },
      ],
    );
  }

  const inputStyle = { textAlign, writingDirection };

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full gap-3 p-4">
          <AppText
            className={`text-2xl font-black ${TEXT.heading}`}
          >
            {t('תשלומים קיימים')}
          </AppText>

          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
          >
            {t('שם בית העסק')}
          </AppText>
          <TextInput
            className={`min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            onChangeText={setMerchantName}
            style={inputStyle}
            value={merchantName}
          />

          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
          >
            {t('סכום כולל (₪)')}
          </AppText>
          <TextInput
            className={`min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            keyboardType="decimal-pad"
            onChangeText={setTotalAmountText}
            style={inputStyle}
            value={totalAmountText}
          />

          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
          >
            {t('חודשים שנותרו')}
          </AppText>
          <TextInput
            className={`min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            keyboardType="number-pad"
            onChangeText={setMonthsRemainingText}
            style={inputStyle}
            value={monthsRemainingText}
          />

          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
          >
            {t('תשלום חודשי (₪)')}
          </AppText>
          <TextInput
            className={`min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            keyboardType="decimal-pad"
            onChangeText={setMonthlyPaymentText}
            style={inputStyle}
            value={monthlyPaymentText}
          />

          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
          >
            {t('כרטיס לחיוב')}
          </AppText>
          <RtlRow className="flex-wrap gap-2">
            {cards.map(card => {
              const isSelected = billingCardId === card.cardId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`min-h-[46px] min-w-28 items-center justify-center rounded-lg border px-3 ${
                    isSelected
                      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                      : `${BORDER.hairline} ${SURFACE.card}`
                  }`}
                  key={card.cardId}
                  onPress={(): void => setBillingCardId(card.cardId)}
                >
                  <AppText
                    className={`text-center text-sm font-extrabold ${TEXT.heading}`}
                  >
                    {card.displayName} · {card.last4}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>
          {cards.length === 0 ? (
            <AppText
              className={`text-sm font-bold ${ROLE_TEXT.advisory}`}
            >
              {t('יש להוסיף כרטיס לפני ייבוא תשלומים.')}
            </AppText>
          ) : null}

          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
          >
            {t('הערות (אופציונלי)')}
          </AppText>
          <TextInput
            className={`min-h-20 rounded-lg border px-4 py-3 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            multiline
            onChangeText={setNotes}
            style={inputStyle}
            value={notes}
          />

          {formError !== null ? (
            <AppText
              className={`text-sm font-bold ${ROLE_TEXT.danger}`}
            >
              {formError}
            </AppText>
          ) : null}

          <RtlRow className="gap-2">
            <Pressable
              accessibilityRole="button"
              className={`min-h-[50px] flex-1 items-center justify-center rounded-lg ${ACCENT.solid}`}
              onPress={saveObligation}
            >
              <AppText
                className={`text-center text-base font-extrabold ${TEXT.onAccent}`}
              >
                {editingId === null
                  ? t('הוסף תשלומים')
                  : t('שמור שינויים')}
              </AppText>
            </Pressable>
            {editingId !== null ? (
              <Pressable
                accessibilityRole="button"
                className={`min-h-[50px] items-center justify-center rounded-lg border px-4 ${BORDER.hairline}`}
                onPress={resetForm}
              >
                <AppText
                  className={`text-center text-base font-bold ${TEXT.body}`}
                >
                  {t('ביטול')}
                </AppText>
              </Pressable>
            ) : null}
          </RtlRow>

          <View className="mt-4 gap-3">
            {obligations.map(obligation => (
              <View
                className={`rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
                key={obligation.installmentId}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={(): void => beginEdit(obligation)}
                >
                  <AppText
                    className={`text-lg font-extrabold ${TEXT.heading}`}
                  >
                    {obligation.merchantName}
                  </AppText>
                  <AppText
                    className={`mt-1 text-sm ${TEXT.secondary}`}
                    style={TABULAR_NUMERALS}
                  >
                    {money(obligation.monthlyPayment)} ·{' '}
                    {t('{{count}} חודשים נותרו', {
                      count: obligation.monthsRemaining,
                    })}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className={`mt-3 min-h-[44px] items-center justify-center rounded-lg border ${ROLE_BORDER.danger} ${ROLE_SURFACE_BG.danger}`}
                  onPress={(): void => confirmDelete(obligation)}
                >
                  <AppText
                    className={`text-center text-sm font-extrabold ${ROLE_TEXT.danger}`}
                  >
                    {t('מחיקה')}
                  </AppText>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
