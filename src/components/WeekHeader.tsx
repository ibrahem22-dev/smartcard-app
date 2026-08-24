import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { BORDER, SURFACE, TEXT } from '../theme/tokens';
import { useLanguage } from '../hooks/useLanguage';
import { DAY_LETTERS, DAY_NAMES, WEEK_ORDER } from '../utils/calendar';

/**
 * THE CALENDAR'S WEEKDAY HEADER — criterion A6's *"Sunday-first with he/ar day letters"*.
 *
 * One component, so the week has one first day. The row order comes from `WEEK_ORDER` and the
 * letters from `DAY_LETTERS`, both in `src/utils/calendar.ts` — a header that decided its own order
 * would be a second place the week begins.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS ROW IS DELIBERATELY NOT DIRECTION-MIRRORED, AND THAT IS THE ONE EXCEPTION IN THE APP
 *
 * Every other row here mirrors with the language. This one must not.
 *
 * `WEEK_ORDER` is Sunday-first as an ARRAY. In Hebrew and Arabic the writing direction already lays
 * a plain row out right-to-left, so Sunday lands in the rightmost cell — which is where a Hebrew
 * calendar puts it. Wrapping this in a direction-aware row would reverse the array TOO, and two
 * reversals cancel: Sunday would come back to the left, under a grid of dates that had mirrored
 * once. The header and the dates would disagree by one reflection, and every date would sit under
 * the wrong letter.
 *
 * The next person to see an unmirrored row in this codebase will assume it is an oversight. It is
 * not, and this paragraph is why the `rtl-ok` marker below is not a silencer.
 *
 * A single letter read aloud is not a day, so each cell carries the full name as its accessibility
 * label — A9's word-beside-the-cue discipline, applied to a header nobody can otherwise hear.
 */
export interface WeekHeaderProps {
  readonly testID?: string;
}

export function WeekHeader({ testID }: WeekHeaderProps): React.ReactElement {
  const { language } = useLanguage();
  const letters = DAY_LETTERS[language];
  const names = DAY_NAMES[language];

  return (
    <View
      accessibilityRole="header"
      // See the header: the writing direction already mirrors this row, and mirroring it a second
      // time would put Sunday under Saturday's column of dates. The marker goes on the line
      // directly above the class, because that is the only place the scan reads it.
      // rtl-ok
      className={`flex-row border-b ${SURFACE.sunken} ${BORDER.hairline}`}
      testID={testID ?? 'week-header'}
    >
      {WEEK_ORDER.map((dayIndex) => (
        <View
          accessibilityLabel={names[dayIndex]}
          className="min-h-[44px] flex-1 items-center justify-center"
          key={dayIndex}
          testID={`week-header-day-${String(dayIndex)}`}
        >
          <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
            {letters[dayIndex]}
          </AppText>
        </View>
      ))}
    </View>
  );
}
