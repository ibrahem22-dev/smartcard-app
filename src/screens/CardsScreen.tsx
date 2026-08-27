import React from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation, type UseTranslationResult } from '../hooks/useTranslation';
import { resolveMedia } from '../media/resolveMedia';
import { maskLast4 } from '../media/maskLast4';
import type { WalletStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';
import { CardIssuer, type CardInput } from '../types/card.types';
import { ltrNumerals } from '../utils/calendar';
import { buildCardsViewModel } from './cardsEmptyState';

type CardsNavigation = NativeStackNavigationProp<
  WalletStackParamList,
  'WalletRoot'
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
  const cardsHydration = useCardsStore(state => state.hydration);
  // What the screen shows is decided by the store's real lifecycle, not by
  // `cards.length === 0` -- which reported "no cards found" while loading and
  // while the vault was locked.
  const viewModel = React.useMemo(
    () => buildCardsViewModel(cardsHydration, cards.length),
    [cardsHydration, cards.length],
  );

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View className="min-h-full w-full p-5 pb-24">
          <View className="mb-5 w-full">
            <AppText
              className={`text-3xl font-extrabold ${TEXT.heading}`}
            >
              {t(viewModel.title)}
            </AppText>
            {viewModel.body === '' ? null : (
              <AppText
                className={`mt-1.5 text-base leading-6 ${TEXT.secondary}`}
              >
                {t(viewModel.body)}
              </AppText>
            )}
          </View>

          {viewModel.view !== 'CARD_LIST' ? (
            <View className={`min-h-40 w-full items-center justify-center rounded-lg border p-5 ${BORDER.hairline} ${SURFACE.card}`}>
              {viewModel.primaryAction === null ? (
                <AppText
                  className={`text-center text-lg font-bold ${TEXT.muted}`}
                >
                  {t(viewModel.title)}
                </AppText>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  className={`min-h-[50px] w-full items-center justify-center rounded-lg px-5 ${ACCENT.solid}`}
                  onPress={(): void =>
                    navigation.navigate(viewModel.primaryAction!.route)
                  }
                  testID={viewModel.primaryAction.testID}
                >
                  <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
                    {t(viewModel.primaryAction.label)}
                  </AppText>
                </Pressable>
              )}
            </View>
          ) : (
            <View className="w-full gap-3">
              {cards.map((card: CardInput): React.ReactElement => {
                const resolution = resolveMedia(
                  {
                    subjectKind: 'card',
                    subjectId: card.cardId,
                    fallbackClass: 'card',
                  },
                  [],
                  { context: { issuerId: card.issuer } },
                );
                const mask = maskLast4(card.last4);
                return (
                <Pressable
                  accessibilityRole="button"
                  className={`min-h-[108px] w-full rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
                  key={card.cardId}
                  onPress={(): void =>
                    navigation.navigate('CardDetail', { cardId: card.cardId })
                  }
                  style={{ borderColor: theme.companyAccent }}
                >
                  <RtlRow className="items-center justify-between">
                    <View className="flex-1 items-stretch">
                      <View
                        accessibilityLabel={
                          resolution
                            ? t(resolution.altTextKey)
                            : t('ייצוג כללי של כרטיס')
                        }
                        className={`mb-2 h-16 rounded-md ${SURFACE.raised}`}
                        testID="card-tile-surface"
                      />
                      <AppText
                        className={`text-lg font-extrabold ${TEXT.heading}`}
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
                        className={`mt-1 text-sm ${TEXT.secondary}`}
                        style={[
                          { backgroundColor: theme.clubBadge },
                        ]}
                      >
                        {t(ISSUER_LABELS[card.issuer])} · {getClubLabel(card, t)}
                      </AppText>
                      {mask ? (
                        <AppText
                          className={`mt-1 text-sm ${TEXT.secondary}`}
                          testID="card-tile-mask"
                        >
                          {ltrNumerals(mask)}
                        </AppText>
                      ) : null}
                      <AppText
                        className={`mt-1 text-sm ${TEXT.secondary}`}
                      >
                        {t('מסתיים ב-{{last4}}', { last4: card.last4 })}
                      </AppText>
                    </View>

                    {card.unknownClub === true ? (
                      <Pressable
                        accessibilityRole="button"
                        className={`me-3 min-h-11 min-w-[72px] items-center justify-center rounded-lg ${ACCENT.surfaceStrong}`}
                        style={{ backgroundColor: theme.clubBadge }}
                      >
                        <AppText
                          className={`text-center text-sm font-extrabold ${ACCENT.text}`}
                        >
                          {t('עריכה')}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </RtlRow>
                </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </RtlScrollView>

      {/* Footer dock is hidden unless the card list is showing: on the
          first-card screen the in-panel invitation is the single primary
          action, and while cards are loading or unreadable there must be no
          add-card affordance at all -- otherwise the user can create a
          duplicate of a card that is about to appear. */}
      {viewModel.showFooterAddCard ? (
        // rtl-ok: full-width footer dock spans both edges intentionally
        <View className={`absolute bottom-0 left-0 right-0 border-t p-4 ${BORDER.subtle} ${SURFACE.card}`}>
          <Pressable
            accessibilityRole="button"
            className={`min-h-[50px] items-center justify-center rounded-lg ${ACCENT.solid}`}
            onPress={(): void => navigation.navigate('AddCard')}
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
              {t('הוסף כרטיס')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </RtlScreen>
  );
}
