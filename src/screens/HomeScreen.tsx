import React from 'react';
import {
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { FeatureGate } from '../components/FeatureGate';
import type { TabParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';

const DAILY_TIPS: readonly string[] = [
  'שלם ביום חיוב כדי למקסם את תקופת האשראי',
  'הימנע מחיובים בחו"ל ללא כרטיס ללא עמלה',
  'פרוס לתשלומים רק כשהריבית שווה',
  'בדוק חזרת חיוב לפני כל רכישה גדולה',
  'השתמש במועדון הנכון לכל סוג קנייה',
];

function getDailyTip(): string {
  const dayIndex = new Date().getDate() - 1;
  const tipIndex = dayIndex % DAILY_TIPS.length;

  return DAILY_TIPS[tipIndex] ?? 'שלם ביום חיוב כדי למקסם את תקופת האשראי';
}

export function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const cards = useCardsStore(state => state.cards);
  const upcomingObligationsCount = cards.length;

  function handleCheckPurchase(): void {
    navigation.navigate('PurchaseGate', { screen: 'PurchaseGateRoot' });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.savingsPanel}>
          <Text style={styles.savingsValue}>₪0 נחסך</Text>
          <Text style={styles.savingsLabel}>החיסכון שלך עד עכשיו</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>טיפ היום</Text>
          <Text style={styles.tipText}>{getDailyTip()}</Text>
        </View>

        <View style={styles.obligationsBanner}>
          <Text style={styles.sectionTitle}>חיובים קרובים</Text>
          <Text style={styles.bannerText}>
            {upcomingObligationsCount === 0
              ? 'אין חיובים קרובים 📅'
              : `יש ${upcomingObligationsCount} חיובים קרובים`}
          </Text>
        </View>

        <FeatureGate feature="InternationalTravel">
          <View style={styles.travelBanner}>
            <Text style={styles.travelTitle}>נוסעים לחו"ל? ✈️</Text>
            <Text style={styles.travelText}>
              בקרוב תוכלו לבדוק מראש איזה כרטיס עדיף לנסיעות ולחיובים במט"ח.
            </Text>
          </View>
        </FeatureGate>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={handleCheckPurchase}
          style={styles.ctaButton}
        >
          <Text style={styles.ctaButtonText}>בדוק רכישה</Text>
        </Pressable>
      </View>
    </View>
  );
}

const writingDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 104,
  },
  savingsPanel: {
    padding: 22,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  savingsValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'right',
    writingDirection,
  },
  savingsLabel: {
    marginTop: 6,
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'right',
    writingDirection,
  },
  section: {
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  tipText: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
    textAlign: 'right',
    writingDirection,
  },
  obligationsBanner: {
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  bannerText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#0369A1',
    textAlign: 'right',
    writingDirection,
  },
  travelBanner: {
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    opacity: 0.45,
  },
  travelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9A3412',
    textAlign: 'right',
    writingDirection,
  },
  travelText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#9A3412',
    textAlign: 'right',
    writingDirection,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  ctaButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection,
  },
});
