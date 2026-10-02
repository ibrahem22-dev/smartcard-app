import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { IssuerContact, ProblemType } from '../types/contact.types';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

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
  const theme = useTheme();
  const { t } = useTranslation();
  const [selectedProblem, setSelectedProblem] =
    useState<ProblemType>('wrong_charge');
  const script = SCRIPTS[selectedProblem];

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
      <View className={`min-h-full w-full p-5 ${SURFACE.pageDarkOnly}`}>
        <AppText
          className={`mb-[18px] text-[26px] font-extrabold ${TEXT.heading}`}
          style={{ color: theme.bankColor }}
        >
          {t('צור קשר עם חברת האשראי')}
        </AppText>

        <RtlRow className="mb-[18px] w-full flex-wrap gap-2">
          {PROBLEM_OPTIONS.map(option => {
            const isSelected = option.id === selectedProblem;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`min-h-11 justify-center rounded-lg border px-3 ${
                  isSelected
                    ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                    : `${BORDER.hairline} ${SURFACE.card}`
                }`}
                key={option.id}
                onPress={(): void => setSelectedProblem(option.id)}
              >
                <AppText
                  className={`text-center text-sm font-bold ${ isSelected ? `${ACCENT.text}` : `${TEXT.secondary}` }`}
                >
                  {t(option.label)}
                </AppText>
              </Pressable>
            );
          })}
        </RtlRow>

        <View className="w-full gap-3">
          {ISSUER_CONTACTS.map((issuer: IssuerContact): React.ReactElement => (
            <View
              className={`w-full rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
              key={issuer.name}
            >
              <AppText
                className={`text-xl font-extrabold ${TEXT.heading}`}
                style={{ color: theme.companyAccent }}
              >
                {issuer.name}
              </AppText>
              <AppText
                className={`mt-1 text-[17px] font-extrabold ${ACCENT.text}`}
              >
                {issuer.phone}
              </AppText>

              <View className={`mt-3 rounded-lg p-3 ${SURFACE.sunken}`}>
                <AppText
                  className={`mb-1.5 text-sm font-extrabold ${TEXT.body}`}
                >
                  {t('מה לומר')}
                </AppText>
                <AppText
                  className={`text-[15px] leading-[22px] ${TEXT.body}`}
                >
                  {t(script[0])}
                </AppText>
                <AppText
                  className={`text-[15px] leading-[22px] ${TEXT.body}`}
                >
                  {t(script[1])}
                </AppText>
              </View>

              <Pressable
                accessibilityRole="button"
                className={`mt-3.5 min-h-11 items-center justify-center rounded-lg ${SURFACE.inverse}`}
                onPress={(): Promise<void> => Linking.openURL(getTelUrl(issuer.phone))}
              >
                <AppText
                  className={`text-center text-[15px] font-extrabold ${TEXT.inverse}`}
                >
                  {t('התקשר עכשיו')}
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
