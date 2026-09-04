import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import {
  clearCrashLog,
  formatCrashLog,
  readCrashLog,
  type CrashEntry,
} from '../observability/crashLog';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

/**
 * CRASH LOG — criterion V9, MDC-OBSERVABILITY option 1.
 *
 * The screen READS the local crash log and lets the user copy it to the clipboard or clear it.
 * It sends nothing anywhere: "share" here means the user pastes the text into whatever they
 * choose. The entries were redacted when they were stored (see observability/crashLog.ts), so
 * this screen never sees an amount, a last-four or a date from an error message.
 */
export function CrashLogScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<readonly CrashEntry[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    setEntries(readCrashLog());
  }, []);

  const copy = useCallback(async (): Promise<void> => {
    await Clipboard.setStringAsync(formatCrashLog(entries));
    setCopied(true);
  }, [entries]);

  const clear = useCallback((): void => {
    clearCrashLog();
    setEntries([]);
    setCopied(false);
  }, []);

  return (
    <RtlScreen>
      <RtlScrollView className="flex-1 w-full" contentContainerClassName="pb-8">
        <View className="min-h-full w-full p-4">
          <AppText
            className={`mb-2 text-2xl font-extrabold ${TEXT.heading}`}
            style={{ color: theme.bankColor }}
          >
            {t('יומן קריסות')}
          </AppText>
          <AppText className={`mb-4 text-sm ${TEXT.secondary}`}>
            {t('היומן נשמר במכשיר בלבד ואינו נשלח לשום מקום. אפשר להעתיק אותו ולשתף ידנית.')}
          </AppText>

          <RtlRow className="mb-4 w-full gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: entries.length === 0 }}
              className={`min-h-[48px] flex-1 items-center justify-center rounded-lg border px-3 ${ACCENT.border} ${ACCENT.surface}`}
              disabled={entries.length === 0}
              onPress={(): void => {
                void copy();
              }}
              testID="crash-log-copy"
            >
              <AppText className={`text-center text-sm font-bold ${ACCENT.text}`}>
                {copied ? t('הועתק') : t('העתק')}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: entries.length === 0 }}
              className={`min-h-[48px] flex-1 items-center justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.card}`}
              disabled={entries.length === 0}
              onPress={clear}
              testID="crash-log-clear"
            >
              <AppText className={`text-center text-sm font-bold ${TEXT.secondary}`}>
                {t('נקה')}
              </AppText>
            </Pressable>
          </RtlRow>

          {entries.length === 0 ? (
            <AppText className={`text-base ${TEXT.secondary}`} testID="crash-log-empty">
              {t('אין קריסות שנשמרו')}
            </AppText>
          ) : (
            <View className="w-full gap-3">
              {entries.map((entry: CrashEntry, index: number): React.ReactElement => (
                <View
                  className={`rounded-lg border p-3 ${BORDER.hairline} ${SURFACE.card}`}
                  key={`${entry.at}-${index}`}
                  testID="crash-log-entry"
                >
                  <AppText className={`text-xs ${TEXT.secondary}`}>
                    {`${entry.at} · ${entry.kind} · v${entry.appVersion}`}
                  </AppText>
                  <AppText className={`mt-1 text-sm font-bold ${TEXT.heading}`}>
                    {`${entry.name}: ${entry.message}`}
                  </AppText>
                  <AppText className={`mt-1 text-xs ${TEXT.secondary}`} numberOfLines={12}>
                    {entry.stack}
                  </AppText>
                </View>
              ))}
            </View>
          )}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
