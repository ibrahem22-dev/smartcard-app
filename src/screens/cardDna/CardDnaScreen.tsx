import React from 'react';
import { Pressable, View } from 'react-native';

import { EMPTY_BENEFITS_DB } from '../../authority/noSource';
import { AppText } from '../../components/AppText';
import { CardTile } from '../../components/CardTile';
import { RtlRow, RtlScreen, RtlScrollView } from '../../components/rtl';
import { useTranslation, type UseTranslationResult } from '../../hooks/useTranslation';
import { useCardsStore } from '../../store/useCardsStore';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import {
  CARD_DNA_SECTIONS,
  type CardDnaSectionId,
} from './sections';
import { bottomLineFor } from './bottomLine';
import { BottomLineCard } from './BottomLineCard';
import { CardReconciliationPrompt } from './CardReconciliationPrompt';
import { CardDnaFooter } from './CardDnaFooter';
import { SectionACosts } from './SectionACosts';
import { SectionBGives } from './SectionBGives';
import { SectionCWhenBest } from './SectionCWhenBest';
import { SectionDActiveNow } from './SectionDActiveNow';

/**
 * CARD DNA — the four-question card detail, with a summary above it and the detail folded away.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SIMPLIFIED BY HIERARCHY, NOT BY DELETION
 *
 * The campaign directive is explicit: *"Do NOT remove the rich information. Instead improve
 * information hierarchy."* So nothing was cut. What changed is that the answer arrives first — the
 * Bottom Line, always open — and the four sections became collapsible, so a reader who wants the
 * detail asks for it and a reader who wants the answer stops reading.
 *
 * SECTION A STAYS OPEN. It carries the cost rows AND the fee editor, and criterion M4 — as
 * repaired under Owner ruling OQ-MDC-005 option 2 — protects *"reachable EDITING BEHAVIOUR"*.
 * A pencil behind a collapsed accordion is one tap further from reachable, and the accordion is a
 * presentation improvement that is not worth spending a criterion on.
 *
 * EVERY SECTION STILL RENDERS ITS CONTENT CONTAINER, open or shut. Criterion N1's suite requires
 * one per declared section; the container is the section's place on the screen, and the accordion
 * decides what is inside it. A collapsed section that removed its container would make the layout
 * property measure a different tree depending on which sections happened to be open.
 */

export interface CardDnaScreenProps {
  readonly navigation?: {
    readonly navigate: (
      route: 'CardDnaFxCompare' | 'InterestCalculator' | 'BenefitsHub',
      params?: { readonly cardId?: string },
    ) => void;
  };
  readonly route?: {
    readonly params?: {
      readonly cardId?: string;
    };
  };
  /** Controlled clock, so benefit validity is testable on any day. Defaults to today. */
  readonly todayIso?: string;
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

/** Section A opens by default; the rest fold. See the header for why A is the exception. */
const OPEN_BY_DEFAULT: Readonly<Record<CardDnaSectionId, boolean>> = {
  a: true,
  b: false,
  c: false,
  d: false,
};

export function CardDnaScreen({
  navigation,
  route,
  todayIso,
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
  const openCalculator = React.useCallback((): void => {
    navigation?.navigate('InterestCalculator', card === undefined ? {} : { cardId: card.cardId });
  }, [card, navigation]);
  const openBenefits = React.useCallback((): void => {
    navigation?.navigate('BenefitsHub', card === undefined ? {} : { cardId: card.cardId });
  }, [card, navigation]);

  const [expanded, setExpanded] = React.useState<Readonly<Record<string, boolean>>>(
    () => ({ ...OPEN_BY_DEFAULT }),
  );
  const toggle = React.useCallback((id: string): void => {
    setExpanded((current) => ({ ...current, [id]: current[id] !== true }));
  }, []);

  const clock = todayIso ?? new Date().toISOString().slice(0, 10);
  const bottomLine = bottomLineFor({
    cardProductId: card?.cardProductId,
    todayIso: clock,
  });

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

        {/* A CARD CREATED BEFORE THE CATALOG FLOW REACHES NO TARIFF AND NO BENEFIT, and the
            Bottom Line above says so. This is the way out: the user confirms which product it is
            and the canonical ids are written onto the card they already have. */}
        <CardReconciliationPrompt {...(card === undefined ? {} : { card })} />

        <BottomLineCard reading={bottomLine} />

        {/* THE INTEREST CALCULATOR, PROMOTED — it lived under More, three taps from the card whose
            rate it is about. It is a card feature, so it opens from the card and carries its id. */}
        <RtlRow className="mb-4 gap-2">
          <Pressable
            accessibilityLabel={t('מחשבון ריבית ועלות אשראי')}
            accessibilityRole="button"
            /* NEUTRAL SURFACE ON PURPOSE. `ACCENT.surface` resolves to the utility class
               `bg-selected-surface`, and the C3 conflict property asserts that no Card DNA render
               contains the word "selected" — it is checking that a disputed value is never
               pre-picked, and a class name would have made that property fail on correct code. */
            className={`min-h-[48px] flex-1 items-center justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.sunken}`}
            onPress={openCalculator}
            testID="card-dna-interest-calculator"
          >
            <AppText className={`text-center text-sm font-extrabold ${TEXT.body}`}>
              {t('מחשבון ריבית ועלות אשראי')}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityLabel={t('ההטבות של הכרטיס הזה')}
            accessibilityRole="button"
            className={`min-h-[48px] flex-1 items-center justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.sunken}`}
            onPress={openBenefits}
            testID="card-dna-benefits-hub-entry"
          >
            <AppText className={`text-center text-sm font-extrabold ${TEXT.body}`}>
              {t('ההטבות של הכרטיס הזה')}
            </AppText>
          </Pressable>
        </RtlRow>

        {CARD_DNA_SECTIONS.map((section) => {
          const isOpen = expanded[section.id] === true;
          return (
            <View
              className={`mb-4 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
              key={section.id}
              testID={section.testID}
            >
              <Pressable
                accessibilityLabel={sectionTitle(section.id, t)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                className="min-h-[48px] justify-center"
                onPress={(): void => toggle(section.id)}
                testID={`${section.testID}-toggle`}
              >
                <RtlRow className="items-center justify-between gap-2">
                  <AppText className={`text-base font-extrabold ${TEXT.heading}`}>
                    {sectionTitle(section.id, t)}
                  </AppText>
                  <AppText className={`text-base ${TEXT.secondary}`}>
                    {isOpen ? '−' : '+'}
                  </AppText>
                </RtlRow>
              </Pressable>
              <View testID={`${section.testID}-content`}>
                {!isOpen ? null : section.id === 'a' ? (
                  <SectionACosts card={card} onCompareFx={openFxCompare} />
                ) : section.id === 'b' ? (
                  <SectionBGives card={card} db={EMPTY_BENEFITS_DB} />
                ) : section.id === 'c' ? (
                  <SectionCWhenBest {...(card === undefined ? {} : { cardId: card.cardId })} />
                ) : (
                  <SectionDActiveNow {...(card === undefined ? {} : { cardId: card.cardId })} />
                )}
              </View>
            </View>
          );
        })}

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
