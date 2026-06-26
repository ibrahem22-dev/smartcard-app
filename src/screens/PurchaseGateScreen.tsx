import React from 'react';
import {
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePurchaseGate } from '../hooks/usePurchaseGate';
import type { PurchaseGateStackParamList } from '../navigation/types';
import type { DecisionVerdict } from '../types/decision.types';

type PurchaseGateNavigation = NativeStackNavigationProp<
  PurchaseGateStackParamList,
  'PurchaseGateRoot'
>;

const VERDICT_STYLES: Record<DecisionVerdict, {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly title: string;
}> = {
  approved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
    title: 'מאושר',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    title: 'אזהרה',
  },
  blocked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
    title: 'חסום',
  },
  wait_24h: {
    backgroundColor: '#FFEDD5',
    borderColor: '#F97316',
    title: '⏱️ להמתין 24 שעות',
  },
};

function parseAmountInput(value: string): number {
  const normalized = value.replace(/[^\d.]/g, '');

  if (normalized.length === 0) {
    return 0;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function PurchaseGateScreen(): React.ReactElement {
  const navigation = useNavigation<PurchaseGateNavigation>();
  const {
    amount,
    setAmount,
    isInternational,
    setIsInternational,
    verdict,
    decision,
    exchangeFeeWarning,
    evaluate,
  } = usePurchaseGate();

  const amountValue = amount === 0 ? '' : String(amount);
  const verdictStyle = verdict === null ? null : VERDICT_STYLES[verdict];
  const shouldShowExchangeWarning =
    isInternational &&
    (verdict === 'approved' || verdict === 'warning') &&
    exchangeFeeWarning !== null;

  function handleEvaluate(): void {
    const nextVerdict = evaluate();
    navigation.navigate('Decision', { verdict: nextVerdict });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>בדיקת רכישה</Text>
        <Text style={styles.subtitle}>בדקו אם הרכישה מתאימה לתזרים הנוכחי.</Text>
      </View>

      <View style={styles.toggleGroup} accessibilityRole="tablist">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !isInternational }}
          onPress={(): void => setIsInternational(false)}
          style={[
            styles.toggleButton,
            !isInternational ? styles.toggleButtonActive : null,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              !isInternational ? styles.toggleTextActive : null,
            ]}
          >
            בארץ 🇮🇱
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isInternational }}
          onPress={(): void => setIsInternational(true)}
          style={[
            styles.toggleButton,
            isInternational ? styles.toggleButtonActive : null,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              isInternational ? styles.toggleTextActive : null,
            ]}
          >
            חו"ל ✈️
          </Text>
        </Pressable>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>סכום הרכישה</Text>
        <View style={styles.amountInputWrap}>
          <Text style={styles.currencyPrefix}>₪</Text>
          <TextInput
            accessibilityLabel="סכום הרכישה"
            keyboardType="numeric"
            onChangeText={(value: string): void => setAmount(parseAmountInput(value))}
            placeholder="0"
            placeholderTextColor="#94A3B8"
            style={styles.amountInput}
            value={amountValue}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleEvaluate}
        style={styles.checkButton}
      >
        <Text style={styles.checkButtonText}>בדוק רכישה</Text>
      </Pressable>

      <View style={styles.resultArea}>
        {verdictStyle === null || decision === null ? (
          <Text style={styles.emptyResult}>ההחלטה תופיע כאן אחרי הבדיקה.</Text>
        ) : (
          <View
            style={[
              styles.verdictBanner,
              {
                backgroundColor: verdictStyle.backgroundColor,
                borderColor: verdictStyle.borderColor,
              },
            ]}
          >
            <Text style={styles.verdictTitle}>{verdictStyle.title}</Text>
            <Text style={styles.verdictReason}>{decision.reason}</Text>
          </View>
        )}

        {shouldShowExchangeWarning ? (
          <Text style={styles.exchangeWarning}>{exchangeFeeWarning}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const writingDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  header: {
    marginBottom: 20,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'right',
    writingDirection,
  },
  toggleGroup: {
    flexDirection: 'row-reverse',
    gap: 8,
    padding: 4,
    marginBottom: 22,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  toggleButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    writingDirection,
  },
  toggleTextActive: {
    color: '#0F172A',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
    writingDirection,
  },
  amountInputWrap: {
    minHeight: 54,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    marginStart: 8,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  amountInput: {
    flex: 1,
    minHeight: 52,
    padding: 0,
    fontSize: 20,
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  checkButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection,
  },
  resultArea: {
    minHeight: 150,
    marginTop: 22,
  },
  emptyResult: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    textAlign: 'right',
    writingDirection,
  },
  verdictBanner: {
    padding: 18,
    borderWidth: 1,
    borderRadius: 8,
  },
  verdictTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  verdictReason: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#1E293B',
    textAlign: 'right',
    writingDirection,
  },
  exchangeWarning: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    color: '#9A3412',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection,
  },
});
