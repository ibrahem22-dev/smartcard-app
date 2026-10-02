import { conventionalQuoteUnit, type FxRate } from '../adapter/vocabulary';

/**
 * THE BOI LIVE FETCH CLIENT — handoff obligation P3-1, authority/boi-fetch-spec.md §3–§4.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS SETTLED AND WHAT THIS MODULE ADDS
 *
 * Settled elsewhere, and NOT re-derived here: the wire contract (spec §4, MEASURED at
 * 2026-08-25T12:20Z — rows `{key, currentExchangeRate, unit, lastUpdate}`, JPY arriving per 100 and
 * LBP per 10 on the wire today); the schema this module produces (`FxRate`, one schema for the
 * bundled and live lanes); the quotation convention (the adapter's exported table — ONE home);
 * precedence (the boundary's `resolveRate`); staleness (`stalenessOf`).
 *
 * Added here, and only here: the transport (timeout, attempts), the mapping from the measured wire
 * shape to `FxRate`, and the C11 refusals applied against the EXPORTED convention table
 * (PD-P3-004 explains why they are applied client-side rather than through an un-exported
 * `ingestRate`).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY FAILURE MODE REFUSES. NONE INVENTS.
 *
 * A network error is not a rate. A non-200 is not a rate. An HTML error page is not a rate. A row
 * whose `unit` contradicts the declared convention is a CHANGE TO THE PUBLICATION, not a value to
 * accept quietly — accepting JPY as per-1 is how 50,000 JPY becomes 93,485 ILS instead of 934.85,
 * and nothing downstream would look wrong. So each refusal has a code, and the lane above this
 * module degrades through the existing chain rather than retrying into invention.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NOTHING DIVIDES.
 *
 * OD-23a: the adapter returns the native financial fact only; conversion is the engine's, at P3.
 * This module compares `unit` against the convention and carries both numbers verbatim. There is no
 * per-one field on `FxRate` and none is minted here.
 */

/** The endpoint carried in the shipped snapshot's own attribution — spec §C12, verbatim. */
export const BOI_ENDPOINT = 'https://boi.org.il/PublicApi/GetExchangeRates?asXml=false';

export type FxLiveFetchErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'HTTP_STATUS'
  | 'NOT_JSON'
  | 'SHAPE'
  | 'UNIT_REFUSED'
  | 'RATE_REFUSED'
  | 'DATE_REFUSED';

export class FxLiveFetchError extends Error {
  readonly code: FxLiveFetchErrorCode;
  readonly currency: string | undefined;

  constructor(code: FxLiveFetchErrorCode, message: string, currency?: string) {
    super(message);
    this.name = 'FxLiveFetchError';
    this.code = code;
    this.currency = currency;
  }
}

/** One row of the measured wire shape (spec §4). Kept narrow: unknown fields are ignored. */
export interface BoiRateRow {
  key?: unknown;
  currentExchangeRate?: unknown;
  unit?: unknown;
  lastUpdate?: unknown;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Map ONE published row to an `FxRate` at source LIVE — or refuse, with the reason.
 *
 * The refusals are the ingest refusals of C11, applied against the adapter's own exported
 * convention: `conventionalQuoteUnit('JPY') === 100` lives in the adapter, and this module reads it
 * rather than restating it. If the Bank of Israel ever re-bases a currency, the refusal fires HERE,
 * at the boundary of the app, instead of a silent ÷100 entering every figure downstream.
 */
export function mapRowToLiveRate(row: BoiRateRow, fetchDate: string): FxRate {
  if (typeof row.key !== 'string' || row.key.length === 0) {
    throw new FxLiveFetchError(
      'SHAPE',
      `a publication row without a usable currency key (${JSON.stringify(row.key ?? null)}). `
        + 'A rate for no currency is not a rate.',
    );
  }
  const currency = row.key;

  const expectedUnit = conventionalQuoteUnit(currency);
  if (typeof row.unit !== 'number' || !Number.isFinite(row.unit) || row.unit <= 0) {
    throw new FxLiveFetchError(
      'UNIT_REFUSED',
      `${currency}: published quote unit ${JSON.stringify(row.unit ?? null)} is not a positive `
        + `finite number; the declared convention is per ${expectedUnit}.`,
      currency,
    );
  }
  if (row.unit !== expectedUnit) {
    // THE UNIT TRAP, REFUSED IN BOTH DIRECTIONS — JPY arriving per-1, or USD arriving per-100.
    throw new FxLiveFetchError(
      'UNIT_REFUSED',
      `${currency}: published unit ${row.unit} contradicts the declared quotation convention of `
        + `${expectedUnit}. The convention lives in QUOTATION_CONVENTION and a publication that `
        + 'disagrees with it is a change to the publication, not a value to silently accept. '
        + '50,000 JPY priced per-1 instead of per-100 is 93,485 ILS instead of 934.85.',
      currency,
    );
  }

  if (
    typeof row.currentExchangeRate !== 'number'
    || !Number.isFinite(row.currentExchangeRate)
    || row.currentExchangeRate <= 0
  ) {
    throw new FxLiveFetchError(
      'RATE_REFUSED',
      `${currency}: published rate ${JSON.stringify(row.currentExchangeRate ?? null)} is not a `
        + 'positive finite number. Arithmetic that would produce Infinity downstream is refused '
        + 'at the boundary, not rendered.',
      currency,
    );
  }

  if (typeof row.lastUpdate !== 'string' || !ISO_DATETIME.test(row.lastUpdate)) {
    throw new FxLiveFetchError(
      'DATE_REFUSED',
      `${currency}: lastUpdate ${JSON.stringify(row.lastUpdate ?? null)} is not an ISO datetime. `
        + 'A rate whose age cannot be computed can never be shown to be fresh.',
      currency,
    );
  }
  const rateDate = row.lastUpdate.slice(0, 10);
  if (!ISO_DATE.test(rateDate)) {
    throw new FxLiveFetchError(
      'DATE_REFUSED',
      `${currency}: lastUpdate ${row.lastUpdate} does not begin with an ISO date.`,
      currency,
    );
  }

  return {
    currency,
    // Carried verbatim, never divided. See the header.
    quoteUnit: row.unit,
    rateIlsPerQuoteUnit: row.currentExchangeRate,
    rateDate,
    fetchDate,
    source: 'LIVE',
    provenance: 'ESTIMATE',
    rateBasis: 'BOI_REPRESENTATIVE',
  };
}

function parseRows(body: unknown): BoiRateRow[] {
  if (typeof body !== 'object' || body === null) {
    throw new FxLiveFetchError(
      'NOT_JSON',
      'the response body is not a JSON object. An HTML error page or an empty body is a refused '
        + 'fetch, never a partial accept.',
    );
  }
  const rows = (body as { exchangeRates?: unknown }).exchangeRates;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new FxLiveFetchError(
      'SHAPE',
      `the response carries ${Array.isArray(rows) ? rows.length : 'no'} exchangeRates rows. `
        + 'An empty publication is a change to the publication, not zero rates to convert with.',
    );
  }
  return rows as BoiRateRow[];
}

export interface FetchBoiRatesOptions {
  /** Injectable for tests. Defaults to the platform global fetch. */
  fetchImpl?: typeof fetch;
  /** Per-attempt timeout, spec §3 / PD-P3-002. Default 15s. */
  timeoutMs?: number;
  /** At most two attempts — the initial try plus one retry. Spec §3 / PD-P3-002. */
  attempts?: number;
  /**
   * The date this process obtained the rates. Required, because a default that read the clock would
   * make every test depend on when it ran; callers pass their own "today" explicitly.
   */
  fetchDate: string;
}

/**
 * Fetch the BOI representative-rate publication and return it as validated LIVE rates.
 *
 * Transport policy is PD-P3-002: at most `attempts` (default 2) attempts with a per-attempt timeout
 * (default 15s), retrying only NETWORK/TIMEOUT/5xx — a 4xx will not get better by asking again. No
 * background loop, no timer: cadence is PD-P3-003, the caller's.
 *
 * Resolves ONLY with fully validated rates: one refused row refuses the episode, because shipping
 * nine currencies while quietly dropping the tenth is the gate-15 failure class wearing fresh
 * clothes — the output shape stays valid and nobody objects to what is missing.
 */
export async function fetchBoiRates(options: FetchBoiRatesOptions): Promise<readonly FxRate[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxAttempts = Math.max(1, options.attempts ?? 2);

  let lastError: FxLiveFetchError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(BOI_ENDPOINT, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retriable = response.status >= 500;
        lastError = new FxLiveFetchError(
          'HTTP_STATUS',
          `the Bank of Israel endpoint answered HTTP ${response.status}`
            + (retriable ? '' : ' — a client error will not improve on retry'),
        );
        if (!retriable) throw lastError;
        continue;
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        lastError = new FxLiveFetchError(
          'NOT_JSON',
          'the response body did not parse as JSON. An HTML error page is a refused fetch, '
            + 'never a partial accept',
        );
        continue;
      }
      return parseRows(body).map((row) => mapRowToLiveRate(row, options.fetchDate));
    } catch (err) {
      if (err instanceof FxLiveFetchError) {
        if (err.code === 'NETWORK') {
          lastError = err;
          continue;
        }
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new FxLiveFetchError(
          'TIMEOUT',
          `no complete answer within ${timeoutMs}ms`,
        );
        continue;
      }
      lastError = new FxLiveFetchError(
        'NETWORK',
        `the fetch itself failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new FxLiveFetchError('NETWORK', 'the fetch failed for an unnamed reason');
}
