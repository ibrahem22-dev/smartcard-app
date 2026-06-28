import React from 'react';
import { FlatList, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen } from '../components/rtl';
import { useCashflowCalendar } from '../hooks/useCashflowCalendar';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { CashflowCalendarCharge } from '../types/cashflow.types';

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function getRiskRowClassName(riskLevel: number): string {
  if (riskLevel >= 3) {
    return 'bg-red-100 dark:bg-red-950';
  }
  if (riskLevel === 2) {
    return 'bg-amber-100 dark:bg-amber-950';
  }
  return 'bg-green-100 dark:bg-green-950';
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
          className="text-base font-extrabold text-slate-900 dark:text-white"
          style={{ color: companyAccent }}
        >
          {formatDisplayDate(item.date)}
        </AppText>
        <AppText className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {item.cardName}
        </AppText>
      </View>
      <AppText className="me-3.5 min-w-24 text-[17px] font-black text-slate-900 dark:text-white">
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
      <RtlScreen className="items-center justify-center bg-slate-50 p-6 dark:bg-app-dark">
        <AppText className="text-center text-lg font-extrabold text-slate-500 dark:text-slate-300">
          {t('אין חיובים מתוכננים 📅')}
        </AppText>
      </RtlScreen>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-slate-50 dark:bg-app-dark"
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
