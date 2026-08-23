import React from 'react';
import { FlatList, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen } from '../components/rtl';
import { useCashflowCalendar } from '../hooks/useCashflowCalendar';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { CashflowCalendarCharge } from '../types/cashflow.types';
import { ROLE_SURFACE_BG, SURFACE, TEXT } from '../theme/tokens';

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
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

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('he-IL')} ₪`;
}

function renderCharge(
  item: CashflowCalendarCharge,
  companyAccent: string,
): React.ReactElement {
  return (
    <RtlRow
      className={`mb-3 min-h-[82px] w-full items-center justify-between rounded-lg border border-slate-300 p-4 dark:border-neutral-700 ${getRiskRowClassName(
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
      <AppText className={`me-3.5 min-w-24 text-[17px] font-black ${TEXT.heading}`}>
        {formatAmount(item.amount)}
      </AppText>
    </RtlRow>
  );
}

export function CalendarScreen(): React.ReactElement {
  const theme = useTheme();
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
      keyExtractor={(item: CashflowCalendarCharge): string =>
        `${item.date}-${item.cardName}-${item.amount}`
      }
      renderItem={({ item }): React.ReactElement =>
        renderCharge(item, theme.companyAccent)
      }
      style={{
        flex: 1,
        borderTopColor: theme.bankColor,
        borderTopWidth: 2,
      }}
    />
  );
}
