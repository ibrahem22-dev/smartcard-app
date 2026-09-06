import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import {
  adoptCanonicalProduct,
  productDisplayName,
  reconcileCard,
  type CatalogProduct,
} from '../../authority/cardCatalogAuthority';
import { useCardsStore } from '../../store/useCardsStore';
import { BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import type { EngineCard } from '../../types/card.types';

/**
 * "CONFIRM YOUR CARD" — the one-time reconciliation the addendum requires for legacy cards.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT OFFERS, IT NEVER ADOPTS
 *
 * `reconcileCard` classifies a stored card and, where the catalog holds a product whose published
 * name matches what the user typed, returns those products as CANDIDATES. Adopting one silently
 * would be modelling card identity from display text — the thing the directive forbids — and the
 * cost of getting it wrong is not cosmetic: the card would then be bound to another product's FX
 * commission, another product's tariff scope and another product's benefits, all rendered as
 * verified. One tap of confirmation is cheaper than that.
 *
 * NOTHING IS DESTROYED. Confirming writes the canonical ids onto the existing card through
 * `updateCard`; the nickname, the last four digits, the limit and the billing day the user entered
 * are untouched. A card the user never confirms keeps working exactly as it did.
 *
 * A CARD THAT IS ALREADY CANONICAL RENDERS NOTHING. The prompt is for the cards that need it.
 */
export interface CardReconciliationPromptProps {
  readonly card?: EngineCard;
}

export function CardReconciliationPrompt({
  card,
}: CardReconciliationPromptProps): React.ReactElement | null {
  const { t, language } = useTranslation();
  const updateCard = useCardsStore((state) => state.updateCard);
  const [open, setOpen] = React.useState<boolean>(false);

  const reading = React.useMemo(
    () =>
      card === undefined
        ? null
        : reconcileCard({
          cardId: card.cardId,
          displayName: card.displayName,
          issuer: card.issuer,
          ...(card.cardProductId === undefined ? {} : { cardProductId: card.cardProductId }),
        }),
    [card],
  );

  const confirm = React.useCallback(
    (product: CatalogProduct): void => {
      if (card === undefined) return;
      const adopted = adoptCanonicalProduct(product.cardId);
      if (adopted === undefined) return;
      updateCard(card.cardId, {
        cardProductId: adopted.cardProductId,
        issuerOrgId: adopted.issuerOrgId,
        networkIds: adopted.networkIds,
        ...(adopted.operatingCardCompanyId === undefined
          ? {}
          : { operatingCardCompanyId: adopted.operatingCardCompanyId }),
        ...(adopted.productType === undefined ? {} : { productType: adopted.productType }),
      });
      setOpen(false);
    },
    [card, updateCard],
  );

  if (card === undefined || reading === null) return null;
  if (reading.state === 'CANONICALLY_RESOLVED') return null;

  const lang = language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'he';

  return (
    <View
      className={`mb-4 gap-2 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
      testID="card-reconciliation-prompt"
    >
      <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`}>
        {t('אישור זהות הכרטיס')}
      </AppText>
      <AppText className={`text-xs ${TEXT.secondary}`} testID="card-reconciliation-reason">
        {reading.state === 'AMBIGUOUS'
          ? t('הכרטיס הזה נוצר לפני שהאפליקציה עבדה מול קטלוג. אישור הזהות יקשר אותו לעמלות ולהטבות המתועדות.')
          : t('הכרטיס הזה אינו מקושר למוצר מהקטלוג, ולכן אין לו עמלות או הטבות מתועדות.')}
      </AppText>

      {reading.state === 'AMBIGUOUS' ? (
        <Pressable
          accessibilityLabel={t('אישור זהות הכרטיס')}
          accessibilityRole="button"
          className={`min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.sunken}`}
          onPress={(): void => setOpen(true)}
          testID="card-reconciliation-open"
        >
          <AppText className={`text-sm font-extrabold ${TEXT.body}`}>
            {t('אישור זהות הכרטיס')}
          </AppText>
        </Pressable>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={(): void => setOpen(false)}
        transparent
        visible={open}
      >
        {/* `justify-end` is the VERTICAL axis of a column: the sheet sits at the bottom in every
            language. rtl-ok */}
        <View className={`flex-1 justify-end ${SURFACE.modalScrim}`}>
          <View
            className={`max-h-[80%] gap-3 rounded-t-2xl p-4 ${SURFACE.card}`}
            testID="card-reconciliation-sheet"
          >
            <RtlRow className="items-center justify-between gap-2">
              <AppText className={`flex-1 text-base font-extrabold ${TEXT.heading}`}>
                {t('איזה כרטיס זה?')}
              </AppText>
              <Pressable
                accessibilityLabel={t('סגירה')}
                accessibilityRole="button"
                className={`min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border ${BORDER.hairline}`}
                onPress={(): void => setOpen(false)}
                testID="card-reconciliation-close"
              >
                <AppText className={`text-base font-bold ${TEXT.body}`}>✕</AppText>
              </Pressable>
            </RtlRow>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {reading.catalogMatches.map((candidate) => (
                <Pressable
                  accessibilityLabel={productDisplayName(candidate, lang)}
                  accessibilityRole="button"
                  className={`mb-2 min-h-[48px] justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.sunken}`}
                  key={candidate.cardId}
                  onPress={(): void => confirm(candidate)}
                  testID={`card-reconciliation-candidate-${candidate.cardId}`}
                >
                  <AppText className={`text-sm font-bold ${TEXT.body}`}>
                    {productDisplayName(candidate, lang)}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
