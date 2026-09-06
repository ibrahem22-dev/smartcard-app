import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import type { TabParamList } from '../../navigation/types';
import { useCardsStore } from '../../store/useCardsStore';
import {
  eligibleBenefitsForCards,
  isCurrentlyShowable,
  type HeldCard,
} from '../../authority/benefitAuthority';
import { BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';

/**
 * HOME'S BENEFIT DISCOVERY LINE — two counts and a way in.
 *
 * The addendum asks for a concise entry that deep-links into the Benefits Hub and warns against
 * overloading Home. So this is one row: how many benefits this wallet actually has, how many end
 * soon, and a link. Nothing is listed here; the Hub lists.
 *
 * IT DISAPPEARS WHEN THERE IS NOTHING TO SAY. A wallet with no evidenced benefit gets no row —
 * a heading over a zero is a gap announcing itself, which B2 refuses on a live route, and the Hub
 * itself explains the absence properly when the user goes looking.
 *
 * The counts come from the ONE eligibility layer the Hub and Merchant Radar share, so Home cannot
 * print a number the Hub disagrees with.
 */
export interface HomeBenefitsEntryProps {
  /** Controlled clock, so validity is testable on any day. */
  readonly todayIso?: string;
}

export function HomeBenefitsEntry({
  todayIso,
}: HomeBenefitsEntryProps = {}): React.ReactElement | null {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const cards = useCardsStore((state) => state.cards);

  const clock = todayIso ?? new Date().toISOString().slice(0, 10);
  const held: readonly HeldCard[] = cards.map((card) => ({
    cardId: card.cardId,
    cardProductId: card.cardProductId ?? card.cardId,
  }));
  const rows = eligibleBenefitsForCards(held, clock).filter((row) =>
    isCurrentlyShowable(row.validity),
  );
  if (rows.length === 0) return null;

  const expiring = rows.filter((row) => row.validity === 'EXPIRING_SOON').length;

  return (
    <View
      className={`mb-4 gap-2 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
      testID="home-benefits-entry"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{t('ההטבות שלי')}</AppText>
      <Pressable
        accessibilityLabel={t('ההטבות שלי')}
        accessibilityRole="link"
        className="min-h-[48px] justify-center"
        onPress={(): void => navigation.navigate('Wallet')}
        testID="home-benefits-entry-link"
      >
        <RtlRow className="items-center gap-3">
          <AppText
            accessibilityValue={{ text: String(rows.length) }}
            className={`text-xl font-extrabold ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="home-benefits-entry-count"
          >
            {String(rows.length)}
          </AppText>
          <AppText className={`text-sm ${TEXT.secondary}`}>{t('הטבות זמינות')}</AppText>
          {expiring === 0 ? null : (
            <AppText
              accessibilityValue={{ text: String(expiring) }}
              className={`text-sm font-bold ${ROLE_TEXT.advisory}`}
              style={TABULAR_NUMERALS}
              testID="home-benefits-entry-expiring"
            >
              {`${String(expiring)} ${t('מסתיימות בקרוב')}`}
            </AppText>
          )}
        </RtlRow>
      </Pressable>
    </View>
  );
}
