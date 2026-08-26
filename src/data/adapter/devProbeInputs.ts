/**
 * THE DEV PROBE'S DATA PLUMBING — WP-7.1 device evidence, behind the boundary it has to sit behind.
 *
 * WHY THIS FILE EXISTS IN `adapter/**` AND NOT IN THE SCREEN. D2 (and three gates that read it)
 * say nothing outside `src/data/adapter/**` imports a pack file or the adapter package directly.
 * The EngineProbeScreen had been importing the shipped packs and `CardsAdapter` directly so a
 * person could watch engine outputs on a device — right idea, wrong side of the boundary, which
 * is what the first CI run over P3's tree caught.
 *
 * WHAT THIS MODULE DECIDES FOR THE SCREEN: which artifacts feed the probe (the shipped catalog
 * and fx-rates packs), and what the wallet population is (current products with a usable FX
 * commission, capped at six — the same derivation every surface must use, never a hand list).
 * It decides NOTHING about engines: the screen still calls the five contract engines itself and
 * renders their outputs with provenance, which is the entire point of V5.
 *
 * DEV-ONLY by construction: its only consumer is `src/dev/EngineProbeScreen.tsx`, which exists
 * only under `__DEV__`.
 */
import { CardsAdapter } from '@smartcard/data-authority-adapter';
import catalogJson from './packs/catalog/pack.json';
import snapshotJson from './packs/fx-rates/snapshot.json';
import manifestJson from './packs/fx-rates/manifest.json';
import envelopeJson from './packs/fx-rates/manifest.sig.json';

import { EXPECTED_DATASET_ID } from './datasetId';
import { openBundledFxSnapshot } from './fx';
import type { PackReader } from './packSet';
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

export interface DevProbeInputs {
  /** Derived wallet: current products carrying a usable FX commission, capped at six. */
  readonly wallet: readonly string[];
  /** The shipped bundled rates, read through the verified snapshot door. */
  readonly rates: readonly FxRate[];
  /** The USD rate the probe exercises the engines with. */
  readonly usd: FxRate;
  /** The commission percentage usable for a card, or undefined when the card prices none. */
  readonly usableFxCommission: (id: string) => number | undefined;
  /** The verified bundled snapshot, for the BOI lane section of the probe. */
  readonly verifiedSnapshot: ReturnType<typeof openBundledFxSnapshot>;
}

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

/**
 * THE PROBE'S DEMO SCENARIO — the one wallet-and-finances story the probe tells through the
 * engines. These are DIAGNOSTIC INPUTS for a screen that exists only under __DEV__: they feed
 * nothing a user is ever shown, and every figure they produce is rendered with its provenance.
 * Defined once here rather than scattered through the screen so there is exactly one place a
 * reviewer reads them.
 */
export const DEMO_AMOUNT_USD = 500;
export const DEMO_MONTHLY_INCOME_ILS = 10000;
export const DEMO_COMMITMENT_RENT_ILS = 2000;
export const DEMO_LOAN_PAYMENT_ILS = 1500;
export const DEMO_REMAINING_HOLD_ILS = 4500;
export const DEMO_CREDIT_LIMIT_ILS = 20000;
export const DEMO_LOGGED_THIS_CYCLE_ILS = 500;
export const DEMO_OPENING_BALANCE_ILS = 3000;
export const DEMO_DANGER_THRESHOLD_ILS = 1000;
export const DEMO_SAFE_LOAD_RATIO = 0.35;
export const DEMO_BILLING_AMOUNT_ILS = 1200;
export const DEMO_SMALL_CHARGE_ILS = 800;

/** Fixed dates so the Risk/Planning section renders the same pressure picture on every run. */
export const RISK_AS_OF_DATE = '2026-09-01';
export const RISK_THROUGH_DATE = '2026-09-30';
export const RISK_BILLING_DATE = '2026-09-05';
export const RISK_COMMITMENT_DATE = '2026-09-10';
/** The date the BOI bundled-lane resolution is demonstrated against. */
export const LANE_RESOLUTION_DATE = '2026-08-25';

export const devProbeInputs = (): DevProbeInputs => {
  const rates = snapshotJson.rates as readonly FxRate[];
  const usd = rates.find((r) => r.currency === 'USD');
  if (!usd) throw new Error('no bundled USD rate for the probe');
  return {
    wallet: currentIds.filter((id) => usable(id) !== undefined).slice(0, 6),
    rates,
    usd,
    usableFxCommission: usable,
    verifiedSnapshot: openBundledFxSnapshot(probeReader),
  };
};
