import type { SurfaceContext } from './surfaceContext';

export interface CacheEntry<T> {
  readonly value: T;
  readonly fingerprint: string;
}

/*
 * The whole SurfaceContext is encoded, including optional fields, because it is the complete input
 * to evaluateSurfaceEngines. Sorting object keys makes equivalent reconstructed contexts share a
 * fingerprint without maintaining a second, hand-written list of engine inputs here.
 */
const stableEncode = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (Object.is(value, -0)) return 'number:-0';
    return `number:${String(value)}`;
  }
  if (typeof value === 'boolean') return `boolean:${String(value)}`;
  if (Array.isArray(value)) return `array:[${value.map(stableEncode).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>;
    return `object:{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableEncode(record[key])}`)
      .join(',')}}`;
  }
  throw new Error(`SurfaceContext contains an unsupported ${typeof value} value`);
};

export function fingerprintOf(ctx: SurfaceContext): string {
  return stableEncode(ctx);
}

/* Session-local by design (U4): this module imports no store and exports no backing collection. */
const entries = new Map<string, CacheEntry<unknown>>();

export function putCached<T>(id: string, ctx: SurfaceContext, value: T): void {
  entries.set(id, { value, fingerprint: fingerprintOf(ctx) });
}

export function getCached<T>(id: string, ctx: SurfaceContext): T | null {
  const entry = entries.get(id);
  if (entry === undefined) return null;
  if (entry.fingerprint !== fingerprintOf(ctx)) {
    entries.delete(id);
    return null;
  }
  return entry.value as T;
}

export function clearCaches(): void {
  entries.clear();
}
