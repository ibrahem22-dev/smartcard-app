import React from 'react';
import { View } from 'react-native';

import { EMPTY_BENEFITS_DB } from '../../authority/noSource';
import { AppText } from '../../components/AppText';
import { CardTile } from '../../components/CardTile';
import { RtlScreen, RtlScrollView } from '../../components/rtl';
import { useTranslation, type UseTranslationResult } from '../../hooks/useTranslation';
import { useCardsStore } from '../../store/useCardsStore';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import {
  CARD_DNA_SECTIONS,
  type CardDnaSectionId,
} from './sections';
import { CardDnaFooter } from './CardDnaFooter';
import { SectionACosts } from './SectionACosts';
import { SectionBGives } from './SectionBGives';
import { SectionCWhenBest } from './SectionCWhenBest';
import { SectionDActiveNow } from './SectionDActiveNow';

export interface CardDnaScreenProps {
  readonly navigation?: {
    readonly navigate: (route: 'CardDnaFxCompare') => void;
  };
  readonly route?: {
    readonly params?: {
      readonly cardId?: string;
    };
  };
}

function sectionTitle(
  id: CardDnaSectionId,
  t: UseTranslationResult['t'],
): string {
  switch (id) {
    case 'a':
      return t('מה זה עולה לי');
    case 'b':
      return t('מה זה נותן לי');
    case 'c':
      return t('מתי הכי טוב להשתמש');
    case 'd':
      return t('מה פעיל עכשיו');
  }
}

export function CardDnaScreen({
  navigation,
  route,
}: CardDnaScreenProps = {}): React.ReactElement {
  const { t } = useTranslation();
  const cards = useCardsStore((state) => state.cards);
  const routeCardId = route?.params?.cardId;
  const card =
    routeCardId === undefined
      ? cards[0]
      : cards.find((candidate) => candidate.cardId === routeCardId);
  const openFxCompare = React.useCallback((): void => {
    navigation?.navigate('CardDnaFxCompare');
  }, [navigation]);

  return (
    <RtlScreen className={SURFACE.page} testID="card-dna-screen">
      <RtlScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="mb-4 gap-3" testID="card-dna-header">
          {card === undefined ? null : (
            <CardTile
              context={{ issuerId: card.issuer }}
              last4={card.last4}
              nickname={card.displayName}
              nicknameTestID="card-dna-nickname"
              subject={{
                subjectKind: 'card',
                subjectId: card.cardProductId ?? card.cardId,
                fallbackClass: 'card',
              }}
              testID="card-dna-card-tile"
            />
          )}
          <View testID="card-dna-role-selector" />
          <View testID="card-dna-colour-dots" />
        </View>

        {CARD_DNA_SECTIONS.map((section) => (
          <View
            className={`mb-4 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
            key={section.id}
            testID={section.testID}
          >
            <AppText className={`text-base font-extrabold ${TEXT.heading}`}>
              {sectionTitle(section.id, t)}
            </AppText>
            {section.id === 'a' ? (
              <View testID={`${section.testID}-content`}>
                <SectionACosts card={card} onCompareFx={openFxCompare} />
              </View>
            ) : section.id === 'b' ? (
              <View testID={`${section.testID}-content`}>
                <SectionBGives card={card} db={EMPTY_BENEFITS_DB} />
              </View>
            ) : section.id === 'c' ? (
              <View testID={`${section.testID}-content`}>
                <SectionCWhenBest {...(card === undefined ? {} : { cardId: card.cardId })} />
              </View>
            ) : (
              <View testID={`${section.testID}-content`}>
                <SectionDActiveNow {...(card === undefined ? {} : { cardId: card.cardId })} />
              </View>
            )}
          </View>
        ))}

        <CardDnaFooter
          onCompareFx={openFxCompare}
          {...(card?.cardRates?.lastUpdated === undefined
            ? {}
            : { lastUpdated: card.cardRates.lastUpdated })}
        />
      </RtlScrollView>
    </RtlScreen>
  );
}
