import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useTranslation } from '../../hooks/useTranslation';
import { useCardsStore } from '../../store/useCardsStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
} from '../../surfaces';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { bestForChipsFor, type BestForChip } from './bestForChips';

export interface SectionCWhenBestProps {
  readonly cardId?: string;
  readonly context?: SurfaceContext;
}

export function SectionCWhenBest({
  cardId,
  context,
}: SectionCWhenBestProps): React.ReactElement {
  const { t } = useTranslation();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
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
  const rankedCardIds = cardId === undefined
    ? scoring?.ranked.map((rankedCard) => rankedCard.cardId) ?? []
    : [cardId];
  const chips = rankedCardIds.flatMap((rankedCardId) =>
    bestForChipsFor(scoring, rankedCardId),
  );
  const labelFor = (kind: BestForChip['kind']): string => {
    switch (kind) {
      case 'lowest-cost':
        return t('העלות הנמוכה ביותר');
    }
  };

  if (chips.length === 0) {
    return (
      <View className="py-4" testID="card-dna-when-best-empty">
        <AppText className={`text-sm ${TEXT.muted}`}>
          {t('אין כרגע דירוג לכרטיס')}
        </AppText>
      </View>
    );
  }

  return (
    <View className="gap-3 py-4">
      {chips.map((chip) => {
        const testID = `card-dna-best-for-${chip.id}`;
        return (
          <View
            className={`gap-1 rounded-lg border px-3 py-2 ${SURFACE.raised} ${BORDER.subtle}`}
            key={chip.id}
            testID={testID}
          >
            <AppText className={`text-sm font-bold ${TEXT.heading}`}>
              {labelFor(chip.kind)}
            </AppText>
            {chip.explanation === null ? null : (
              <AppText
                className={`text-xs ${TEXT.body}`}
                testID={`${testID}-explanation`}
              >
                {chip.explanation}
              </AppText>
            )}
          </View>
        );
      })}
    </View>
  );
}
