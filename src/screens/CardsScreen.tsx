import React from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlScreen, RtlScrollView } from '../components/rtl';
import { useTranslation } from '../hooks/useTranslation';
import type { WalletStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';
import type { CardInput } from '../types/card.types';
import { buildCardsViewModel } from './cardsEmptyState';
import { WalletTile } from './wallet/WalletTile';

type CardsNavigation = NativeStackNavigationProp<
  WalletStackParamList,
  'WalletRoot'
>;

export function CardsScreen(): React.ReactElement {
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
                {t(viewModel.body, viewModel.bodyValues)}
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
              {cards.map((card: CardInput): React.ReactElement => (
                <WalletTile
                  card={card}
                  key={card.cardId}
                />
              ))}
            </View>
          )}
        </View>
      </RtlScrollView>

      {/* rtl-ok: full-width footer dock spans both edges intentionally */}
      <View className={`absolute bottom-0 left-0 right-0 border-t p-4 ${BORDER.subtle} ${SURFACE.card}`}>
        <Pressable
          accessibilityRole="button"
          className={`min-h-[50px] items-center justify-center rounded-lg ${ACCENT.solid}`}
          onPress={(): void => navigation.navigate('AddCard')}
          testID="wallet-add-card"
        >
          <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
            {t('+ הוסף כרטיס')}
          </AppText>
        </Pressable>
      </View>
    </RtlScreen>
  );
}
