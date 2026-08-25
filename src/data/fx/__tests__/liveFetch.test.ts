import { fetchBoiRates, mapRowToLiveRate, FxLiveFetchError } from '../liveFetch';

/**
 * WP-2.1 / A4–A7 — the BOI live fetch client, against the MEASURED wire shape
 * (authority/boi-fetch-spec.md §4: rows `{key, currentExchangeRate, unit, lastUpdate}`).
 *
 * Every refusal below is a way the lane could quietly go wrong, and every one is a refusal the
 * spec names. A test that has never watched a refusal fire is not evidence that refusing works.
 */

const FETCH_DATE = '2026-08-25';

const okRow = {
  key: 'USD',
  currentExchangeRate: 2.986,
  currentChange: -0.267,
  unit: 1,
  lastUpdate: '2026-08-25T12:20:04.0946434Z',
};

const jpyRow = {
  key: 'JPY',
  currentExchangeRate: 1.8746,
  currentChange: -0.3137,
  unit: 100,
  lastUpdate: '2026-08-25T12:20:04.0946434Z',
};

const json = (value: unknown) => async () => ({
  ok: true,
  status: 200,
  json: async () => value,
});

describe('WP-2.1 — the measured publication maps to validated LIVE rates', () => {
  it('maps a real-shaped row: LIVE source, ESTIMATE provenance, verbatim numbers', async () => {
    const rate = mapRowToLiveRate(okRow, FETCH_DATE);
    expect(rate.currency).toBe('USD');
    expect(rate.quoteUnit).toBe(1);
    expect(rate.rateIlsPerQuoteUnit).toBe(2.986);
    expect(rate.rateDate).toBe('2026-08-25');
    expect(rate.fetchDate).toBe(FETCH_DATE);
    expect(rate.source).toBe('LIVE');
    expect(rate.provenance).toBe('ESTIMATE');
    expect(rate.rateBasis).toBe('BOI_REPRESENTATIVE');
    // OD-23a at the type: there is no per-one field on the produced object.
    expect(Object.keys(rate)).not.toContain('ratePerOneUnit');
    expect(Object.keys(rate)).not.toContain('rateIlsPerOne');
  });

  it('carries JPY exactly as published — per 100, never divided', async () => {
    const rate = mapRowToLiveRate(jpyRow, FETCH_DATE);
    expect(rate.quoteUnit).toBe(100);
    expect(rate.rateIlsPerQuoteUnit).toBe(1.8746);
  });

  it('fetches and validates an episode end to end over an injected transport', async () => {
    const rates = await fetchBoiRates({
      fetchImpl: json({ exchangeRates: [okRow, jpyRow] }) as unknown as typeof fetch,
      fetchDate: FETCH_DATE,
    });
    expect(rates).toHaveLength(2);
    expect(rates.every((r) => r.source === 'LIVE')).toBe(true);
    expect(rates.every((r) => r.provenance === 'ESTIMATE')).toBe(true);
  });
});

describe('A6 — every failure mode refuses rather than invents', () => {
  it('JPY arriving per-1 is REFUSED — the silent divide that turns 934.85 into 93,485', () => {
    expect(() =>
      mapRowToLiveRate({ ...jpyRow, unit: 1 }, FETCH_DATE),
    ).toThrow(FxLiveFetchError);
    try {
      mapRowToLiveRate({ ...jpyRow, unit: 1 }, FETCH_DATE);
    } catch (err) {
      expect((err as FxLiveFetchError).code).toBe('UNIT_REFUSED');
      expect(String((err as Error).message)).toMatch(/93,485|contradicts the declared/);
    }
  });

  it('USD arriving per-100 is REFUSED too — the refusal fires in both directions', () => {
    expect(() => mapRowToLiveRate({ ...okRow, unit: 100 }, FETCH_DATE)).toThrow(
      FxLiveFetchError,
    );
    try {
      mapRowToLiveRate({ ...okRow, unit: 100 }, FETCH_DATE);
    } catch (err) {
      expect((err as FxLiveFetchError).code).toBe('UNIT_REFUSED');
    }
  });

  it('a non-positive or non-finite published rate is refused', () => {
    for (const bad of [0, -2.986, Number.NaN, Number.POSITIVE_INFINITY]) {
      try {
        mapRowToLiveRate({ ...okRow, currentExchangeRate: bad }, FETCH_DATE);
        throw new Error(`rate ${String(bad)} was accepted`);
      } catch (err) {
        expect(err).toBeInstanceOf(FxLiveFetchError);
        expect((err as FxLiveFetchError).code).toBe('RATE_REFUSED');
      }
    }
  });

  it('a row without an ISO lastUpdate is refused — a rate whose age cannot be computed', () => {
    for (const bad of [undefined, '', 'yesterday', '25/08/2026']) {
      try {
        mapRowToLiveRate({ ...okRow, lastUpdate: bad as string | undefined }, FETCH_DATE);
        throw new Error(`lastUpdate ${String(bad)} was accepted`);
      } catch (err) {
        expect(err).toBeInstanceOf(FxLiveFetchError);
        expect((err as FxLiveFetchError).code).toBe('DATE_REFUSED');
      }
    }
  });

  it('an HTML error page is NOT_JSON, never a partial accept', async () => {
    const htmlFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    })) as unknown as typeof fetch;
    await expect(
      fetchBoiRates({ fetchImpl: htmlFetch, attempts: 1, fetchDate: FETCH_DATE }),
    ).rejects.toMatchObject({ code: 'NOT_JSON' });
  });

  it('an empty publication is SHAPE-refused, not zero rates to convert with', async () => {
    await expect(
      fetchBoiRates({
        fetchImpl: json({ exchangeRates: [] }) as unknown as typeof fetch,
        attempts: 1,
        fetchDate: FETCH_DATE,
      }),
    ).rejects.toMatchObject({ code: 'SHAPE' });
  });

  it('one refused row refuses the whole episode — no partial accept, no silent drop', async () => {
    const badRow = { key: 'XYZ', currentExchangeRate: 3, unit: 7, lastUpdate: '2026-08-25T00:00:00Z' };
    await expect(
      fetchBoiRates({
        fetchImpl: json({ exchangeRates: [okRow, badRow] }) as unknown as typeof fetch,
        attempts: 1,
        fetchDate: FETCH_DATE,
      }),
    ).rejects.toMatchObject({ code: 'UNIT_REFUSED', currency: 'XYZ' });
  });
});

describe('A4 — the transport policy is PD-P3-002: two attempts, then refuse', () => {
  it('retries a 5xx once and refuses after the second failure with HTTP_STATUS', async () => {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      return { ok: false, status: 503 };
    }) as unknown as typeof fetch;
    await expect(
      fetchBoiRates({ fetchImpl: flaky, fetchDate: FETCH_DATE }),
    ).rejects.toMatchObject({ code: 'HTTP_STATUS' });
    expect(calls).toBe(2);
  });

  it('does NOT retry a 4xx — asking again will not help', async () => {
    let calls = 0;
    const forbidden = (async () => {
      calls += 1;
      return { ok: false, status: 404 };
    }) as unknown as typeof fetch;
    await expect(
      fetchBoiRates({ fetchImpl: forbidden, fetchDate: FETCH_DATE }),
    ).rejects.toMatchObject({ code: 'HTTP_STATUS' });
    expect(calls).toBe(1);
  });

  it('refuses with TIMEOUT when the attempt does not answer in time', async () => {
    const slow = ((_input: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      })) as unknown as typeof fetch;
    await expect(
      fetchBoiRates({
        fetchImpl: slow,
        timeoutMs: 20,
        attempts: 1,
        fetchDate: FETCH_DATE,
      }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('refuses with NETWORK when the transport itself fails, and stops after its attempts', async () => {
    let calls = 0;
    const dead = (async () => {
      calls += 1;
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    await expect(
      fetchBoiRates({ fetchImpl: dead, fetchDate: FETCH_DATE }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    expect(calls).toBe(2);
  });
});
