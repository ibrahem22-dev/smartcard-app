import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { rtl } from '../utils/rtlStyles';

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
    'שלום, קיבלתי התרעה או חשש לחזרת חיוב בכרטיס.',
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
  const [selectedProblem, setSelectedProblem] =
    useState<ProblemType>('wrong_charge');
  const script = SCRIPTS[selectedProblem];

  return (
    <View style={[rtl.screen, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        style={rtl.scrollOuter}
      >
      <View className="min-h-full w-full p-5 dark:bg-neutral-950">
        <Text
          className="mb-[18px] text-right text-[26px] font-extrabold text-slate-900 dark:text-white"
          style={rtl.text}
        >
          צור קשר עם חברת האשראי
        </Text>

        <View
          className="mb-[18px] w-full flex-row-reverse flex-wrap gap-2 rtl:flex-row-reverse"
          style={rtl.row}
        >
          {PROBLEM_OPTIONS.map(option => {
            const isSelected = option.id === selectedProblem;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`min-h-10 justify-center rounded-lg border px-3 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                    : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                }`}
                key={option.id}
                onPress={(): void => setSelectedProblem(option.id)}
              >
                <Text
                  className={`text-center text-sm font-bold ${
                    isSelected
                      ? 'text-blue-700 dark:text-blue-200'
                      : 'text-slate-600 dark:text-slate-200'
                  }`}
                  style={rtl.text}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="w-full gap-3">
          {ISSUER_CONTACTS.map((issuer: IssuerContact): React.ReactElement => (
            <View
              className="w-full rounded-lg border border-slate-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
              key={issuer.name}
            >
              <Text
                className="text-right text-xl font-extrabold text-slate-900 dark:text-white"
                style={rtl.text}
              >
                {issuer.name}
              </Text>
              <Text
                className="mt-1 text-right text-[17px] font-extrabold text-blue-600 dark:text-blue-300"
                style={rtl.text}
              >
                {issuer.phone}
              </Text>

              <View className="mt-3 rounded-lg bg-slate-100 p-3 dark:bg-neutral-800">
                <Text
                  className="mb-1.5 text-right text-sm font-extrabold text-slate-700 dark:text-slate-100"
                  style={rtl.text}
                >
                  מה לומר
                </Text>
                <Text
                  className="text-right text-[15px] leading-[22px] text-slate-700 dark:text-slate-200"
                  style={rtl.text}
                >
                  {script[0]}
                </Text>
                <Text
                  className="text-right text-[15px] leading-[22px] text-slate-700 dark:text-slate-200"
                  style={rtl.text}
                >
                  {script[1]}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                className="mt-3.5 min-h-11 items-center justify-center rounded-lg bg-slate-900 dark:bg-white"
                onPress={(): Promise<void> => Linking.openURL(getTelUrl(issuer.phone))}
              >
                <Text
                  className="text-center text-[15px] font-extrabold text-white dark:text-slate-900"
                  style={rtl.text}
                >
                  התקשר עכשיו
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
