import React from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { FeatureGate } from '../components/FeatureGate';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { PurchaseGateStackParamList } from '../navigation/types';
import type { DecisionVerdict } from '../types/decision.types';

type DecisionScreenProps = NativeStackScreenProps<
  PurchaseGateStackParamList,
  'Decision'
>;

const VERDICT_LABELS: Record<DecisionVerdict, string> = {
  approved: 'אושר ✓',
  warning: 'שים לב ⚠️',
  blocked: 'נחסם ✗',
  wait_24h: 'המתן 24 שעות ⏳',
};

/**
 * D6 / WP-2.3 — THE CANNED PER-VERDICT REASONS ARE GONE.
 *
 * What used to be here: `VERDICT_FALLBACK_REASONS`, four sentences keyed by verdict —
 * *"the purchase may endanger your cashflow"*, *"the purchase looks suitable for your current
 * cashflow"*. A previous session had already stopped them overriding the engine's own reason, and
 * left them as a fallback for when none arrived.
 *
 * THE FALLBACK IS THE DEFECT D6 NAMES. Those sentences are not copy about the app; they are
 * **findings about the user's money**, written in the voice of an engine that did not produce them.
 * A user cannot tell "the engine examined your cashflow and this is what it found" from "no engine
 * reason arrived, so here is a plausible sentence for this verdict" — and the second reads exactly
 * like the first.
 *
 * `P2_COMPLETION_CONTRACT.md` §1: **P2 renders facts and refusals.** Every derivation is P3. So
 * when no reason arrives, the screen now says that no reason arrived. It is a worse sentence to
 * read and a true one.
 */

const VERDICT_CLASSES: Record<DecisionVerdict, string> = {
  approved: 'bg-green-100 border-green-600 dark:bg-green-950 dark:border-green-500',
  warning: 'bg-amber-100 border-amber-600 dark:bg-amber-950 dark:border-amber-500',
  blocked: 'bg-red-100 border-red-600 dark:bg-red-950 dark:border-red-500',
  wait_24h: 'bg-orange-100 border-orange-500 dark:bg-orange-950 dark:border-orange-400',
};

function formatCommission(value: number): string {
  return `${value.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
}

export function DecisionScreen({
  navigation,
  route,
}: DecisionScreenProps): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const verdict = route.params.verdict;
  const fxComparison = route.params.fxComparison ?? [];
  // §4: reasons come from the actual engine output. The canned per-verdict
  // string is a fallback for the case where no reason was carried through.
  const engineReason = route.params.reason;
  const engineExchangeFeeWarning = route.params.exchangeFeeWarning;
  const hasEngineReason = engineReason !== undefined && engineReason.trim() !== '';
  // A refusal, not a substitute finding. See the D6 note above.
  const reasonText = hasEngineReason
    ? engineReason
    : t('לא התקבל נימוק ממנוע ההחלטות עבור התוצאה הזו.');

  return (
    <RtlScreen safe className="bg-slate-50 dark:bg-app-dark">
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
      <View className="min-h-full w-full p-5 dark:bg-app-dark">
        <View
          className={`rounded-lg border p-5 ${VERDICT_CLASSES[verdict]}`}
          style={{ backgroundColor: theme.companyAccent }}
        >
          <AppText
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-50"
            style={{ color: theme.bankColor }}
          >
            {t(VERDICT_LABELS[verdict])}
          </AppText>
          <AppText
            className="mt-2.5 text-base leading-6 text-slate-800 dark:text-slate-100"
          >
            {reasonText}
          </AppText>
          {engineExchangeFeeWarning === undefined ? null : (
            <AppText
              className="mt-2 text-sm leading-5 text-slate-700 dark:text-slate-200"
            >
              {engineExchangeFeeWarning}
            </AppText>
          )}
        </View>

        <FeatureGate feature="ScoreSection">
          <View className="mt-5 rounded-lg border border-slate-300 bg-white p-[18px] opacity-45 dark:border-neutral-700 dark:bg-dark-surface">
            <AppText
              className="mb-3 text-lg font-extrabold text-slate-900 dark:text-slate-50"
            >
              {t('ניקוד כרטיסים')}
            </AppText>
            {/*
              D6 / WP-2.3 — THE TWO INVENTED SCORES ARE GONE.

              This block rendered "כרטיס מוביל 84/100" and "כרטיס חלופי 71/100" — two numbers with
              no computation behind them anywhere in the codebase. They were inside a FeatureGate
              marked 'soon', which dims the section and adds a "בקרוב" badge, AND STILL RENDERS THE
              CHILDREN. So both figures were on screen, in a bold weight, next to the labels of real
              cards.

              A "coming soon" badge does not make a fabricated number honest. A reader sees 84/100
              beside "leading card" and has been told something false about their own wallet.

              A card score is an ENGINE OUTPUT. Contract §1 puts every derivation in P3, and the
              feature registry itself says availableInPhase: 3. The section keeps its place and its
              badge — the registry declares the feature and P2 is not deciding its future — but it
              now states what it is waiting for instead of showing two numbers it made up.
            */}
            <AppText className="text-base text-slate-700 dark:text-slate-200">
              {t('ניקוד הכרטיסים מגיע ממנוע ההחלטות, שאינו חלק מגרסה זו.')}
            </AppText>
          </View>
        </FeatureGate>

        {fxComparison.length > 0 ? (
          <View className="mt-5 rounded-lg border border-slate-300 bg-white p-[18px] dark:border-neutral-700 dark:bg-dark-surface">
            <AppText className="mb-3 text-lg font-extrabold text-slate-900 dark:text-slate-50">
              {t('השוואת עמלות המרה')}
            </AppText>
            {fxComparison.map((rowItem, index): React.ReactElement => {
              const isLowest = rowItem.verified && index === 0;
              return (
                <RtlRow
                  className={`min-h-[44px] items-center justify-between rounded-md border px-2 ${
                    isLowest
                      ? 'border-green-500 bg-green-50 shadow-sm dark:border-green-600 dark:bg-green-950'
                      : 'border-transparent border-t-slate-200 dark:border-t-neutral-700'
                  }`}
                  key={rowItem.cardId}
                >
                  <View className="flex-1">
                    <AppText
                      className={`text-base ${
                        isLowest
                          ? 'font-extrabold text-green-700 dark:text-green-200'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {rowItem.displayName}
                      {isLowest ? ` · ${t('הזול ביותר')}` : ''}
                    </AppText>
                    {rowItem.verified ? (
                      <AppText className="text-xs text-green-700 dark:text-green-300">
                        {t('מאומת')}
                        {rowItem.effectiveFrom !== null
                          ? ` · ${t('בתוקף מ־')} ${rowItem.effectiveFrom}`
                          : ''}
                      </AppText>
                    ) : null}
                  </View>
                  {rowItem.commission !== null ? (
                    <AppText
                      className={`text-base font-extrabold ${
                        isLowest
                          ? 'text-green-700 dark:text-green-200'
                          : 'text-slate-900 dark:text-slate-50'
                      }`}
                    >
                      {formatCommission(rowItem.commission)}
                    </AppText>
                  ) : (
                    <AppText className="text-sm text-slate-400 dark:text-neutral-500">
                      {t('טרם אומת')}
                    </AppText>
                  )}
                </RtlRow>
              );
            })}
          </View>
        ) : null}

        <View className="min-h-8 flex-1" />

        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100"
          onPress={(): void => navigation.navigate('Contact')}
        >
          <AppText
            className="text-center text-base font-extrabold text-white dark:text-slate-900"
          >
            {t('יש לך בעיה?')}
          </AppText>
        </Pressable>
      </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
