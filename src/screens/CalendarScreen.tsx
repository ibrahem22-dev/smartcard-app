import React from 'react';
import { FlatList, View } from 'react-native';

import { AppText } from '../components/AppText';
import { useCashflowCalendar } from '../hooks/useCashflowCalendar';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { CashflowCalendarCharge } from '../types/cashflow.types';
import { rtl } from '../utils/rtlStyles';

function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = parsed.getUTCDate().toString().padStart(2, '0');
  const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = parsed.getUTCFullYear().toString();

  return `${day}/${month}/${year}`;
}

function getRiskRowClassName(riskLevel: number): string {
  if (riskLevel > 60) {
    return 'bg-red-100 dark:bg-red-950';
  }

  if (riskLevel >= 30) {
    return 'bg-yellow-100 dark:bg-yellow-950';
  }

  return 'bg-white dark:bg-dark-surface';
}

function formatAmount(amount: number): string {
  // Number first, then ₪. Do NOT use Intl currency style: on Hermes/Android
  // without full-ICU it renders the ISO code in the wrong order ("ILS 0").
  return `${amount.toLocaleString('he-IL', {
    maximumFractionDigits: 0,
  })} ₪`;
}

function renderCharge(
  item: CashflowCalendarCharge,
  companyAccent: string,
): React.ReactElement {
  return (
    <View
      className={`mb-3 min-h-[82px] w-full flex-row items-center justify-between rounded-lg border border-slate-300 p-4 dark:border-neutral-700 rtl:flex-row ${getRiskRowClassName(
        item.riskLevel,
      )}`}
      style={[rtl.row, { borderColor: companyAccent }]}
    >
      <View className="flex-1 items-stretch">
        <AppText
          className="text-base font-extrabold text-slate-900 dark:text-white"
          style={{ color: companyAccent }}
        >
          {formatDisplayDate(item.date)}
        </AppText>
        <AppText
          className="mt-1 text-sm text-slate-600 dark:text-slate-300"
        >
          {item.cardName}
        </AppText>
      </View>
      <AppText
        className="me-3.5 min-w-24 text-[17px] font-black text-slate-900 dark:text-white"
      >
        {formatAmount(item.amount)}
      </AppText>
    </View>
  );
}

export function CalendarScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const charges = useCashflowCalendar();

  if (charges.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-app-dark"
        style={rtl.screen}
      >
        <AppText
          className="text-center text-lg font-extrabold text-slate-500 dark:text-slate-300"
        >
          {t('אין חיובים מתוכננים 📅')}
        </AppText>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      contentContainerStyle={[rtl.listInner, { paddingHorizontal: 20, paddingTop: 20 }]}
      data={charges}
      keyExtractor={(item: CashflowCalendarCharge): string =>
        `${item.date}-${item.cardName}-${item.amount}`
      }
      renderItem={({ item }): React.ReactElement =>
        renderCharge(item, theme.companyAccent)
      }
      style={[
        rtl.scrollOuter,
        {
          borderTopColor: theme.bankColor,
          borderTopWidth: 2,
        },
      ]}
    />
  );
}
