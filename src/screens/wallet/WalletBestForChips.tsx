import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import type { WalletStackParamList } from '../../navigation/types';
import { useCardsStore } from '../../store/useCardsStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../surfaces';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import {
  bestForChipsFor,
  type BestForChip,
} from '../cardDna/bestForChips';

type WalletNavigation = NativeStackNavigationProp<
  WalletStackParamList,
  'WalletRoot'
>;

export interface WalletBestForChipsProps {
  readonly cardId: string;
  readonly context?: SurfaceContext;
}

export function WalletBestForChips({
  cardId,
  context,
}: WalletBestForChipsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const navigation = useNavigation<WalletNavigation>();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const [revealedChipIds, setRevealedChipIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const fallbackContext: SurfaceContext = {
    asOfDate: '1970-01-01',
    throughDate: '1970-01-01',
    profile: null,
    cards: storedCards,
    installments: storedInstallments,
    loans: [],
    purchases: [],
  };
  const scoring = evaluateSurfaceEngines(context ?? fallbackContext).scoring;
  const chips = bestForChipsFor(scoring, cardId).slice(0, 2);

  const labelFor = (kind: BestForChip['kind']): string => {
    switch (kind) {
      case 'lowest-cost':
        return t('העלות הנמוכה ביותר');
    }
  };

  if (chips.length === 0) return null;

  return (
    <RtlRow className="flex-wrap gap-2 py-2">
      {chips.map((chip) => {
        const testID = `wallet-best-for-${chip.id}`;
        const reasonIsVisible = revealedChipIds.has(chip.id);

        return (
          <View className="gap-1" key={chip.id}>
            <Pressable
              accessibilityRole="button"
              className={`rounded-full border px-3 py-1 ${SURFACE.raised} ${BORDER.subtle}`}
              onPress={(): void => {
                setRevealedChipIds((current) => {
                  const next = new Set(current);
                  next.add(chip.id);
                  return next;
                });
              }}
              testID={testID}
            >
              <AppText className={`text-xs font-bold ${TEXT.heading}`}>
                {labelFor(chip.kind)}
              </AppText>
            </Pressable>

            {!reasonIsVisible || chip.explanation === null ? null : (
              <Pressable
                accessibilityRole="link"
                onPress={(): void => {
                  // CardDetail has no section-focus param yet; add section C when the route carries one.
                  navigation.navigate('CardDetail', { cardId });
                }}
                testID={`${testID}-reason`}
              >
                <AppText
                  className={`text-xs ${TEXT.body}`}
                  numberOfLines={1}
                >
                  {chip.explanation}
                </AppText>
              </Pressable>
            )}
          </View>
        );
      })}
    </RtlRow>
  );
}
