import React from 'react';
import { useAppDirection } from '../../hooks/useAppDirection';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation, type UseTranslationResult } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineAbsence,
} from '../../surfaces';
import { BORDER, ROLE_SURFACE_BG, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';

export interface HomeLoadBarProps {
  readonly context?: SurfaceContext;
}

const LOAD_BAND_FILL = {
  safe: ROLE_SURFACE_BG.neutral,
  warning: ROLE_SURFACE_BG.advisory,
  strong_warning: ROLE_SURFACE_BG.advisory,
  blocked: ROLE_SURFACE_BG.danger,
} as const;

function absenceText(
  absence: SurfaceEngineAbsence | undefined,
  t: UseTranslationResult['t'],
): string {
  switch (absence?.because) {
    case 'NO_PROFILE':
      return t('לא נטען פרופיל מהכספת, ולכן אין הכנסה שאפשר למדוד מולה');
    case 'NO_INCOME':
      return t('לא הוזנה הכנסה חודשית; ליחס העומס אין מכנה');
    case 'LOAD_UNAVAILABLE':
      return t('תוצאת העומס אינה זמינה');
    case 'NO_CARDS':
      return t('אין כרטיסים בכספת');
    case 'NO_BILLING_DATES':
      return t('אין מועדי חיוב זמינים');
    case undefined:
      return t('לא הוזנה הכנסה חודשית; ליחס העומס אין מכנה');
  }
}

/** Converts an engine ratio into the percentage coordinate React Native requires for placement. */
/**
 * WHERE A THRESHOLD TICK SITS, MEASURED FROM THE LEADING EDGE.
 *
 * This returned a percentage for React Native's `start`, which is direction-aware **only when
 * `I18nManager.isRTL` is set**. This app never sets it: `RtlRow` is the single RTL mechanism and it
 * works by explicit `row-reverse`, precisely so that Yoga's locale flip and a manual flip cannot
 * cancel (ISSUE-RTL-01). So `start` resolved to `left` in every language.
 *
 * The device showed it: on a bar spanning x 96→984, both ticks sat at the SAME absolute x in Hebrew
 * as in English, while the two labels above them swapped sides correctly. 35% from the left is 65%
 * from the right, so in Hebrew the warning threshold was drawn where neither threshold is.
 *
 * Taking `isRTL` from the app's own direction hook keeps one source of truth for the answer. It is
 * the same false premise the calendar grid was built on, in a second place — see `WeekHeader.tsx`.
 */
function tickOffset(ratio: number, isRTL: boolean): { left?: `${number}%`; right?: `${number}%` } {
  const pct = `${ratio * 100}%` as `${number}%`;
  return isRTL ? { right: pct } : { left: pct };
}

export function HomeLoadBar({ context }: HomeLoadBarProps): React.ReactElement {
  const { t } = useTranslation();
  const dir = useAppDirection();
  const { money, percent } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);

  const fallbackContext: SurfaceContext = {
    asOfDate: '1970-01-01',
    throughDate: '1970-01-01',
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const results = evaluateSurfaceEngines(context ?? fallbackContext);
  const load = results.load;

  if (load === null) {
    const loadAbsence = results.absent.find((item) => item.engine === 'load');
    return (
      <View
        className={`mb-4 gap-2 rounded-lg border p-[18px] ${BORDER.hairline} ${SURFACE.card}`}
      >
        <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
          {t('עומס מול הכנסה')}
        </AppText>
        <AppText
          className={`text-sm leading-5 ${TEXT.secondary}`}
          testID="home-load-bar-absent"
        >
          {absenceText(loadAbsence, t)}
        </AppText>
      </View>
    );
  }

  const ratio = load.current.ratioOfIncome.value;
  const fillFraction = Math.min(1, Math.max(0, ratio));
  const strongWarningRatio = load.thresholds.strongWarningRatio.value;
  const blockedRatio = load.thresholds.blockedRatio.value;

  /* CommitmentsSummary's bar is embedded in its Plan-only multi-section component and that file
     is outside this task's writable scope, so extracting one shared renderer would require an
     unauthorized Plan edit. Both surfaces still read the same unmodified load-result fields. */
  return (
    <View
      className={`mb-4 gap-3 rounded-lg border p-[18px] ${BORDER.hairline} ${SURFACE.card}`}
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('עומס מול הכנסה')}
      </AppText>

      <RtlRow className="items-center justify-between gap-4">
        <View className="gap-1">
          <AppText className={`text-xs ${TEXT.secondary}`}>
            {t('יחס העומס הנוכחי להכנסה')}
          </AppText>
          <AppText
            accessibilityValue={{ text: String(ratio) }}
            className={`text-3xl font-black ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="home-load-bar-ratio"
          >
            {percent(ratio)}
          </AppText>
        </View>
        <View className="gap-1">
          <AppText className={`text-xs ${TEXT.secondary}`}>
            {t('התחייבויות חודשיות')}
          </AppText>
          <AppText
            accessibilityValue={{
              text: String(load.current.monthlyObligationsIls.value),
            }}
            className={`text-xl font-extrabold ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="home-load-bar-absolute"
          >
            {money(load.current.monthlyObligationsIls.value)}
          </AppText>
        </View>
      </RtlRow>

      <View className="gap-1">
        <RtlRow
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 1,
            now: ratio,
            text: String(ratio),
          }}
          className={`h-3 w-full overflow-hidden rounded-full ${SURFACE.sunken}`}
          testID="home-load-bar"
        >
          <View
            className={LOAD_BAND_FILL[load.current.band]}
            style={{ flex: fillFraction }}
          />
          <View style={{ flex: 1 - fillFraction }} />
        </RtlRow>
        <View className="relative h-5 w-full">
          <AppText
            accessibilityLabel={t('סף אזהרה חזקה')}
            accessibilityValue={{ text: String(strongWarningRatio) }}
            className={`absolute text-xs ${TEXT.muted}`}
            style={[TABULAR_NUMERALS, tickOffset(strongWarningRatio, dir.isRTL)]}
            testID="home-load-bar-tick-strong"
          >
            {percent(strongWarningRatio)}
          </AppText>
          <AppText
            accessibilityLabel={t('סף חסימה')}
            accessibilityValue={{ text: String(blockedRatio) }}
            className={`absolute text-xs ${TEXT.muted}`}
            style={[TABULAR_NUMERALS, tickOffset(blockedRatio, dir.isRTL)]}
            testID="home-load-bar-tick-blocked"
          >
            {percent(blockedRatio)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
