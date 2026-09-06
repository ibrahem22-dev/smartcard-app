import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import type { TabParamList } from '../../navigation/types';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
} from '../../surfaces';
import { BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { ltrNumerals } from '../../utils/calendar';
import { TABULAR_NUMERALS } from '../../utils/money';

/**
 * SYNCHRONISED BILLING — several card charges landing on the same day.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT IS THE RISK ENGINE'S OWN OUTPUT, NOT A SECOND OPINION
 *
 * `evaluateRiskPlanning` already computes `billingClusters`: every date where more than one
 * billing event falls, with the ids and the summed amount. It has been computed on Home since the
 * risk strip shipped and nothing rendered it. This renders it — the engine's array, unchanged, no
 * re-grouping and no threshold of its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT MAY NOT SAY
 *
 * The directive: *"Do NOT invent overdraft probability. Do NOT claim the user will enter
 * overdraft."* So the wording is the one it supplies — several charges are scheduled close
 * together — and nothing here mentions a balance, a shortfall or a consequence. The engine DOES
 * compute a projected balance when the user has entered one, and that is the seven-day risk
 * strip's business; a cluster is a fact about dates and this component states only that.
 *
 * It is advisory amber and never red: charges arriving together is information with a date on it.
 */
export interface HomeBillingClusterProps {
  readonly context?: SurfaceContext;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoAtOffset(asOfDate: string, offset: number): string {
  const start = new Date(`${asOfDate}T00:00:00.000Z`);
  return new Date(start.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

export function HomeBillingCluster({ context }: HomeBillingClusterProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { money } = useMoney();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);

  const today = new Date().toISOString().slice(0, 10);
  const fallbackContext: SurfaceContext = {
    asOfDate: today,
    throughDate: isoAtOffset(today, 31),
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const results = evaluateSurfaceEngines(context ?? fallbackContext);
  const clusters = results.risk?.billingClusters ?? [];

  /* NO CLUSTER, NO CARD. A section headed "charges landing together" over an empty list is a gap
     announcing itself, which B2 refuses on a live route. */
  if (clusters.length === 0) return null;

  return (
    <View
      className={`mb-4 gap-2 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
      testID="home-billing-cluster"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('חיובים שמתרכזים באותו יום')}
      </AppText>
      <AppText className={`text-sm ${ROLE_TEXT.advisory}`} testID="home-billing-cluster-headline">
        {t('כמה חיובי כרטיס צפויים לרדת בסמיכות')}
      </AppText>

      {clusters.map((cluster) => (
        <Pressable
          accessibilityLabel={`${t('חיובים שמתרכזים באותו יום')} ${ltrNumerals(cluster.date)}`}
          accessibilityRole="link"
          className="min-h-[48px] justify-center"
          key={cluster.date}
          onPress={(): void => navigation.navigate('Plan')}
          testID={`home-billing-cluster-${cluster.date}`}
        >
          <RtlRow className="items-center justify-between gap-2">
            <AppText
              accessibilityValue={{ text: cluster.date }}
              className={`text-sm font-bold ${TEXT.body}`}
              style={TABULAR_NUMERALS}
            >
              {ltrNumerals(cluster.date)}
            </AppText>
            <AppText
              accessibilityValue={{ text: String(cluster.billingIds.length) }}
              className={`text-sm ${TEXT.secondary}`}
              style={TABULAR_NUMERALS}
              testID={`home-billing-cluster-${cluster.date}-count`}
            >
              {String(cluster.billingIds.length)}
            </AppText>
            <AppText
              accessibilityValue={{ text: String(cluster.totalBillingIls.value) }}
              className={`text-sm font-extrabold ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID={`home-billing-cluster-${cluster.date}-total`}
            >
              {money(cluster.totalBillingIls.value)}
            </AppText>
          </RtlRow>
        </Pressable>
      ))}

      <AppText className={`text-xs ${TEXT.muted}`} testID="home-billing-cluster-note">
        {t('לצפייה בתכנון')}
      </AppText>
    </View>
  );
}
