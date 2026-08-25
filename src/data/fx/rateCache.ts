import type { FxRate } from '@smartcard/data-authority-adapter';

/**
 * THE RATE CACHE — the CACHED lane of the degradation chain (spec §5, handoff P3-1).
 *
 * The chain is USER → LIVE → CACHED → BUNDLED → COMPARISON_INCOMPLETE, decided inside the
 * boundary. This module is only the persistence of the CACHED lane: every successful live fetch is
 * written here, and because a success always populates the cache, **the bundled snapshot
 * participates only until the first successful fetch** — P3-1's requirement as a consequence of
 * chain order rather than a rule anybody has to remember.
 *
 * What is stored: the already-validated `FxRate` objects, verbatim. No re-validation theatre on
 * read (they were refused or accepted once, at fetch time), no derived fields, and no per-one
 * anything — OD-23a holds in the cache too.
 *
 * The driver is a port. The app wires a file driver; tests use the memory driver; neither this
 * module nor the lane knows which is in play.
 */

export interface RateCacheDriver {
  /** All cached rates, or null when nothing has ever been written. */
  read(): Promise<readonly FxRate[] | null>;
  write(rates: readonly FxRate[]): Promise<void>;
}

/** In-memory driver — for tests and for a session that has not earned persistence yet. */
export function memoryRateCache(): RateCacheDriver {
  let store: readonly FxRate[] | null = null;
  return {
    async read() {
      return store;
    },
    async write(rates) {
      store = [...rates];
    },
  };
}

/**
 * File-backed driver over an injected minimal file system (the expo-file-system shape).
 *
 * Injected rather than imported so the engine core stays testable without the native module, and so
 * the ONE place that knows about storage paths is the composition root, not the data layer.
 */
export interface MinimalFileSystem {
  readAsStringAsync?(file: { uri: string }): Promise<{ uri?: string }>;
  writeAsStringAsync?(file: { uri: string }, contents: string): Promise<void>;
  documentDirectory?: string | null;
}

export function fileRateCache(
  fileSystem: MinimalFileSystem,
  fileName = 'boi-rate-cache.json',
): RateCacheDriver {
  const uri = () => {
    const dir = fileSystem.documentDirectory;
    if (!dir) throw new Error('no document directory; the rate cache cannot be stored');
    return `${dir}${fileName}`;
  };
  return {
    async read() {
      try {
        const file = { uri: uri() };
        if (!fileSystem.readAsStringAsync) return null;
        const contents = await fileSystem.readAsStringAsync(file);
        if (!contents.uri) return null;
        const parsed = JSON.parse(contents.uri) as unknown;
        if (!Array.isArray(parsed)) return null;
        return parsed as readonly FxRate[];
      } catch {
        // A missing or corrupt cache file is "nothing cached" — the chain degrades honestly.
        return null;
      }
    },
    async write(rates) {
      if (!fileSystem.writeAsStringAsync) {
        throw new Error('the injected file system cannot write; refusing to pretend the cache saved');
      }
      await fileSystem.writeAsStringAsync({ uri: uri() }, JSON.stringify(rates));
    },
  };
}

/**
 * The freshest cached rate for a currency — the value handed to the boundary as `cached`.
 *
 * "Freshest" is by `rateDate`, never by insertion order: two writes arriving out of order must not
 * make yesterday's rate outrank today's.
 */
export function cachedRateFor(
  rates: readonly FxRate[] | null,
  currency: string,
): FxRate | undefined {
  if (!rates) return undefined;
  let best: FxRate | undefined;
  for (const rate of rates) {
    if (rate.currency !== currency) continue;
    if (best === undefined || rate.rateDate > best.rateDate) best = rate;
  }
  return best;
}
