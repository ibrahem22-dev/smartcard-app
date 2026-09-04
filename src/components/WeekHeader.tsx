import React from 'react';
import { RtlRow } from './rtl';
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
 * `WEEK_ORDER` is Sunday-first as an ARRAY, and this row is direction-aware so that Sunday lands in
 * the RIGHTMOST cell in Hebrew and Arabic — which is where those calendars put it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS COMMENT USED TO SAY, AND WHY IT WAS WRONG
 *
 * It used to argue that a plain `flex-row` was correct here: *"In Hebrew and Arabic the writing
 * direction already lays a plain row out right-to-left, so Sunday lands in the rightmost cell …
 * Wrapping this in a direction-aware row would reverse the array TOO, and two reversals cancel."*
 * It even warned the next reader not to mistake the unmirrored row for an oversight.
 *
 * **There is no first reversal.** `RtlRow` is this app's single RTL mechanism and it works by
 * explicit `row-reverse`; its own comment forbids setting `direction: 'rtl'` anywhere, because
 * combining the two double-flips a row (ISSUE-RTL-01). So nothing was mirroring this row, and the
 * argument for leaving it alone rested on a runtime behaviour the app deliberately does not use.
 *
 * Running the app on the emulator showed it plainly: in Hebrew the columns read Sunday-leftmost to
 * Saturday-rightmost, **identical to English**, while the tab bar and the segmented control mirrored
 * correctly in the same screenshot. Two reflections cannot cancel when only one was ever applied.
 *
 * The header and the dates still agree, because `MonthGrid`'s week rows are direction-aware too:
 * they reverse together, so a date never sits under the wrong letter.
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
    <RtlRow
      accessibilityRole="header"
      className={`border-b ${SURFACE.sunken} ${BORDER.hairline}`}
      testID={testID ?? 'week-header'}
    >
      {WEEK_ORDER.map((dayIndex) => (
        <View
          accessibilityLabel={names[dayIndex]}
          className="min-h-[48px] flex-1 items-center justify-center"
          key={dayIndex}
          testID={`week-header-day-${String(dayIndex)}`}
        >
          <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
            {letters[dayIndex]}
          </AppText>
        </View>
      ))}
    </RtlRow>
  );
}
