import React, { useState } from 'react';
import {
  I18nManager,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ProblemType =
  | 'wrong_charge'
  | 'cancel_transaction'
  | 'charge_return'
  | 'general_question';

type IssuerContact = {
  readonly name: string;
  readonly phone: string;
};

const PROBLEM_OPTIONS: readonly {
  readonly id: ProblemType;
  readonly label: string;
}[] = [
  { id: 'wrong_charge', label: 'חיוב שגוי' },
  { id: 'cancel_transaction', label: 'ביטול עסקה' },
  { id: 'charge_return', label: 'חזרת חיוב' },
  { id: 'general_question', label: 'שאלה כללית' },
];

const ISSUER_CONTACTS: readonly IssuerContact[] = [
  { name: 'Max', phone: '1-800-000-020' },
  { name: 'Isracard', phone: '1-800-444-006' },
  { name: 'CAL', phone: '1-800-225-525' },
];

const SCRIPTS: Record<ProblemType, readonly [string, string]> = {
  wrong_charge: [
    'שלום, אני רוצה לדווח על חיוב שגוי בחשבוני.',
    'יכול/ה לעזור לי לבדוק את הפעולה?',
  ],
  cancel_transaction: [
    'שלום, אני רוצה לבדוק אפשרות לביטול עסקה שבוצעה בכרטיס.',
    'אפשר להסביר לי מה נדרש כדי לפתוח את הבקשה?',
  ],
  charge_return: [
    'שלום, קיבלתי התראה או חשש לחזרת חיוב בכרטיס.',
    'אפשר לבדוק את מצב החיוב ומה אפשר לעשות עכשיו?',
  ],
  general_question: [
    'שלום, יש לי שאלה לגבי פעילות או תנאים בכרטיס האשראי.',
    'אשמח שתעזרו לי להבין את הפרטים לפני שאמשיך.',
  ],
};

function getTelUrl(phone: string): string {
  return `tel:${phone.replace(/-/g, '')}`;
}

export function ContactScreen(): React.ReactElement {
  const [selectedProblem, setSelectedProblem] = useState<ProblemType>('wrong_charge');
  const script = SCRIPTS[selectedProblem];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>צור קשר עם חברת האשראי</Text>

      <View style={styles.selector}>
        {PROBLEM_OPTIONS.map(option => {
          const isSelected = option.id === selectedProblem;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={option.id}
              onPress={(): void => setSelectedProblem(option.id)}
              style={[
                styles.problemButton,
                isSelected ? styles.problemButtonSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.problemButtonText,
                  isSelected ? styles.problemButtonTextSelected : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.issuerList}>
        {ISSUER_CONTACTS.map((issuer: IssuerContact): React.ReactElement => (
          <View key={issuer.name} style={styles.issuerBlock}>
            <Text style={styles.issuerName}>{issuer.name}</Text>
            <Text style={styles.phone}>{issuer.phone}</Text>

            <View style={styles.scriptBlock}>
              <Text style={styles.scriptTitle}>מה לומר</Text>
              <Text style={styles.scriptLine}>{script[0]}</Text>
              <Text style={styles.scriptLine}>{script[1]}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={(): Promise<void> => Linking.openURL(getTelUrl(issuer.phone))}
              style={styles.callButton}
            >
              <Text style={styles.callButtonText}>התקשר עכשיו</Text>
            </Pressable>
          </View>
        ))}
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
  title: {
    marginBottom: 18,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  selector: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  problemButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  problemButtonSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  problemButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    writingDirection,
  },
  problemButtonTextSelected: {
    color: '#1D4ED8',
  },
  issuerList: {
    gap: 12,
  },
  issuerBlock: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  issuerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  phone: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: '#2563EB',
    textAlign: 'right',
    writingDirection,
  },
  scriptBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  scriptTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
    writingDirection,
  },
  scriptLine: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    textAlign: 'right',
    writingDirection,
  },
  callButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection,
  },
});
