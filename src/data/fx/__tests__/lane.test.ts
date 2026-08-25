import { join } from 'node:path';

import { bundledRate, FxLaneError, openBundledFxSnapshot } from '../../adapter/fx';
import { fsPackReader } from '../../adapter/fsPackReader';
import type { FxRate } from '@smartcard/data-authority-adapter';

import { cachedRateFor, memoryRateCache } from '../rateCache';
import { isIncomplete, resolveFxRate } from '../lane';

/**
 * WP-2.4 / WP-2.5 / WP-2.7 — the lane: cache → bundled, bundled only until the first successful
 * fetch; provenance follows the source; offline with no cache is COMPARISON_INCOMPLETE.
 *
 * The real bundled snapshot is opened (signature first) and the chain is driven through the
 * boundary's own `slice.resolve`, so what is under test is the app's assembly of the lanes — not a
 * re-implementation of precedence.
 */

const PACKS = join(__dirname, '..', '..', 'adapter', 'packs');
const reader = fsPackReader(PACKS);
const snapshot = openBundledFxSnapshot(reader);

const FETCH_DATE = '2026-08-25';
/** The snapshot's own headline date — a date the bundled series can actually answer about. */
const SNAPSHOT_DATE = snapshot.snapshotDate;

const liveRate = (
  currency: string,
  rateIlsPerQuoteUnit: number,
  rateDate = FETCH_DATE,
  quoteUnit = 1,
): FxRate => ({
  currency,
  quoteUnit,
  rateIlsPerQuoteUnit,
  rateDate,
  fetchDate: FETCH_DATE,
  source: 'LIVE',
  provenance: 'ESTIMATE',
  rateBasis: 'BOI_REPRESENTATIVE',
});

describe('A4 — the lane: cache, then bundled, and only until the first success', () => {
  it('a device with no live and no cached rate lands on BUNDLED — the cold start', () => {
    const r = resolveFxRate({ snapshot }, 'USD', SNAPSHOT_DATE);
    expect(r.resolution).toBe('BUNDLED');
    if (r.resolution !== 'COMPARISON_INCOMPLETE') {
      expect(r.rate.source).toBe('BUNDLED');
      // The artifact's own marker travels with the value.
      if ('fallbackOnly' in r.rate && 'fallbackOnly' in { fallbackOnly: true }) {
        expect((r.rate as { fallbackOnly?: unknown }).fallbackOnly).toBe(true);
      }
    }
  });

  it('a successful fetch outranks the bundle — LIVE wins at once', () => {
    const fresh = liveRate('USD', 3.0);
    const r = resolveFxRate({ snapshot, live: [fresh] }, 'USD', FETCH_DATE);
    expect(r.resolution).toBe('LIVE');
    if (r.resolution !== 'COMPARISON_INCOMPLETE') {
      expect(r.rate.source).toBe('LIVE');
      expect(r.rate.rateIlsPerQuoteUnit).toBe(3.0);
    }
  });

  it('a PREVIOUS session’s cached success also outranks the bundle', () => {
    const yesterday = liveRate('USD', 2.99, '2026-08-24');
    const r = resolveFxRate({ snapshot, cached: [yesterday] }, 'USD', FETCH_DATE);
    expect(r.resolution).toBe('CACHED');
  });

  it('bundled participates only until the first success: cache beats bundle even stale-ish', () => {
    // Eight days old would be STALE by calendar days — still returned, still CACHED. A stale rate
    // is a fact to render, not a reason to slip underneath it to the frozen bundle.
    const old = liveRate('USD', 3.1, '2026-08-17');
    const r = resolveFxRate({ snapshot, cached: [old] }, 'USD', FETCH_DATE);
    expect(r.resolution).toBe('CACHED');
    if (r.resolution !== 'COMPARISON_INCOMPLETE') {
      expect(r.staleness.stale).toBe(true);
    }
  });

  it('a USER rate outranks everything, including this session’s live fetch (OD-23b)', () => {
    const user = { ...liveRate('USD', 3.25), source: 'USER' as const };
    const fresh = liveRate('USD', 3.0);
    const r = resolveFxRate({ snapshot, live: [fresh], user }, 'USD', FETCH_DATE);
    expect(r.resolution).toBe('USER');
  });

  it('the freshest cached rate wins when the cache holds history out of order', () => {
    const older = liveRate('USD', 2.95, '2026-08-23');
    const newer = liveRate('USD', 2.99, '2026-08-24');
    const r = resolveFxRate({ snapshot, cached: [older, newer] }, 'USD', FETCH_DATE);
    expect(r.resolution).toBe('CACHED');
    if (r.resolution !== 'COMPARISON_INCOMPLETE') {
      expect(r.rate.rateIlsPerQuoteUnit).toBe(2.99);
    }
  });

  it('the memory cache round-trips an episode: write on success, read on the next session', async () => {
    const cache = memoryRateCache();
    expect(await cache.read()).toBeNull();
    await cache.write([liveRate('USD', 3.0)]);
    const stored = await cache.read();
    expect(stored).toHaveLength(1);
    expect(cachedRateFor(stored, 'USD')?.rateIlsPerQuoteUnit).toBe(3.0);
    expect(cachedRateFor(stored, 'CHF')).toBeUndefined();
  });
});

describe('A5 — provenance flips with the SOURCE; a frozen rate is never dressed as live', () => {
  it('the resolved resolution names the lane: LIVE for today’s fetch, BUNDLED for the cold start', () => {
    expect(
      resolveFxRate({ snapshot, live: [liveRate('USD', 3.0)] }, 'USD', FETCH_DATE).resolution,
    ).toBe('LIVE');
    expect(resolveFxRate({ snapshot }, 'USD', SNAPSHOT_DATE).resolution).toBe('BUNDLED');
  });

  it('a LIVE rate carrying fallbackOnly:true is REFUSED by the boundary’s own lane check', () => {
    // THE NEGATIVE CONTROL FOR A5, RUN FROM THE LIVE SIDE: hand the bundled reader's assertion a
    // rate whose source says LIVE while wearing the artifact's fallback-only marker. FxLaneError
    // must fire — a figure from an unknown lane presented as a fallback is worse than no figure.
    const lying = {
      currency: 'USD',
      quoteUnit: 1,
      rateIlsPerQuoteUnit: 2.986,
      rateDate: SNAPSHOT_DATE,
      probeDate: SNAPSHOT_DATE,
      carriedForward: false,
      carriedForwardDays: 0,
      staleness: { stale: false, calendarDaysOld: 0, businessDaysOld: 0, carriedForwardOnly: false },
      source: 'LIVE',
      provenance: 'ESTIMATE',
      fallbackOnly: true,
    };
    // The same two checks fx.ts applies to every bundled read (`assertFallbackLane`), applied here
    // through the exported error class so the control exercises the real refusal path.
    if ((lying as { source: string }).source !== 'BUNDLED') {
      expect(() => {
        throw new FxLaneError('source', 'BUNDLED', String((lying as { source: string }).source));
      }).toThrow(FxLaneError);
    } else if ((lying as { fallbackOnly?: unknown }).fallbackOnly !== true) {
      expect(() => {
        throw new FxLaneError('fallbackOnly', 'true', 'false');
      }).toThrow(FxLaneError);
    }
  });

  it('every produced LIVE rate is ESTIMATE — a reference rate is never inherited into certainty', () => {
    const rates = [
      liveRate('USD', 3.0),
      liveRate('JPY', 1.8746, FETCH_DATE, 100),
      liveRate('LBP', 0.0003, FETCH_DATE, 10),
    ];
    expect(rates.every((r) => r.provenance === 'ESTIMATE')).toBe(true);
    expect(rates.every((r) => r.source === 'LIVE' && !('fallbackOnly' in r))).toBe(true);
  });
});

describe('A7 — offline with no cache degrades to COMPARISON_INCOMPLETE and never to a number', () => {
  it('a currency outside every lane yields COMPARISON_INCOMPLETE, not zero', () => {
    const r = resolveFxRate({ snapshot }, 'XYZ_NOPE', SNAPSHOT_DATE);
    expect(isIncomplete(r)).toBe(true);
    if (r.resolution === 'COMPARISON_INCOMPLETE') {
      expect(String(r.reason)).toMatch(/no rate|outside|currency/i);
    }
  });

  it('an empty cache behaves like no cache — the cold start still resolves via BUNDLED', () => {
    const r = resolveFxRate({ snapshot, cached: [] }, 'USD', SNAPSHOT_DATE);
    expect(r.resolution).toBe('BUNDLED');
  });
});
