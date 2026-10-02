import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { WeekHeader } from '../../components/WeekHeader';
import { RtlRow } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineResults,
} from '../../surfaces';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { monthGridFor, type MonthGridDay } from './monthGrid';
import { DaySheet } from './DaySheet';

const { DayMarkers, DayMarkersLegend } = require('./DayMarkers.tsx') as {
  readonly DayMarkers: React.ComponentType<{
    readonly iso: string;
    readonly results: SurfaceEngineResults;
  }>;
  readonly DayMarkersLegend: React.ComponentType;
};

export interface MonthGridProps {
  readonly year: number;
  readonly month: number;
  readonly context?: SurfaceContext;
  readonly onDayPress?: (day: MonthGridDay) => void;
}

export function MonthGrid({
  year,
  month,
  context,
  onDayPress,
}: MonthGridProps): React.ReactElement {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = React.useState<MonthGridDay | null>(null);
  const weeks = monthGridFor(year, month);
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);
  const monthDays = weeks.flat().filter((day) => day.inMonth);
  const fallbackContext: SurfaceContext = {
    asOfDate: monthDays[0]?.iso ?? `${String(year)}-01-01`,
    throughDate: monthDays[monthDays.length - 1]?.iso ?? `${String(year)}-01-01`,
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const activeContext = context ?? fallbackContext;
  const results = evaluateSurfaceEngines(activeContext);

  return (
    <>
      <View
        className={`mb-5 overflow-hidden rounded-lg border ${SURFACE.card} ${BORDER.hairline}`}
        testID="calendar-month-grid"
      >
        <WeekHeader />
        <DayMarkersLegend />
        {weeks.map((week, weekIndex) => (
          <RtlRow
            /* Direction-aware, exactly like WeekHeader above it — see the note there. A device run
               showed both rows laying out identically in Hebrew and English, because the writing
               direction this used to rely on is one the app deliberately never sets. They reverse
               together, so a date never sits under the wrong letter. */
            key={week[0]?.iso ?? String(weekIndex)}
            testID={`calendar-week-${String(weekIndex)}`}
          >
            {week.map((day) => (
              <Pressable
                accessibilityLabel={t('יום {{day}}', { day: day.dayOfMonth })}
                accessibilityRole="button"
                className="min-h-[52px] flex-1 items-center justify-center gap-0.5 py-1"
                key={day.iso}
                onPress={(): void => {
                  setSelectedDay(day);
                  onDayPress?.(day);
                }}
                testID={`calendar-day-${day.iso}`}
              >
                <View
                  testID={day.inMonth ? undefined : `calendar-day-${day.iso}-outside`}
                >
                  <AppText
                    className={`text-sm ${day.inMonth ? TEXT.body : TEXT.muted}`}
                  >
                    {String(day.dayOfMonth)}
                  </AppText>
                </View>
                <DayMarkers iso={day.iso} results={results} />
              </Pressable>
            ))}
          </RtlRow>
        ))}
      </View>
      {selectedDay === null ? null : (
        <DaySheet context={activeContext} iso={selectedDay.iso} results={results} />
      )}
    </>
  );
}
