import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import type { SurfaceContext, SurfaceEngineResults } from '../../surfaces';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';
import {
  DAY_EVENT_ORDER,
  dayEventsFor,
  type DayEvent,
  type DayEventKind,
} from './dayEvents';

export interface DaySheetProps {
  readonly iso?: string;
  readonly results?: SurfaceEngineResults;
  readonly context?: SurfaceContext;
}

function kindTitle(
  kind: DayEventKind,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (kind) {
    case 'salary-in':
      return t('משכורת נכנסת');
    case 'card-billing':
      return t('חיובי כרטיסים');
    case 'installment-due':
      return t('תשלומים לפירעון');
    case 'loan-or-mortgage':
      return t('הלוואות ומשכנתא');
    case 'fixed-order':
      return t('הוראות קבע');
  }
}

function EventRow({
  event,
  index,
}: {
  readonly event: DayEvent;
  readonly index: number;
}): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const testID = `calendar-day-event-${event.kind}-${String(index)}`;
  const label = event.kind === 'salary-in' ? t('משכורת') : event.label;

  return (
    <View className="mt-2 gap-1" testID={testID}>
      <AppText className={`text-sm ${TEXT.body}`}>{label}</AppText>
      {event.amountIls === undefined ? null : (
        <AppText
          accessibilityValue={{ text: String(event.amountIls) }}
          className={`text-sm font-extrabold ${TEXT.heading}`}
          style={TABULAR_NUMERALS}
          testID={`${testID}-amount`}
        >
          {money(event.amountIls)}
        </AppText>
      )}
      {event.derived ? (
        <ProvenanceChip
          testID={`${testID}-estimate`}
          view={{ chip: 'ESTIMATE', stale: false }}
        />
      ) : null}
    </View>
  );
}

function PressureSummary({
  iso,
  results,
}: {
  readonly iso: string;
  readonly results: SurfaceEngineResults;
}): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const day = results.risk?.days.find((candidate) => candidate.date === iso);
  let summary: string;

  if (day === undefined) {
    summary = t('הסכומים מפורטים למטה; המנוע לא פרסם סך יומי');
  } else if (day.totalOutflowIls.value > 0 && day.salaryInflowIls.value > 0) {
    summary = t('יוצאים {{outflow}} ונכנסת משכורת {{salary}}', {
      outflow: money(day.totalOutflowIls.value),
      salary: money(day.salaryInflowIls.value),
    });
  } else if (day.totalOutflowIls.value > 0) {
    summary = t('יוצאים {{outflow}}; משכורת לא נכנסת היום', {
      outflow: money(day.totalOutflowIls.value),
    });
  } else if (day.salaryInflowIls.value > 0) {
    summary = t('לא יוצא סכום מתוזמן; נכנסת משכורת {{salary}}', {
      salary: money(day.salaryInflowIls.value),
    });
  } else {
    summary = t('אין יציאה מתוזמנת ואין כניסת משכורת היום');
  }

  return (
    <AppText
      className={`text-sm ${TEXT.secondary}`}
      numberOfLines={1}
      testID="calendar-day-sheet-summary"
    >
      {summary}
    </AppText>
  );
}

export function DaySheet({
  iso,
  results,
  context,
}: DaySheetProps): React.ReactElement {
  const { t } = useTranslation();
  if (iso === undefined || results === undefined || context === undefined) {
    return (
      <View
        className={`mt-3 gap-3 rounded-lg border p-4 ${SURFACE.raised} ${BORDER.subtle}`}
        testID="calendar-day-sheet"
      >
        <AppText
          className={`text-sm ${TEXT.secondary}`}
          numberOfLines={1}
          testID="calendar-day-sheet-summary"
        >
          {t('יש לבחור יום כדי לראות מה מתוזמן')}
        </AppText>
        <AppText
          className={`text-sm ${TEXT.muted}`}
          testID="calendar-day-sheet-empty"
        >
          {t('עדיין לא נבחר יום')}
        </AppText>
      </View>
    );
  }
  const events = dayEventsFor(results, context, iso);

  return (
    <View
      className={`mt-3 gap-3 rounded-lg border p-4 ${SURFACE.raised} ${BORDER.subtle}`}
      testID="calendar-day-sheet"
    >
      <AppText className={`text-base font-extrabold ${TEXT.heading}`}>{iso}</AppText>
      <PressureSummary iso={iso} results={results} />
      {events.length === 0 ? (
        <AppText
          className={`text-sm ${TEXT.muted}`}
          testID="calendar-day-sheet-empty"
        >
          {t('שום דבר לא מתוזמן ליום הזה')}
        </AppText>
      ) : null}
      {DAY_EVENT_ORDER.map((kind) => {
        const rows = events.filter((event) => event.kind === kind);
        return (
          <View
            className={`rounded-lg border p-3 ${SURFACE.card} ${BORDER.hairline}`}
            key={kind}
            testID={`calendar-day-event-kind-${kind}`}
          >
            <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>
              {kindTitle(kind, t)}
            </AppText>
            {/* Every taxonomy group stays visible; an empty group gets one consistent honest line. */}
            {rows.length === 0 ? (
              <AppText
                className={`mt-2 text-sm ${TEXT.muted}`}
                testID={`calendar-day-event-empty-${kind}`}
              >
                {t('שום דבר מהסוג הזה לא מתוזמן ליום הזה')}
              </AppText>
            ) : (
              rows.map((event, index) => (
                <EventRow event={event} index={index} key={`${event.label}-${String(index)}`} />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
