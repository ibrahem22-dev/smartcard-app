import React from 'react';
import { FlatList, Text, View, type ListRenderItem } from 'react-native';

import { useCashflowCalendar } from '../hooks/useCashflowCalendar';
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

  return 'bg-white dark:bg-neutral-900';
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount);
}

const renderCharge: ListRenderItem<CashflowCalendarCharge> = ({
  item,
}): React.ReactElement => {
  return (
    <View
      className={`mb-3 min-h-[82px] w-full flex-row-reverse items-center justify-between rounded-lg border border-slate-300 p-4 dark:border-neutral-700 rtl:flex-row-reverse ${getRiskRowClassName(
        item.riskLevel,
      )}`}
      style={rtl.row}
    >
      <View className="flex-1 items-stretch">
        <Text
          className="text-right text-base font-extrabold text-slate-900 dark:text-white"
          style={rtl.text}
        >
          {formatDisplayDate(item.date)}
        </Text>
        <Text
          className="mt-1 text-right text-sm text-slate-600 dark:text-slate-300"
          style={rtl.text}
        >
          {item.cardName}
        </Text>
      </View>
      <Text
        className="me-3.5 min-w-24 text-right text-[17px] font-black text-slate-900 dark:text-white"
        style={rtl.text}
      >
        {formatAmount(item.amount)}
      </Text>
    </View>
  );
};

export function CalendarScreen(): React.ReactElement {
  const charges = useCashflowCalendar();

  if (charges.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-neutral-950"
        style={rtl.screen}
      >
        <Text
          className="text-center text-lg font-extrabold text-slate-500 dark:text-slate-300"
          style={rtl.text}
        >
          אין חיובים מתוכננים 📅
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-slate-50 dark:bg-neutral-950"
      contentContainerStyle={[rtl.listInner, { paddingHorizontal: 20, paddingTop: 20 }]}
      data={charges}
      keyExtractor={(item: CashflowCalendarCharge): string =>
        `${item.date}-${item.cardName}-${item.amount}`
      }
      renderItem={renderCharge}
      style={rtl.scrollOuter}
    />
  );
}
