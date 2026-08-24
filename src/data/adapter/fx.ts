import {
  openVerifiedFxSnapshot,
  TRUST_STORE,
  type AdapterFxRate,
  type AdapterRateAsOf,
  type FxSnapshotManifest,
  type FxSnapshotSlice,
  type SignatureEnvelope,
} from '@smartcard/data-authority-adapter';

import { APP_IDENTITY } from '../../config/identity';

import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';
import type { PackReader } from './packSet';

/**
 * THE BUNDLED FX SNAPSHOT, AS A COLD-START FALLBACK — criterion C8, obligation OB-5.
 *
 *   > **OB-5.** *"`fx-rates` ships 14 currencies and 210 published daily points, signed, with
 *   > `fallbackOnly: true` in the artifact itself. It exists so a device that has never been online
 *   > can still compare a foreign purchase. **It is not a rate feed.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 *
 * **It does not fetch.** OB-5's first obligation is *"fetch live per `boi-fetch-spec.md`; use the
 * bundle only until the first successful fetch"*, and the BOI live fetch client is **P3** — the
 * campaign plan says so in as many words (*"Do not build the BOI live fetch client — it is P3"*),
 * and this campaign's hard prohibitions repeat it.
 *
 * That is not the same as ignoring the obligation. The obligation shapes this module: `bundledRate`
 * is named for the lane it reads, `resolveRate` takes the other lanes as an argument it does not
 * supply, and every value returned carries `source: 'BUNDLED'` and `fallbackOnly: true` from the
 * artifact itself. **A device using this module can tell that it is using a fallback**, which is the
 * property that makes the missing lane visible rather than invisible.
 *
 * **It does not convert.** Not one division, not one multiplication. OD-23a puts the divide in the
 * engine, and the engine is P3.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `quoteUnit` AND `rateIlsPerQuoteUnit` TRAVEL TOGETHER, ALWAYS
 *
 *   > *"JPY is quoted per 100 and LBP per 10. The artifact refuses to ship any pre-divided field, so
 *   > a consumer cannot obtain a per-one number from it and therefore cannot silently skip the unit.
 *   > **50,000 JPY is 934.85 ILS correctly and 93,485.00 if the unit is ignored.**"*
 *
 * A factor of one hundred, silently. The protection is structural rather than careful: there is no
 * per-one field to read, so the wrong number is not something a consumer can obtain by accident —
 * it can only be produced by a consumer that decided to ignore `quoteUnit`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A MISSING CURRENCY IS `COMPARISON_INCOMPLETE`, NEVER ZERO
 *
 *   > **OD-23b.** *"A missing rate is a missing answer, not a free conversion."*
 *
 * Zero is the most dangerous default a currency table can have: it converts, it renders, it sums,
 * and every figure downstream is wrong by exactly the amount the user cared about.
 */

/** The one place a verified snapshot is obtained. A rate is not readable until the artifact is. */
export interface VerifiedFxSnapshot {
  readonly slice: FxSnapshotSlice;
  readonly manifest: FxSnapshotManifest;
  /** The date the SNAPSHOT was taken. Never "today", and never a rate's own date. */
  readonly snapshotDate: string;
}

/**
 * Open the bundled snapshot, verifying the manifest and the detached signature FIRST.
 *
 *   > *"Verify the manifest and the detached signature before reading a rate — a rate is a financial
 *   > input; an unverified one is worse than none."*
 *
 * There is no other way to obtain a slice in this app: `FxSnapshotSlice` is never constructed here,
 * so a caller cannot reach a rate without having verified the artifact it came from.
 */
export function openBundledFxSnapshot(reader: PackReader, set = 'fx-rates'): VerifiedFxSnapshot {
  assertPinnedAdapter();

  const decoder = new TextDecoder();
  const manifest = JSON.parse(decoder.decode(reader.read(set, 'manifest.json'))) as FxSnapshotManifest;
  const envelope = JSON.parse(decoder.decode(reader.read(set, 'manifest.sig.json'))) as SignatureEnvelope;

  // Throws on an undeclared snapshotFormatVersion, a broken signature, a foreign dataset id, or an
  // app version below the manifest's floor. All four are the adapter's, and none is re-derived here.
  const opened = openVerifiedFxSnapshot({
    snapshotBytes: reader.read(set, 'snapshot.json'),
    manifest,
    envelope,
    trustStore: TRUST_STORE,
    expectedDatasetId: EXPECTED_DATASET_ID,
    appVersion: APP_IDENTITY.version,
    requireRelease: false,
  });

  return { slice: opened.slice, manifest: opened.manifest, snapshotDate: opened.slice.snapshotDate };
}

/** What a caller gets back. There is no third state and there is no zero. */
export type BundledRateResult =
  | { readonly state: 'RATE'; readonly rate: AdapterRateAsOf }
  | {
      readonly state: 'COMPARISON_INCOMPLETE';
      readonly currency: string;
      /** Why, so a surface can say something true rather than something vague. */
      readonly reason: 'CURRENCY_NOT_IN_SNAPSHOT' | 'DATE_PRECEDES_SERIES';
      readonly message: string;
    };

/**
 * The bundled rate for a currency, as of a date — or an explicit incompleteness.
 *
 * `asOf` is a parameter and never `new Date()`. A module that read the clock would make every
 * caller's result depend on when it ran, and the one thing OB-5 asks a renderer to show is the
 * **rate's own date** rather than today's.
 */
export function bundledRate(
  snapshot: VerifiedFxSnapshot,
  currency: string,
  asOf: string,
): BundledRateResult {
  if (!snapshot.slice.currencies.includes(currency)) {
    return {
      state: 'COMPARISON_INCOMPLETE',
      currency,
      reason: 'CURRENCY_NOT_IN_SNAPSHOT',
      message:
        `the bundled snapshot carries no rate for ${currency}. OD-23b: a missing rate is a missing ` +
        'answer, not a free conversion — zero would convert, render and sum, and every figure ' +
        'downstream would be wrong by exactly the amount that mattered.',
    };
  }

  const rate = snapshot.slice.rateAsOf(currency, asOf);
  if (rate === undefined) {
    return {
      state: 'COMPARISON_INCOMPLETE',
      currency,
      reason: 'DATE_PRECEDES_SERIES',
      message:
        `${asOf} is before the first published point for ${currency} in this snapshot. Reaching ` +
        'backwards past the start of the series would answer about a date the publication says ' +
        'nothing about.',
    };
  }

  assertFallbackLane(rate);
  return { state: 'RATE', rate };
}

/** The lane this module reads, named once. The live lane is P3 and there is no constant for it. */
export const FX_LANE = 'BUNDLED' as const;

export class FxLaneError extends Error {
  constructor(field: string, expected: string, actual: string) {
    super(
      `the bundled snapshot returned a rate whose ${field} is "${actual}" and this app read it as ` +
        `"${expected}". OB-5: the bundle exists so a device that has never been online can still ` +
        'compare a foreign purchase, and IT IS NOT A RATE FEED. The live lane does not exist yet ' +
        '(it is P3), so these two markers are the only thing that lets a device tell which lane a ' +
        'figure came from — and a figure from an unknown lane presented as a fallback is worse ' +
        'than no figure.',
    );
    this.name = 'FxLaneError';
  }
}

/**
 * Every rate this module hands back really is a BUNDLED, fallback-only rate.
 *
 * Checked rather than commented. The artifact carries `source` and `fallbackOnly` precisely so a
 * consumer can tell, and a consumer that never looked would present a live rate and a frozen one
 * identically the day the live lane arrives.
 */
function assertFallbackLane(rate: AdapterRateAsOf): void {
  if (rate.source !== FX_LANE) throw new FxLaneError('source', FX_LANE, String(rate.source));
  if (rate.fallbackOnly !== true) {
    throw new FxLaneError('fallbackOnly', 'true', String(rate.fallbackOnly));
  }
}

/**
 * Every currency the snapshot carries. Derived from the artifact, never listed anywhere in the app.
 *
 * OB-5 says fourteen. This app does not say fourteen anywhere: it asks.
 */
export function bundledCurrencies(snapshot: VerifiedFxSnapshot): readonly string[] {
  return snapshot.slice.currencies;
}

/** One published rate as it stands, for a surface that shows the table rather than one conversion. */
export function publishedRate(snapshot: VerifiedFxSnapshot, currency: string): AdapterFxRate | undefined {
  return snapshot.slice.rate(currency);
}

/**
 * THE ATTRIBUTION OD-26 REQUIRES, carried verbatim from the estate.
 *
 * Exposed because a surface rendering a rate has to render this beside it, and because a consumer
 * that had to assemble the sentence itself would eventually assemble a different one.
 */
export function attributionOf(snapshot: VerifiedFxSnapshot): FxSnapshotSlice['attribution'] {
  return snapshot.slice.attribution;
}
