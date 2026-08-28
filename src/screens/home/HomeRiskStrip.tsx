import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

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
  type SurfaceEngineResults,
} from '../../surfaces';
import {
  BORDER,
  ROLE_BORDER,
  ROLE_SURFACE_BG,
  ROLE_TEXT,
  SURFACE,
  TEXT,
} from '../../theme/tokens';
import { riskPresentation } from '../../theme/riskPresentation';

export interface HomeRiskStripProps {
  readonly context?: SurfaceContext;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoAtOffset(asOfDate: string, offset: number): string {
  const start = new Date(`${asOfDate}T00:00:00.000Z`);
  return new Date(start.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

function explanationFor(
  results: SurfaceEngineResults,
  iso: string,
  t: UseTranslationResult['t'],
  money: (value: number, fractionDigits?: number) => string,
): string {
  const day = results.risk?.days.find((candidate) => candidate.date === iso);
  if (day === undefined) {
    const riskAbsence = results.absent.find((item) => item.engine === 'risk');
    if (riskAbsence?.because === 'NO_BILLING_DATES') {
      return t('אין מועדי חיוב, ולכן אי אפשר להעריך את יציאות הכרטיס ביום הזה.');
    }
    if (riskAbsence?.because === 'LOAD_UNAVAILABLE') {
      return t('נתוני העומס אינם זמינים, ולכן אי אפשר להעריך את היום הזה.');
    }
    return t('מנוע הסיכון לא החזיר תחזית ליום הזה.');
  }

  const events: string[] = [];
  if (day.salaryInflowIls.value > 0) {
    events.push(t('משכורת של {{amount}} נכנסת ביום הזה.', {
      amount: money(day.salaryInflowIls.value),
    }));
  }
  if (day.billingOutflowIls.value > 0) {
    events.push(t('חיוב כרטיס של {{amount}} יורד ביום הזה.', {
      amount: money(day.billingOutflowIls.value),
    }));
  }
  if (day.commitmentOutflowIls.value > 0) {
    events.push(t('התחייבויות של {{amount}} יורדות ביום הזה.', {
      amount: money(day.commitmentOutflowIls.value),
    }));
  }
  if (events.length === 0) {
    events.push(t('אין אירוע כספי מתוזמן ביום הזה.'));
  }
  if (day.projectedBalanceIls !== undefined) {
    events.push(t('אחרי הפעילות של היום, היתרה החזויה היא {{amount}}.', {
      amount: money(day.projectedBalanceIls.value),
    }));
  } else {
    events.push(t('לא הוזנה יתרה נוכחית, ולכן אין תחזית יתרה ליום הזה.'));
  }
  return events.join(' ');
}

export function HomeRiskStrip({ context }: HomeRiskStripProps): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);
  const [explainedDate, setExplainedDate] = useState<string | null>(null);

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
  const activeContext = context ?? fallbackContext;
  const results = evaluateSurfaceEngines(activeContext);
  const dates = Array.from({ length: 7 }, (_, index) => isoAtOffset(activeContext.asOfDate, index));

  return (
    <View
      className={`mb-4 gap-3 rounded-lg border p-[18px] ${BORDER.hairline} ${SURFACE.card}`}
      testID="home-risk-strip"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('תחזית סיכון לשבעה ימים')}
      </AppText>
      <RtlRow className="flex-wrap items-center justify-between gap-1">
        {dates.map((iso) => {
          const day = results.risk?.days.find((candidate) => candidate.date === iso);
          const level = day === undefined ? 'unknown' : day.riskLevel;
          const presentation = riskPresentation(level);
          const testID = `home-risk-strip-day-${iso}`;
          const explanationVisible = explainedDate === iso;

          return (
            <View
              accessibilityLabel={`${t('רמת הסיכון ליום {{date}}', { date: iso })}: ${t(presentation.labelKey)}`}
              accessibilityValue={{ text: level }}
              className="min-w-[42px] flex-1 items-center gap-1"
              key={iso}
              testID={testID}
            >
              <Pressable
                accessibilityLabel={t('הסבר על יום {{date}}', { date: iso })}
                accessibilityRole="button"
                className={`h-9 w-9 items-center justify-center rounded border ${presentation.className}`}
                onPress={() => setExplainedDate(explanationVisible ? null : iso)}
                testID={`${testID}-explain`}
              >
                <AppText
                  className={`text-sm font-black ${ROLE_TEXT.neutral}`}
                  testID={`${testID}-cue`}
                >
                  {presentation.cue}
                </AppText>
              </Pressable>
              <AppText className={`text-[12px] font-bold ${TEXT.secondary}`}>
                {iso.slice(5)}
              </AppText>
              <AppText className={`text-[12px] font-extrabold ${presentation.className}`}>
                {level}
              </AppText>
              {explanationVisible ? (
                <AppText
                  className={`w-full text-xs leading-5 ${TEXT.body}`}
                  testID={`${testID}-explanation`}
                >
                  {explanationFor(results, iso, t, money)}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </RtlRow>
    </View>
  );
}
