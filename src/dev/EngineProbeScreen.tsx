/**
 * DEV-ONLY ENGINE PROBE — the PHASE-7 device-evidence harness (WP-7.1 / WP-7.2).
 *
 * Registered ONLY under __DEV__ (MoreStack), reached only from a __DEV__ row in Settings.
 * It renders the five contract engines' OUTPUTS — numbers, chips, traces summaries and lane
 * resolutions — computed live on this device from the shipped bundled artifacts. It holds no
 * recommendation logic of its own: every figure on screen is an engine output carrying its
 * provenance, which is exactly what V5 needs to be visible to a person.
 *
 * This file is diagnostics, not product surface; it must never ship in a release build
 * (`__DEV__` is false there, so neither the route nor the entry exists).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { CardsAdapter } from '@smartcard/data-authority-adapter';
import catalogJson from '../data/adapter/packs/catalog/pack.json';
import snapshotJson from '../data/adapter/packs/fx-rates/snapshot.json';
import manifestJson from '../data/adapter/packs/fx-rates/manifest.json';
import envelopeJson from '../data/adapter/packs/fx-rates/manifest.sig.json';
import { EXPECTED_DATASET_ID } from '../data/adapter/datasetId';
import { openBundledFxSnapshot } from '../data/adapter/fx';
import { resolveFxRate } from '../data/fx/lane';
import { fetchBoiRates } from '../data/fx/liveFetch';
import type { PackReader } from '../data/adapter/packSet';
import { compareAbroad, type CardFxQuote } from '../engines/fx';
import { convertToIls } from '../engines/currency';
import { scoreCards } from '../engines/scoring';
import { evaluatePurchaseVerdict } from '../engines/verdict';
import { evaluateFinancialLoad } from '../engines/load';
import { evaluateRiskPlanning } from '../engines/risk';
import { MVP_ENGINE_MODULES } from '../engines/mvpEngines';
import { CHROME, TEXT } from '../theme/tokens';
import type { FxRate } from '@smartcard/data-authority-adapter';

type Row = Readonly<Record<string, unknown>>;

const cards = CardsAdapter.open({
  datasetId: (catalogJson as { datasetId: string }).datasetId,
  datasetVersion: (catalogJson as { datasetVersion: string }).datasetVersion,
  cards: (catalogJson as { units: Record<string, readonly Row[]> }).units['cards'] as never,
}, { expectedDatasetId: EXPECTED_DATASET_ID });

const rows = (catalogJson as { units: Record<string, readonly Row[]> }).units['cards'] ?? [];
const currentIds = rows.map((r) => String(r['cardId']))
  .filter((id) => cards.read(id)?.countsAsCurrentProduct === true);

const usable = (id: string): number | undefined => {
  const value = cards.read(id)?.cost('fxCommissionPct') as
    | { value?: number; consumability?: { verdict?: string } }
    | undefined;
  if (value === undefined || !('value' in value)) return undefined;
  const v = value.consumability?.verdict;
  return v === 'USABLE' || v === 'USABLE_ESTIMATE' ? Number(value.value) : undefined;
};

const wallet = currentIds
  .filter((id) => usable(id) !== undefined)
  .slice(0, 6);

const rates = snapshotJson.rates as readonly FxRate[];
const rateFor = (currency: string): FxRate => {
  const rate = rates.find((r) => r.currency === currency);
  if (!rate) throw new Error(`no bundled rate for ${currency}`);
  return rate;
};

const probeReader: PackReader = {
  sets: (): readonly string[] => ['fx-rates'],
  read: (set: string, name: string): Uint8Array => {
    if (set !== 'fx-rates') throw new Error(`probe reader only carries fx-rates, not ${set}`);
    const source = name === 'snapshot.json'
      ? snapshotJson
      : name === 'manifest.json'
        ? manifestJson
        : name === 'manifest.sig.json'
          ? envelopeJson
          : undefined;
    if (source === undefined) throw new Error(`probe reader: unknown ${name}`);
    return new TextEncoder().encode(JSON.stringify(source));
  },
};

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

  const usd = rateFor('USD');
  const converted = convertToIls({ amount: 500, currency: 'USD' }, usd);
  const comparison = compareAbroad({
    amount: 500,
    currency: 'USD',
    mode: 'purchase',
    cards: wallet.map((cardId): CardFxQuote => {
      const fxPercent = usable(cardId);
      return { cardId, ...(fxPercent !== undefined ? { fxPercent } : {}) };
    }),
    rate: usd,
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
    monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
    commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
  });
  const load = evaluateFinancialLoad({
    monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
    commitments: [{ commitmentId: 'loan', monthlyAmountIls: { value: 1_500, provenance: 'USER' }, linkedCardId: wallet[0] ?? 'card:a', remainingHoldIls: { value: 4_500, provenance: 'USER' } }],
    cards: [{ cardId: wallet[0] ?? 'card:a', creditLimitIls: { value: 20_000, provenance: 'USER' }, loggedThisCyclePurchasesIls: { value: 500, provenance: 'USER' } }],
  });
  const risk = evaluateRiskPlanning({
    asOfDate: '2026-09-01',
    throughDate: '2026-09-30',
    openingBalanceIls: { value: 3_000, provenance: 'USER' },
    dangerThresholdIls: { value: 1_000, provenance: 'USER' },
    monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
    currentMonthlyObligationsIls: { value: 2_000, provenance: 'USER' },
    prospectiveMonthlyObligationIls: { value: 0, provenance: 'USER' },
    safeLoadRatio: { value: 0.35, provenance: 'VERIFIED' },
    salaries: [{ salaryId: 's1', date: '2026-09-01', amountIls: { value: 10_000, provenance: 'USER' } }],
    billings: [{ billingId: 'b1', date: '2026-09-05', amountIls: { value: 1_200, provenance: 'USER' }, monthlyObligationsEndingIls: { value: 0, provenance: 'USER' } }],
    commitments: [{ commitmentId: 'c1', date: '2026-09-10', amountIls: { value: 800, provenance: 'USER' } }],
  });

  const verifiedSnapshot = openBundledFxSnapshot(probeReader);
  const laneBundled = resolveFxRate({ snapshot: verifiedSnapshot }, 'USD', '2026-08-25');
  const laneIncomplete = resolveFxRate({ snapshot: verifiedSnapshot }, 'ZZZ', '2026-08-25');
  // ResolvedRate is a union: the incomplete arm carries a reason, not a rate.
  const laneBundledRate = 'rate' in laneBundled ? laneBundled.rate : undefined;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <AppText className="text-xl font-extrabold" style={{ color: CHROME.white }}>
        ENGINE PROBE (dev)
      </AppText>
      <Line label="engines" value={MVP_ENGINE_MODULES.join(', ')} />
      <Line label="wallet size" value={String(wallet.length)} />

      <Section title="N3 FX engine" />
      <Line label="500 USD reference" value={`${converted.referenceIls.toFixed(2)} ILS [${converted.provenance}]`}/>
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
  root: { flex: 1, backgroundColor: CHROME.appDark },
  content: { padding: 16, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  mono: { fontFamily: 'monospace', fontSize: 13, color: CHROME.white },
  dim: { opacity: 0.7 },
  accent: { color: '#7dd3fc', paddingVertical: 8 },
});
