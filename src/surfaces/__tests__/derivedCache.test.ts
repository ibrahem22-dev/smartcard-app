import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  clearCaches,
  getCached,
  putCached,
} from '../derivedCache';
import type { SurfaceContext } from '../surfaceContext';

const context = (over: Partial<SurfaceContext> = {}): SurfaceContext => ({
  asOfDate: '2026-09-01',
  throughDate: '2026-09-30',
  profile: null,
  cards: [],
  installments: [],
  loans: [],
  purchases: [],
  ...over,
});

describe('derived surface cache', () => {
  beforeEach(clearCaches);

  it('returns a cached value when the inputs have not changed', () => {
    const original = context();
    putCached('cache-load-ratio', original, 0.35);

    expect(getCached('cache-load-ratio', { ...original, cards: [...original.cards] })).toBe(0.35);
  });

  it('returns nothing when an input has changed', () => {
    putCached('cache-calendar-risk', context(), 'safe');

    expect(getCached('cache-calendar-risk', context({ throughDate: '2026-10-01' }))).toBeNull();
  });

  it('never returns a stale value alongside a currency figure', () => {
    const original = context({
      profile: {
        id: 'profile:cache-test',
        monthlyIncome: 20_000,
        createdAt: 0,
        updatedAt: 0,
      },
    });
    putCached('cache-load-ratio', original, { amount: 7_000, currency: 'ILS' });

    const changed = {
      ...original,
      profile: original.profile === null ? null : { ...original.profile, monthlyIncome: 25_000 },
    };
    expect(getCached('cache-load-ratio', changed)).toBeNull();
    expect(getCached('cache-load-ratio', original)).toBeNull();
  });

  it('keeps each cache id separate', () => {
    const current = context();
    putCached('cache-best-for', current, ['card:a']);
    putCached('cache-load-ratio', current, 0.2);
    putCached('cache-calendar-risk', current, { '2026-09-01': 'safe' });

    expect(getCached('cache-best-for', current)).toEqual(['card:a']);
    expect(getCached('cache-load-ratio', current)).toBe(0.2);
    expect(getCached('cache-calendar-risk', current)).toEqual({ '2026-09-01': 'safe' });
  });

  it('is in-memory only and reaches no store', () => {
    const source = readFileSync(join(__dirname, '..', 'derivedCache.ts'), 'utf8');

    expect(source).not.toMatch(/from\s+['"][^'"]*store/i);
    expect(source).not.toMatch(/MMKV_KEYS/);
    expect(source).not.toMatch(/keyVault/);
  });
});
