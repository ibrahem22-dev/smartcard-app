import React, { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useCardsStore } from '../store/useCardsStore';
import type { ImportedInstallment } from '../types/installment.types';
import { parseAmount } from '../utils/parseAmount';
import { rtl } from '../utils/rtlStyles';

function parseMonths(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 360
    ? parsed
    : null;
}

export function InstallmentImportScreen(): React.ReactElement {
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
        'יש למלא את כל שדות החובה. סכומים עד 999,999 ₪ ומספר חודשים בין 1 ל־360.',
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
      'מחיקת תשלומים',
      `למחוק את התשלומים של ${obligation.merchantName}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחיקה',
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
          <Text
            className="text-right text-2xl font-black text-slate-900 dark:text-white"
            style={rtl.text}
          >
            תשלומים קיימים
          </Text>

          <Text
            className="text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            שם בית העסק
          </Text>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-right text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            onChangeText={setMerchantName}
            style={rtl.input}
            value={merchantName}
          />

          <Text
            className="text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            סכום כולל (₪)
          </Text>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-right text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            keyboardType="decimal-pad"
            onChangeText={setTotalAmountText}
            style={rtl.input}
            value={totalAmountText}
          />

          <Text
            className="text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            חודשים שנותרו
          </Text>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-right text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            keyboardType="number-pad"
            onChangeText={setMonthsRemainingText}
            style={rtl.input}
            value={monthsRemainingText}
          />

          <Text
            className="text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            תשלום חודשי (₪)
          </Text>
          <TextInput
            className="min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-right text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            keyboardType="decimal-pad"
            onChangeText={setMonthlyPaymentText}
            style={rtl.input}
            value={monthlyPaymentText}
          />

          <Text
            className="text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            כרטיס לחיוב
          </Text>
          <View className="flex-row-reverse flex-wrap gap-2" style={rtl.row}>
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
                  <Text
                    className="text-center text-sm font-extrabold text-slate-800 dark:text-slate-100"
                    style={rtl.text}
                  >
                    {card.displayName} · {card.last4}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {cards.length === 0 ? (
            <Text
              className="text-right text-sm font-bold text-amber-700 dark:text-amber-300"
              style={rtl.text}
            >
              יש להוסיף כרטיס לפני ייבוא תשלומים.
            </Text>
          ) : null}

          <Text
            className="text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            הערות (אופציונלי)
          </Text>
          <TextInput
            className="min-h-20 rounded-lg border border-slate-300 bg-white px-4 py-3 text-right text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            multiline
            onChangeText={setNotes}
            style={rtl.input}
            value={notes}
          />

          {formError !== null ? (
            <Text
              className="text-right text-sm font-bold text-red-600 dark:text-red-300"
              style={rtl.text}
            >
              {formError}
            </Text>
          ) : null}

          <View className="flex-row-reverse gap-2" style={rtl.row}>
            <Pressable
              accessibilityRole="button"
              className="min-h-[50px] flex-1 items-center justify-center rounded-lg bg-blue-600"
              onPress={saveObligation}
            >
              <Text
                className="text-center text-base font-extrabold text-white"
                style={rtl.text}
              >
                {editingId === null ? 'הוסף תשלומים' : 'שמור שינויים'}
              </Text>
            </Pressable>
            {editingId !== null ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-[50px] items-center justify-center rounded-lg border border-slate-300 px-4 dark:border-neutral-700"
                onPress={resetForm}
              >
                <Text
                  className="text-center text-base font-bold text-slate-700 dark:text-slate-200"
                  style={rtl.text}
                >
                  ביטול
                </Text>
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
                  <Text
                    className="text-right text-lg font-extrabold text-slate-900 dark:text-white"
                    style={rtl.text}
                  >
                    {obligation.merchantName}
                  </Text>
                  <Text
                    className="mt-1 text-right text-sm text-slate-600 dark:text-slate-300"
                    style={rtl.text}
                  >
                    {obligation.monthlyPayment.toLocaleString('he-IL')} ₪ ·{' '}
                    {obligation.monthsRemaining} חודשים נותרו
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="mt-3 min-h-[42px] items-center justify-center rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"
                  onPress={(): void => confirmDelete(obligation)}
                >
                  <Text
                    className="text-center text-sm font-extrabold text-red-700 dark:text-red-200"
                    style={rtl.text}
                  >
                    מחיקה
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
