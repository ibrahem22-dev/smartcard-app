import React from 'react';
import { FlatList, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen } from '../components/rtl';
import { useCashflowCalendar } from '../hooks/useCashflowCalendar';
import { useTheme } from '../hooks/useTheme';
import { useMoney } from '../hooks/useMoney';
import { TABULAR_NUMERALS } from '../utils/money';
import { useTranslation } from '../hooks/useTranslation';
import type { CashflowCalendarCharge } from '../types/cashflow.types';
import { BORDER, ROLE_SURFACE_BG, SURFACE, TEXT } from '../theme/tokens';
import { WeekHeader } from '../components/WeekHeader';
import { ltrNumerals } from '../utils/calendar';

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-');
  // LTR-ISOLATED. A date is a numeric run with slashes between the parts, and both the digits and
  // the slashes are direction-neutral: inside a Hebrew or Arabic sentence the bidirectional
  // algorithm reorders the segments and a reader sees 2026/08/12 for the twelfth of August. Not a
  // rendering artefact — the same characters, in a different order, meaning a different date.
  return ltrNumerals(`${day}/${month}/${year}`);
}

function getRiskRowClassName(riskLevel: number): string {
  if (riskLevel >= 3) {
    return `${ROLE_SURFACE_BG.danger}`;
  }
  if (riskLevel === 2) {
    return `${ROLE_SURFACE_BG.advisory}`;
  }
  return `${ROLE_SURFACE_BG.positive}`;
}

// The formatter is no longer defined here. A7: exactly one exists, in src/utils/money.ts, and
// it reaches this screen through useMoney() so it formats in the language the reader chose.

// THE FORMATTER ARRIVES AS AN ARGUMENT. This function sits outside the component tree, which is
// exactly why the version it replaces hardcoded 'he-IL': a module-level function cannot ask what
// language the reader chose, so its author picked one. Passing it in is what makes the choice the
// reader's.
function renderCharge(
  item: CashflowCalendarCharge,
  companyAccent: string,
  money: (value: number) => string,
): React.ReactElement {
  return (
    <RtlRow
      className={`mb-3 min-h-[82px] w-full items-center justify-between rounded-lg border p-4 ${BORDER.hairline} ${getRiskRowClassName(
        item.riskLevel,
      )}`}
      style={{ borderColor: companyAccent }}
    >
      <View className="flex-1 items-stretch">
        <AppText
          className={`text-base font-extrabold ${TEXT.heading}`}
          style={{ color: companyAccent }}
        >
          {formatDisplayDate(item.date)}
        </AppText>
        <AppText className={`mt-1 text-sm ${TEXT.secondary}`}>
          {item.cardName}
        </AppText>
      </View>
      <AppText
        className={`me-3.5 min-w-24 text-[17px] font-black ${TEXT.heading}`}
        style={TABULAR_NUMERALS}
      >
        {money(item.amount)}
      </AppText>
    </RtlRow>
  );
}

export function CalendarScreen(): React.ReactElement {
  const theme = useTheme();
  const { money } = useMoney();
  const { t } = useTranslation();
  const charges = useCashflowCalendar();

  if (charges.length === 0) {
    return (
      <RtlScreen className={`items-center justify-center p-6 ${SURFACE.page}`}>
        <AppText className={`text-center text-lg font-extrabold ${TEXT.muted}`}>
          {t('אין חיובים מתוכננים 📅')}
        </AppText>
      </RtlScreen>
    );
  }

  return (
    <FlatList
      className={`flex-1 ${SURFACE.page}`}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 }}
      data={charges}
      ListHeaderComponent={WeekHeader}
      keyExtractor={(item: CashflowCalendarCharge): string =>
        `${item.date}-${item.cardName}-${item.amount}`
      }
      renderItem={({ item }): React.ReactElement =>
        renderCharge(item, theme.companyAccent, money)
      }
      style={{
        flex: 1,
        borderTopColor: theme.bankColor,
        borderTopWidth: 2,
      }}
    />
  );
}
