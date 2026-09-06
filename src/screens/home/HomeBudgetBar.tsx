import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
} from '../../surfaces';
import { BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';
import { budgetProgress, type BudgetBand } from './budgetProgress';

/**
 * THE COMMAND CENTER'S BUDGET BAR — a target the user chose, against outflow the app can see.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT IS NOT A SPENDING BAR AND THE LABEL SAYS SO
 *
 * There is no bank connection. What this counts is the user's own monthly obligations plus the
 * purchases they logged this month — both of them things they entered — and the caption states
 * exactly that rather than calling it spending. The directive's instruction is the reason:
 * *"Never imply bank-account transaction synchronization unless it exists."*
 *
 * IT IS ALSO NOT THE LOAD BAR. `HomeLoadBar` measures obligations against INCOME with the load
 * engine's own thresholds. This measures outflow against a figure the user typed. The obligation
 * total in both comes from one engine result, so the shared half cannot disagree.
 *
 * NO ALARM. Over target reads "over the target you set", in the advisory role. Nothing here is
 * red: the user going past a target they chose is information, not a hazard, which is the same
 * line `WaiverBadge` and `ConflictedValue` already hold.
 */
export interface HomeBudgetBarProps {
  readonly context?: SurfaceContext;
  /** `yyyy-mm`. Supplied by tests; defaults to the current month. */
  readonly monthIso?: string;
}

const BAND_FILL: Readonly<Record<BudgetBand, string>> = {
  'no-target': ROLE_SURFACE_BG.neutral,
  'on-track': ROLE_SURFACE_BG.positive,
  approaching: ROLE_SURFACE_BG.advisory,
  over: ROLE_SURFACE_BG.advisory,
};

export function HomeBudgetBar({ context, monthIso }: HomeBudgetBarProps): React.ReactElement {
  const { t } = useTranslation();
  const { money, percent } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);

  const today = new Date().toISOString().slice(0, 10);
  const fallbackContext: SurfaceContext = {
    asOfDate: today,
    throughDate: today,
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const activeContext = context ?? fallbackContext;
  const results = evaluateSurfaceEngines(activeContext);

  const reading = budgetProgress({
    targetIls: activeContext.profile?.monthlyBudgetTargetIls,
    load: results.load,
    purchases: activeContext.purchases,
    monthIso: monthIso ?? activeContext.asOfDate.slice(0, 7),
  });

  const fill = reading.ratioOfTarget === undefined
    ? 0
    : Math.min(1, Math.max(0, reading.ratioOfTarget));

  return (
    <View
      className={`mb-4 gap-3 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
      testID="home-budget-bar-card"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('יעד הוצאה חודשי')}
      </AppText>

      {reading.band === 'no-target' ? (
        <AppText className={`text-sm leading-5 ${TEXT.secondary}`} testID="home-budget-bar-unset">
          {reading.targetIls === undefined
            ? t('לא הוגדר יעד חודשי. אפשר להגדיר אותו בהגדרות.')
            : t('הוגדר יעד, אך אין עדיין נתונים למדוד מולו')}
        </AppText>
      ) : (
        <>
          <RtlRow className="items-center justify-between gap-4">
            <View className="gap-1">
              <AppText className={`text-xs ${TEXT.secondary}`}>{t('מהיעד')}</AppText>
              <AppText
                accessibilityValue={{ text: String(reading.ratioOfTarget ?? 0) }}
                className={`text-h1 font-black ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
                testID="home-budget-bar-ratio"
              >
                {percent(reading.ratioOfTarget ?? 0)}
              </AppText>
            </View>
            <View className="gap-1">
              <AppText className={`text-xs ${TEXT.secondary}`}>{t('היעד שהגדרת')}</AppText>
              <AppText
                accessibilityValue={{ text: String(reading.targetIls ?? 0) }}
                className={`text-xl font-extrabold ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
                testID="home-budget-bar-target"
              >
                {money(reading.targetIls ?? 0)}
              </AppText>
            </View>
          </RtlRow>

          <RtlRow
            accessibilityLabel={t('התקדמות מול יעד ההוצאה החודשי')}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 1,
              now: fill,
              text: String(reading.ratioOfTarget ?? 0),
            }}
            className={`h-3 w-full overflow-hidden rounded-full ${SURFACE.sunken}`}
            testID="home-budget-bar"
          >
            <View className={BAND_FILL[reading.band]} style={{ flex: fill }} />
            <View style={{ flex: 1 - fill }} />
          </RtlRow>

          <AppText
            className={`text-sm font-bold ${reading.band === 'on-track' ? TEXT.body : ROLE_TEXT.advisory}`}
            testID="home-budget-bar-band"
          >
            {reading.band === 'on-track'
              ? t('בתוך היעד')
              : reading.band === 'approaching'
                ? t('מתקרבים ליעד')
                : t('מעל היעד שהגדרת')}
          </AppText>

          <AppText
            accessibilityValue={{ text: String(reading.seenOutflowIls ?? 0) }}
            className={`text-sm ${TEXT.body}`}
            style={TABULAR_NUMERALS}
            testID="home-budget-bar-seen"
          >
            {money(reading.seenOutflowIls ?? 0)}
          </AppText>
        </>
      )}

      {/* THE CAPTION IS LOAD-BEARING. It is what stops the figure above being read as a bank
          statement, and it names both halves of the sum. */}
      <AppText className={`text-xs leading-5 ${TEXT.muted}`} testID="home-budget-bar-basis">
        {t('נמדד לפי ההתחייבויות החודשיות שלך והרכישות שרשמת החודש. האפליקציה אינה מחוברת לחשבון הבנק ואינה רואה חיובים שלא הוזנו.')}
      </AppText>
    </View>
  );
}
