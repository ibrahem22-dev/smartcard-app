/**
 * DEV-ONLY ENGINE PROBE — the PHASE-7 device-evidence harness (WP-7.1 / WP-7.2).
 *
 * Registered ONLY under __DEV__ (MoreStack), reached only from a __DEV__ row in Settings.
 * It renders the five contract engines' OUTPUTS — numbers, chips, traces summaries and lane
 * resolutions — computed live on this device from the shipped bundled artifacts. It holds no
 * recommendation logic of its own: every figure on screen is an engine output carrying its
 * provenance, which is exactly what V5 needs to be visible to a person.
 *
 * The artifacts it reads and the wallet derivation it displays come from
 * `src/data/adapter/devProbeInputs.ts`, because nothing outside `src/data/adapter/**` may import
 * a pack file or the adapter package directly (D2) — see that module for the boundary note.
 *
 * This file is diagnostics, not product surface; it must never ship in a release build
 * (`__DEV__` is false there, so neither the route nor the entry exists).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import {
  devProbeInputs,
  DEMO_AMOUNT_USD,
  DEMO_MONTHLY_INCOME_ILS,
  DEMO_COMMITMENT_RENT_ILS,
  DEMO_LOAN_PAYMENT_ILS,
  DEMO_REMAINING_HOLD_ILS,
  DEMO_CREDIT_LIMIT_ILS,
  DEMO_LOGGED_THIS_CYCLE_ILS,
  DEMO_OPENING_BALANCE_ILS,
  DEMO_DANGER_THRESHOLD_ILS,
  DEMO_SAFE_LOAD_RATIO,
  DEMO_BILLING_AMOUNT_ILS,
  DEMO_SMALL_CHARGE_ILS,
  RISK_AS_OF_DATE,
  RISK_THROUGH_DATE,
  RISK_BILLING_DATE,
  RISK_COMMITMENT_DATE,
  LANE_RESOLUTION_DATE,
} from '../data/adapter/devProbeInputs';
import { resolveFxRate } from '../data/fx/lane';
import { fetchBoiRates } from '../data/fx/liveFetch';
import { compareAbroad, type CardFxQuote } from '../engines/fx';
import { convertToIls } from '../engines/currency';
import { scoreCards } from '../engines/scoring';
import { evaluatePurchaseVerdict } from '../engines/verdict';
import { evaluateFinancialLoad } from '../engines/load';
import { evaluateRiskPlanning } from '../engines/risk';
import { MVP_ENGINE_MODULES } from '../engines/mvpEngines';
import { CHROME, TEXT } from '../theme/tokens';

const probe = devProbeInputs();

function Section({ title }: { readonly title: string }): React.ReactElement {
  return (
    <AppText className="mb-1 mt-4 text-lg font-extrabold" style={{ color: CHROME.white }}>
      {title}
    </AppText>
  );
}

function Line({ label, value }: { readonly label: string; readonly value: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <AppText style={[styles.mono, styles.dim]}>{label}</AppText>
      <AppText style={styles.mono}>{value}</AppText>
    </View>
  );
}

export function EngineProbeScreen(): React.ReactElement {
  const [liveStatus, setLiveStatus] = useState<string>('fetch not attempted');

  const attemptLive = useCallback((): void => {
    setLiveStatus('fetching…');
    // The probe is a CALLER: it supplies the fetchDate itself rather than asking an engine
    // to read a clock (the same discipline every engine input follows).
    const fetchDate = new Date().toISOString().slice(0, 10);
    fetchBoiRates({ fetchDate })
      .then((liveRates) => {
        setLiveStatus(`LIVE OK - ${liveRates.length} mapped rows`);
      })
      .catch((error: Error) => {
        setLiveStatus(`refused: ${error.name}: ${String(error.message).slice(0, 90)}`);
      });
  }, []);

  useEffect(() => {
    attemptLive();
  }, [attemptLive]);

  const converted = convertToIls({ amount: DEMO_AMOUNT_USD, currency: 'USD' }, probe.usd);
  const comparison = compareAbroad({
    amount: DEMO_AMOUNT_USD,
    currency: 'USD',
    mode: 'purchase',
    cards: probe.wallet.map((cardId): CardFxQuote => {
      const fxPercent = probe.usableFxCommission(cardId);
      return { cardId, ...(fxPercent !== undefined ? { fxPercent } : {}) };
    }),
    rate: probe.usd,
  });
  const scoring = scoreCards({
    cards: comparison.ranked.map((entry) => ({
      cardId: entry.cardId,
      available: true,
      costIls: { value: entry.quote.effectiveIls, provenance: entry.quote.provenance },
    })),
    deltasSuppressed: comparison.deltasSuppressed,
  });
  const verdict = evaluatePurchaseVerdict({
    purchaseAmountIls: { value: converted.effectiveIls, provenance: 'ESTIMATE' },
    installmentCount: 1,
    monthlyIncomeIls: { value: DEMO_MONTHLY_INCOME_ILS, provenance: 'USER' },
    commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: DEMO_COMMITMENT_RENT_ILS, provenance: 'USER' } }],
  });
  const load = evaluateFinancialLoad({
    monthlyIncomeIls: { value: DEMO_MONTHLY_INCOME_ILS, provenance: 'USER' },
    commitments: [{ commitmentId: 'loan', monthlyAmountIls: { value: DEMO_LOAN_PAYMENT_ILS, provenance: 'USER' }, linkedCardId: probe.wallet[0] ?? 'card:a', remainingHoldIls: { value: DEMO_REMAINING_HOLD_ILS, provenance: 'USER' } }],
    cards: [{ cardId: probe.wallet[0] ?? 'card:a', creditLimitIls: { value: DEMO_CREDIT_LIMIT_ILS, provenance: 'USER' }, loggedThisCyclePurchasesIls: { value: DEMO_LOGGED_THIS_CYCLE_ILS, provenance: 'USER' } }],
  });
  const risk = evaluateRiskPlanning({
    asOfDate: RISK_AS_OF_DATE,
    throughDate: RISK_THROUGH_DATE,
    openingBalanceIls: { value: DEMO_OPENING_BALANCE_ILS, provenance: 'USER' },
    dangerThresholdIls: { value: DEMO_DANGER_THRESHOLD_ILS, provenance: 'USER' },
    monthlyIncomeIls: { value: DEMO_MONTHLY_INCOME_ILS, provenance: 'USER' },
    currentMonthlyObligationsIls: { value: DEMO_COMMITMENT_RENT_ILS, provenance: 'USER' },
    prospectiveMonthlyObligationIls: { value: 0, provenance: 'USER' },
    safeLoadRatio: { value: DEMO_SAFE_LOAD_RATIO, provenance: 'VERIFIED' },
    salaries: [{ salaryId: 's1', date: RISK_AS_OF_DATE, amountIls: { value: DEMO_MONTHLY_INCOME_ILS, provenance: 'USER' } }],
    billings: [{ billingId: 'b1', date: RISK_BILLING_DATE, amountIls: { value: DEMO_BILLING_AMOUNT_ILS, provenance: 'USER' }, monthlyObligationsEndingIls: { value: 0, provenance: 'USER' } }],
    commitments: [{ commitmentId: 'c1', date: RISK_COMMITMENT_DATE, amountIls: { value: DEMO_SMALL_CHARGE_ILS, provenance: 'USER' } }],
  });

  const laneBundled = resolveFxRate({ snapshot: probe.verifiedSnapshot }, 'USD', LANE_RESOLUTION_DATE);
  const laneIncomplete = resolveFxRate({ snapshot: probe.verifiedSnapshot }, 'ZZZ', LANE_RESOLUTION_DATE);
  // ResolvedRate is a union: the incomplete arm carries a reason, not a rate.
  const laneBundledRate = 'rate' in laneBundled ? laneBundled.rate : undefined;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <AppText className="text-xl font-extrabold" style={{ color: CHROME.white }}>
        ENGINE PROBE (dev)
      </AppText>
      <Line label="engines" value={MVP_ENGINE_MODULES.join(', ')} />
      <Line label="wallet size" value={String(probe.wallet.length)} />

      <Section title="N3 FX engine" />
      <Line label={`${DEMO_AMOUNT_USD} USD reference`} value={`${converted.referenceIls.toFixed(2)} ILS [${converted.provenance}]`}/>
      <Line label="effective (best)" value={`${comparison.ranked[0]?.quote.effectiveIls.toFixed(2) ?? '-'} ILS [${comparison.ranked[0]?.quote.provenance ?? '-'}]`} />
      <Line label="ranked / trace steps" value={`${comparison.ranked.length} / ${comparison.trace.steps.length}`} />

      <Section title="N1 Card Scoring" />
      {scoring.ranked.slice(0, 3).map((entry, index) => (
        <Line key={entry.cardId} label={`#${index + 1} ${entry.cardId}`}
          value={`score ${entry.score.value.toFixed(0)} · delta ${entry.deltaFromBestIls?.value.toFixed(2) ?? 'suppressed'} [${entry.effectiveCostIls.provenance}]`} />
      ))}

      <Section title="N2 Purchase Verdict" />
      <Line label="state" value={verdict.verdict} />
      <Line label="projected load" value={`${verdict.financialImpact.thresholdMath.projectedLoadRatio.value.toFixed(3)} [${verdict.financialImpact.thresholdMath.projectedLoadRatio.provenance}]`} />

      <Section title="N4 Financial Load" />
      <Line label="band now" value={load.current.band} />
      <Line label="available limit" value={`${load.cardLimits[0]?.availableBeforeChangesIls.value.toFixed(2) ?? '-'} ILS [${load.cardLimits[0]?.availableBeforeChangesIls.provenance ?? '-'}]`} />

      <Section title="N5 Risk / Planning" />
      <Line label="lowest balance" value={`${risk.pressure.lowestProjectedBalanceIls?.value.toFixed(2) ?? '-'} @ ${risk.pressure.lowestBalanceDate ?? '-'}`} />
      <Line label="wait-until-billing" value={risk.waitUntilBilling.decision} />

      <Section title="BOI lane (WP-7.2)" />
      <Line label="bundled resolution" value={laneBundled.resolution} />
      <Line label="bundled rate date" value={`${laneBundledRate?.rateDate ?? '-'} [${laneBundledRate?.source ?? '-'}]`} />
      <Line label="unknown currency" value={laneIncomplete.resolution} />
      <Line label="live fetch" value={liveStatus} />

      <Section title="controls" />
      <Pressable onPress={attemptLive} accessibilityRole="button" testID="probe-retry-live">
        <AppText style={[styles.mono, styles.accent]}>retry live BOI fetch</AppText>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHROME.appLight },
  content: { padding: 16, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  mono: { fontFamily: 'monospace', fontSize: 13, color: CHROME.ink },
  dim: { opacity: 0.7 },
  accent: { color: CHROME.link, paddingVertical: 8 },
});