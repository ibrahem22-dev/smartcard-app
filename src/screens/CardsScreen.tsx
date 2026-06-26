import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useCardsStore } from '../store/useCardsStore';
import { CardIssuer, type CardInput } from '../types/card.types';
import { rtl } from '../utils/rtlStyles';

const ISSUER_LABELS: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function getClubLabel(card: CardInput): string {
  if (card.unknownClub === true) {
    return 'מועדון לא ידוע 🔍';
  }

  return card.bankName ?? 'מועדון רגיל';
}

export function CardsScreen(): React.ReactElement {
  const cards = useCardsStore(state => state.cards);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-neutral-950" style={rtl.screen}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        style={rtl.scrollOuter}
      >
        <View className="min-h-full w-full p-5 pb-24">
          <View className="mb-5 w-full">
            <Text
              className="text-right text-3xl font-extrabold text-slate-900 dark:text-slate-50"
              style={rtl.text}
            >
              הכרטיסים שלי
            </Text>
            <Text
              className="mt-1.5 text-right text-base leading-6 text-slate-600 dark:text-slate-300"
              style={rtl.text}
            >
              כל הכרטיסים שנשמרו במכשיר.
            </Text>
          </View>

          {cards.length === 0 ? (
            <View className="min-h-40 w-full items-center justify-center rounded-lg border border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
              <Text
                className="text-center text-lg font-bold text-slate-500 dark:text-slate-300"
                style={rtl.text}
              >
                לא נמצאו כרטיסים
              </Text>
            </View>
          ) : (
            <View className="w-full gap-3">
              {cards.map((card: CardInput): React.ReactElement => (
                <View
                  className="min-h-[108px] w-full flex-row-reverse items-center justify-between rounded-lg border border-slate-300 bg-white p-4 rtl:flex-row-reverse dark:border-neutral-700 dark:bg-neutral-900"
                  key={card.cardId}
                  style={rtl.row}
                >
                  <View className="flex-1 items-stretch">
                    <Text
                      className="text-right text-lg font-extrabold text-slate-900 dark:text-slate-50"
                      style={rtl.text}
                    >
                      {card.displayName}
                    </Text>
                    <Text
                      className="mt-1 text-right text-sm text-slate-600 dark:text-slate-300"
                      style={rtl.text}
                    >
                      {ISSUER_LABELS[card.issuer]} · {getClubLabel(card)}
                    </Text>
                    <Text
                      className="mt-1 text-right text-sm text-slate-600 dark:text-slate-300"
                      style={rtl.text}
                    >
                      מסתיים ב-{card.last4}
                    </Text>
                  </View>

                  {card.unknownClub === true ? (
                    <Pressable
                      accessibilityRole="button"
                      className="me-3 min-h-9 min-w-[72px] items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950"
                    >
                      <Text
                        className="text-center text-sm font-extrabold text-sky-700 dark:text-sky-200"
                        style={rtl.text}
                      >
                        עריכה
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600"
        >
          <Text className="text-center text-base font-extrabold text-white" style={rtl.text}>
            הוסף כרטיס
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
