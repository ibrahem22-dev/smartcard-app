import React from 'react';
import {
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { useTheme } from '../hooks/useTheme';
import { useTranslation, type UseTranslationResult } from '../hooks/useTranslation';
import type { CardsStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { CardIssuer, type CardInput } from '../types/card.types';
import { rtl } from '../utils/rtlStyles';

type CardsNavigation = NativeStackNavigationProp<
  CardsStackParamList,
  'CardsRoot'
>;

const ISSUER_LABELS: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function getClubLabel(card: CardInput, t: UseTranslationResult['t']): string {
  if (card.unknownClub === true) {
    return t('מועדון לא ידוע 🔍');
  }

  return card.bankName === undefined ? t('מועדון רגיל') : t(card.bankName);
}

function withOpacity(color: string, opacity: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${alpha}`;
  }

  if (color.startsWith('hsl(') && color.endsWith(')')) {
    return `hsla(${color.slice(4, -1)}, ${opacity})`;
  }

  return color;
}

export function CardsScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<CardsNavigation>();
  const cards = useCardsStore(state => state.cards);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-app-dark" style={rtl.screen}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        style={rtl.scrollOuter}
      >
        <View className="min-h-full w-full p-5 pb-24">
          <View className="mb-5 w-full">
            <AppText
              className="text-3xl font-extrabold text-slate-900 dark:text-slate-50"
            >
              {t('הכרטיסים שלי')}
            </AppText>
            <AppText
              className="mt-1.5 text-base leading-6 text-slate-600 dark:text-slate-300"
            >
              {t('כל הכרטיסים שנשמרו במכשיר.')}
            </AppText>
          </View>

          {cards.length === 0 ? (
            <View className="min-h-40 w-full items-center justify-center rounded-lg border border-slate-300 bg-white dark:border-neutral-700 dark:bg-dark-surface">
              <AppText
                className="text-center text-lg font-bold text-slate-500 dark:text-slate-300"
              >
                {t('לא נמצאו כרטיסים')}
              </AppText>
            </View>
          ) : (
            <View className="w-full gap-3">
              {cards.map((card: CardInput): React.ReactElement => (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[108px] w-full flex-row items-center justify-between rounded-lg border border-slate-300 bg-white p-4 rtl:flex-row dark:border-neutral-700 dark:bg-dark-surface"
                  key={card.cardId}
                  onPress={(): void =>
                    navigation.navigate('CardDetail', { cardId: card.cardId })
                  }
                  style={[rtl.row, { borderColor: theme.companyAccent }]}
                >
                  <View className="flex-1 items-stretch">
                    <AppText
                      className="text-lg font-extrabold text-slate-900 dark:text-slate-50"
                      style={[
                        {
                          backgroundColor: withOpacity(
                            theme.companyAccent,
                            0.15,
                          ),
                        },
                      ]}
                    >
                      {card.displayName}
                    </AppText>
                    <AppText
                      className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                      style={[
                        { backgroundColor: theme.clubBadge },
                      ]}
                    >
                      {t(ISSUER_LABELS[card.issuer])} · {getClubLabel(card, t)}
                    </AppText>
                    <AppText
                      className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                    >
                      {t('מסתיים ב-{{last4}}', { last4: card.last4 })}
                    </AppText>
                  </View>

                  {card.unknownClub === true ? (
                    <Pressable
                      accessibilityRole="button"
                      className="me-3 min-h-9 min-w-[72px] items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950"
                      style={{ backgroundColor: theme.clubBadge }}
                    >
                      <AppText
                        className="text-center text-sm font-extrabold text-sky-700 dark:text-sky-200"
                      >
                        {t('עריכה')}
                      </AppText>
                    </Pressable>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-dark-surface">
        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600"
        >
          <AppText className="text-center text-base font-extrabold text-white">
            {t('הוסף כרטיס')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
