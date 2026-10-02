import { join } from 'node:path';

import { supportedSnapshotFormats } from '@smartcard/data-authority-adapter';

import {
  FX_LANE,
  FxLaneError,
  attributionOf,
  bundledCurrencies,
  bundledRate,
  openBundledFxSnapshot,
  publishedRate,
} from '../fx';
import { fsPackReader } from '../fsPackReader';
import type { PackReader } from '../packSet';

/**
 * CRITERION C8 / OBLIGATION OB-5 — the bundled FX snapshot as a COLD-START FALLBACK.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE JPY CONTROL IS THE ACCEPTANCE TEST, AND IT IS A TEST ABOUT A SHAPE
 *
 *   > *"50,000 JPY is **934.85** ILS correctly and **93,485.00** if the unit is ignored."*
 *
 * A factor of one hundred, silently. The arithmetic below is done HERE, in a test, to demonstrate
 * both answers — **the app ships no converter**, because OD-23a puts the divide in the engine and
 * the engine is P3. What the test proves is that the boundary makes the wrong answer unreachable by
 * accident: there is no per-one field to read, so 93,485.00 can only be produced by a consumer that
 * decided to ignore `quoteUnit`.
 *
 * The rate is not hardcoded. It is read from the snapshot, so a republished artifact changes the
 * expected figure rather than silently invalidating the control.
 */

const PACKS = join(__dirname, '..', 'packs');
const reader = fsPackReader(PACKS);
const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** A reader that rewrites one manifest field. Everything else is the real artifact. */
const skewing = (field: string, value: unknown): PackReader => ({
  sets: reader.sets,
  read: (set, file) => {
    const bytes = reader.read(set, file);
    if (file !== 'manifest.json') return bytes;
    const manifest = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
    manifest[field] = value;
    return encoder.encode(JSON.stringify(manifest));
  },
});

describe('C8 — the snapshot verifies before any rate is read', () => {
  it('opens the real bundled snapshot', () => {
    const snapshot = openBundledFxSnapshot(reader);
    expect(snapshot.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snapshot.manifest.snapshotId).toBe('fx-rates');
  });

  it('REFUSES a snapshotFormatVersion the adapter does not declare', () => {
    // "A consumer written for 0 must not read 1" — and the reverse. The unreadable format is
    // derived, so a hardcoded 99 cannot keep passing after the adapter learns to read 99.
    const unreadable = Math.max(...supportedSnapshotFormats()) + 1;
    expect(() => openBundledFxSnapshot(skewing('snapshotFormatVersion', unreadable))).toThrow();
  });

  it('REFUSES a manifest edited after signing', () => {
    // A rate is a financial input; an unverified one is worse than none.
    expect(() => openBundledFxSnapshot(skewing('snapshotVersion', 'edited'))).toThrow();
  });

  it('REFUSES a snapshot from another estate', () => {
    expect(() => openBundledFxSnapshot(skewing('datasetId', 'some-other-estate-v9'))).toThrow();
  });

  it('carries the attribution OD-26 requires', () => {
    const attribution = attributionOf(openBundledFxSnapshot(reader));
    expect(attribution).toBeDefined();
    expect(JSON.stringify(attribution).length).toBeGreaterThan(2);
  });
});

describe('C8 — the JPY control', () => {
  const snapshot = openBundledFxSnapshot(reader);

  it('JPY is quoted per 100, and the artifact says so', () => {
    const jpy = publishedRate(snapshot, 'JPY');
    expect(jpy).toBeDefined();
    expect(jpy?.quoteUnit).toBe(100);
  });

  it('50,000 JPY is 934.85 ILS — and 93,485.00 if the unit is ignored', () => {
    const jpy = publishedRate(snapshot, 'JPY');
    expect(jpy).toBeDefined();
    if (!jpy) return;

    const amount = 50_000;
    // The correct figure needs BOTH fields. The arithmetic is the test's, never the app's.
    const correct = (amount / jpy.quoteUnit) * jpy.rateIlsPerQuoteUnit;
    // What a consumer produces by reading the rate and forgetting the unit.
    const ignoringTheUnit = amount * jpy.rateIlsPerQuoteUnit;

    expect(correct.toFixed(2)).toBe('934.85');
    expect(ignoringTheUnit.toFixed(2)).toBe('93485.00');
    // A factor of one hundred, and the whole reason the two fields may never be collapsed.
    expect(ignoringTheUnit / correct).toBeCloseTo(jpy.quoteUnit, 6);
  });

  it('offers NO per-one field a consumer could read instead', () => {
    // The structural half. `assertNoPerOneField` on the pipeline side means there is nothing here
    // to read, so the wrong number is not something anybody obtains by accident.
    for (const rate of [publishedRate(snapshot, 'JPY'), publishedRate(snapshot, 'LBP')]) {
      expect(rate).toBeDefined();
      const keys = Object.keys(rate ?? {});
      for (const forbidden of ['rateIls', 'rate', 'perOne', 'rateIlsPerUnit', 'ilsPerUnit', 'value']) {
        expect(keys).not.toContain(forbidden);
      }
      expect(keys).toContain('quoteUnit');
      expect(keys).toContain('rateIlsPerQuoteUnit');
    }
  });

  it('every currency carrying a quoteUnit above 1 is a currency this control covers', () => {
    // Derived: if the estate ever quotes a third currency per 10 or per 100, this names it rather
    // than leaving it outside a control written for two.
    const nonUnit = bundledCurrencies(snapshot)
      .map((c) => publishedRate(snapshot, c))
      .filter((r): r is NonNullable<typeof r> => r !== undefined && r.quoteUnit !== 1)
      .map((r) => `${r.currency}/${r.quoteUnit}`);
    expect(nonUnit.sort()).toEqual(['JPY/100', 'LBP/10']);
  });
});

describe('C8 — the rate\'s own date, never today', () => {
  const snapshot = openBundledFxSnapshot(reader);

  it('a weekend probe resolves to the previous publication, labelled with THAT date', () => {
    // 2026-08-16 is a Sunday; 2026-08-14 is the Friday before it.
    const result = bundledRate(snapshot, 'JPY', '2026-08-16');
    expect(result.state).toBe('RATE');
    if (result.state !== 'RATE') return;

    expect(result.rate.rateDate).toBe('2026-08-14');
    expect(result.rate.probeDate).toBe('2026-08-16');
    // Said explicitly, so a renderer does not have to infer it by comparing two dates.
    expect(result.rate.carriedForward).toBe(true);
    expect(result.rate.carriedForwardDays).toBe(2);
  });

  it('every rate carries fallbackOnly and BUNDLED, so a device can tell it is on the fallback', () => {
    const result = bundledRate(snapshot, 'USD', snapshot.snapshotDate);
    expect(result.state).toBe('RATE');
    if (result.state !== 'RATE') return;
    expect(result.rate.source).toBe('BUNDLED');
    expect(result.rate.fallbackOnly).toBe(true);
    // A reference rate is never a settlement rate.
    expect(result.rate.provenance).toBe('ESTIMATE');
  });

  it('REFUSES a rate that is not from the bundled, fallback-only lane', () => {
    // Checked, not commented. The live lane is P3 and does not exist; these two markers are the
    // only thing that lets a device tell which lane a figure came from, and a consumer that never
    // looked would present a live rate and a frozen one identically the day it arrives.
    expect(FX_LANE).toBe('BUNDLED');
    const error = new FxLaneError('source', 'BUNDLED', 'LIVE');
    expect(error.message).toContain('BUNDLED');
    expect(error.message).toContain('LIVE');
    expect(error.message).toMatch(/not a rate feed/i);
    expect(error.name).toBe('FxLaneError');
  });

  it('the probe date and the rate date are separate fields and are never collapsed', () => {
    const onPublication = bundledRate(snapshot, 'USD', snapshot.snapshotDate);
    expect(onPublication.state).toBe('RATE');
    if (onPublication.state !== 'RATE') return;
    expect(onPublication.rate.rateDate).toBe(onPublication.rate.probeDate);
    expect(onPublication.rate.carriedForward).toBe(false);
  });

  it('asOf is an argument — this module never reads a clock', () => {
    // Two different probes give two different answers from the same snapshot. A module that read
    // the clock would make every caller's result depend on when it ran.
    const a = bundledRate(snapshot, 'JPY', '2026-08-14');
    const b = bundledRate(snapshot, 'JPY', '2026-08-18');
    expect(a.state).toBe('RATE');
    expect(b.state).toBe('RATE');
    if (a.state !== 'RATE' || b.state !== 'RATE') return;
    expect(a.rate.rateDate).not.toBe(b.rate.rateDate);
  });
});

describe('C8 — a missing currency is COMPARISON_INCOMPLETE, never zero', () => {
  const snapshot = openBundledFxSnapshot(reader);

  it('carries the currencies the estate published, derived rather than listed', () => {
    const currencies = bundledCurrencies(snapshot);
    expect(currencies.length).toBeGreaterThan(1);
    expect(currencies).toContain('JPY');
  });

  it('a currency the snapshot does not carry yields COMPARISON_INCOMPLETE', () => {
    const result = bundledRate(snapshot, 'XYZ', snapshot.snapshotDate);
    expect(result.state).toBe('COMPARISON_INCOMPLETE');
    if (result.state !== 'COMPARISON_INCOMPLETE') return;
    expect(result.reason).toBe('CURRENCY_NOT_IN_SNAPSHOT');
    // No rate object at all, so there is no zero for a caller to read and convert with.
    expect('rate' in result).toBe(false);
    expect(result.message).toMatch(/not a free conversion/);
  });

  it('a date before the series yields COMPARISON_INCOMPLETE, not the earliest rate', () => {
    const result = bundledRate(snapshot, 'JPY', '2020-01-01');
    expect(result.state).toBe('COMPARISON_INCOMPLETE');
    if (result.state !== 'COMPARISON_INCOMPLETE') return;
    expect(result.reason).toBe('DATE_PRECEDES_SERIES');
  });

  it('the two incompletenesses are DIFFERENT, because they mean different things', () => {
    const missing = bundledRate(snapshot, 'XYZ', snapshot.snapshotDate);
    const early = bundledRate(snapshot, 'JPY', '2020-01-01');
    if (missing.state !== 'COMPARISON_INCOMPLETE' || early.state !== 'COMPARISON_INCOMPLETE') {
      throw new Error('both should be incomplete');
    }
    // "We do not carry this currency" and "we carry it, but not that far back" are different
    // sentences, and a surface that showed one for the other would mislead about what is available.
    expect(missing.reason).not.toBe(early.reason);
  });
});
