import React, { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '../components/AppText';
import { useCardsStore } from '../store/useCardsStore';
import { useTranslation } from '../hooks/useTranslation';
import type { ImportedInstallment } from '../types/installment.types';
import { parseAmount } from '../utils/parseAmount';
import { inputStyle, rtl } from '../utils/rtlStyles';

function parseMonths(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 360
    ? parsed
    : null;
}

export function InstallmentImportScreen(): React.ReactElement {
  const { t } = useTranslation();
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

  return (
    <View className="flex-1 bg-slate-50 dark:bg-app-dark" style={rtl.screen}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        keyboardShouldPersistTaps="handled"
        style={rtl.scrollOuter}
      >
        <View className="w-full gap-3 p-5">
          <AppText
            className="text-2xl font-black text-slate-900 dark:text-white"
          >
            {t('תשלומים קיימים')}
          </AppText>

          <AppText
            className="text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('שם בית העסק')}
          </AppText>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            onChangeText={setMerchantName}
            style={inputStyle()}
            value={merchantName}
          />

          <AppText
            className="text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('סכום כולל (₪)')}
          </AppText>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            keyboardType="decimal-pad"
            onChangeText={setTotalAmountText}
            style={inputStyle()}
            value={totalAmountText}
          />

          <AppText
            className="text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('חודשים שנותרו')}
          </AppText>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            keyboardType="number-pad"
            onChangeText={setMonthsRemainingText}
            style={inputStyle()}
            value={monthsRemainingText}
          />

          <AppText
            className="text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('תשלום חודשי (₪)')}
          </AppText>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            keyboardType="decimal-pad"
            onChangeText={setMonthlyPaymentText}
            style={inputStyle()}
            value={monthlyPaymentText}
          />

          <AppText
            className="text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('כרטיס לחיוב')}
          </AppText>
          <View className="flex-row flex-wrap gap-2" style={rtl.row}>
            {cards.map(card => {
              const isSelected = billingCardId === card.cardId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`min-h-[46px] min-w-28 items-center justify-center rounded-lg border px-3 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                      : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-dark-surface'
                  }`}
                  key={card.cardId}
                  onPress={(): void => setBillingCardId(card.cardId)}
                >
                  <AppText
                    className="text-center text-sm font-extrabold text-slate-800 dark:text-slate-100"
                  >
                    {card.displayName} · {card.last4}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {cards.length === 0 ? (
            <AppText
              className="text-sm font-bold text-amber-700 dark:text-amber-300"
            >
              {t('יש להוסיף כרטיס לפני ייבוא תשלומים.')}
            </AppText>
          ) : null}

          <AppText
            className="text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            {t('הערות (אופציונלי)')}
          </AppText>
          <TextInput
            className="min-h-20 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            multiline
            onChangeText={setNotes}
            style={inputStyle()}
            value={notes}
          />

          {formError !== null ? (
            <AppText
              className="text-sm font-bold text-red-600 dark:text-red-300"
            >
              {formError}
            </AppText>
          ) : null}

          <View className="flex-row gap-2" style={rtl.row}>
            <Pressable
              accessibilityRole="button"
              className="min-h-[50px] flex-1 items-center justify-center rounded-lg bg-blue-600"
              onPress={saveObligation}
            >
              <AppText
                className="text-center text-base font-extrabold text-white"
              >
                {editingId === null
                  ? t('הוסף תשלומים')
                  : t('שמור שינויים')}
              </AppText>
            </Pressable>
            {editingId !== null ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-[50px] items-center justify-center rounded-lg border border-slate-300 px-4 dark:border-neutral-700"
                onPress={resetForm}
              >
                <AppText
                  className="text-center text-base font-bold text-slate-700 dark:text-slate-200"
                >
                  {t('ביטול')}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <View className="mt-4 gap-3">
            {obligations.map(obligation => (
              <View
                className="rounded-lg border border-slate-300 bg-white p-4 dark:border-neutral-700 dark:bg-dark-surface"
                key={obligation.installmentId}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={(): void => beginEdit(obligation)}
                >
                  <AppText
                    className="text-lg font-extrabold text-slate-900 dark:text-white"
                  >
                    {obligation.merchantName}
                  </AppText>
                  <AppText
                    className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                  >
                    {obligation.monthlyPayment.toLocaleString('he-IL')} ₪ ·{' '}
                    {t('{{count}} חודשים נותרו', {
                      count: obligation.monthsRemaining,
                    })}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="mt-3 min-h-[42px] items-center justify-center rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"
                  onPress={(): void => confirmDelete(obligation)}
                >
                  <AppText
                    className="text-center text-sm font-extrabold text-red-700 dark:text-red-200"
                  >
                    {t('מחיקה')}
                  </AppText>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
