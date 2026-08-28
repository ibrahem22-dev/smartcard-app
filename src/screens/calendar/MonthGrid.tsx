import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { WeekHeader } from '../../components/WeekHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { monthGridFor, type MonthGridDay } from './monthGrid';

export interface MonthGridProps {
  readonly year: number;
  readonly month: number;
  readonly onDayPress?: (day: MonthGridDay) => void;
}

export function MonthGrid({
  year,
  month,
  onDayPress,
}: MonthGridProps): React.ReactElement {
  const { t } = useTranslation();
  const weeks = monthGridFor(year, month);

  return (
    <View
      className={`mb-5 overflow-hidden rounded-lg border ${SURFACE.card} ${BORDER.hairline}`}
      testID="calendar-month-grid"
    >
      <WeekHeader />
      {weeks.map((week, weekIndex) => (
        <View
          // The weekday header uses the same deliberate exception: RTL writing direction already
          // places WEEK_ORDER right-to-left, so a direction-aware row would reverse it twice.
          // rtl-ok
          className="flex-row"
          key={week[0]?.iso ?? String(weekIndex)}
          testID={`calendar-week-${String(weekIndex)}`}
        >
          {week.map((day) => (
            <Pressable
              accessibilityLabel={t('יום {{day}}', { day: day.dayOfMonth })}
              accessibilityRole="button"
              className="min-h-[44px] flex-1 items-center justify-center"
              key={day.iso}
              onPress={(): void => onDayPress?.(day)}
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
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
