import React from 'react';
import {
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FeatureGate } from '../components/FeatureGate';
import type { PurchaseGateStackParamList } from '../navigation/types';
import type { DecisionVerdict } from '../types/decision.types';

type DecisionScreenProps = NativeStackScreenProps<
  PurchaseGateStackParamList,
  'Decision'
>;

const VERDICT_LABELS: Record<DecisionVerdict, string> = {
  approved: 'אושר ✓',
  warning: 'שים לב ⚠️',
  blocked: 'נחסם ✗',
  wait_24h: 'המתן 24 שעות ⏳',
};

const VERDICT_REASONS: Record<DecisionVerdict, string> = {
  approved: 'הרכישה נראית מתאימה לתזרים הנוכחי.',
  warning: 'אפשר לבצע את הרכישה, אבל כדאי לשים לב למרווח הביטחון.',
  blocked: 'הרכישה עלולה לסכן את התזרים או את מסגרת האשראי.',
  wait_24h: 'הרכישה אינה דחופה ומומלץ להמתין לפני קבלת החלטה.',
};

const VERDICT_COLORS: Record<DecisionVerdict, {
  readonly backgroundColor: string;
  readonly borderColor: string;
}> = {
  approved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  blocked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  wait_24h: {
    backgroundColor: '#FFEDD5',
    borderColor: '#F97316',
  },
};

export function DecisionScreen({
  navigation,
  route,
}: DecisionScreenProps): React.ReactElement {
  const verdict = route.params.verdict;
  const colors = VERDICT_COLORS[verdict];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View
        style={[
          styles.verdictBanner,
          {
            backgroundColor: colors.backgroundColor,
            borderColor: colors.borderColor,
          },
        ]}
      >
        <Text style={styles.verdictLabel}>{VERDICT_LABELS[verdict]}</Text>
        <Text style={styles.reason}>{VERDICT_REASONS[verdict]}</Text>
      </View>

      <FeatureGate feature="ScoreSection">
        <View style={styles.scoreSection}>
          <Text style={styles.sectionTitle}>ניקוד כרטיסים</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreCardName}>כרטיס מוביל</Text>
            <Text style={styles.scoreValue}>84/100</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreCardName}>כרטיס חלופי</Text>
            <Text style={styles.scoreValue}>71/100</Text>
          </View>
        </View>
      </FeatureGate>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        onPress={(): void => navigation.navigate('Contact')}
        style={styles.helpButton}
      >
        <Text style={styles.helpButtonText}>יש לך בעיה?</Text>
      </Pressable>
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
  verdictBanner: {
    padding: 20,
    borderWidth: 1,
    borderRadius: 8,
  },
  verdictLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  reason: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: '#1E293B',
    textAlign: 'right',
    writingDirection,
  },
  scoreSection: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    opacity: 0.45,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  scoreRow: {
    minHeight: 38,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  scoreCardName: {
    fontSize: 15,
    color: '#334155',
    textAlign: 'right',
    writingDirection,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'left',
    writingDirection,
  },
  spacer: {
    flex: 1,
    minHeight: 32,
  },
  helpButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  helpButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection,
  },
});
