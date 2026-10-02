/**
 * MVP_SCOPE §5 "Store rehydration/lifecycle is unsafe or incomplete."
 *
 * Regression proof that an unloaded or failed store is never read as a
 * trustworthy empty collection.
 */

import {
  HYDRATING,
  NOT_HYDRATED,
  classifyCollection,
  describeHydrationError,
  hydrated,
  hydrationFailed,
  isCountTrustworthy,
  isKnownEmpty,
  isPending,
} from '../hydration';

const AT = '2026-08-15T00:00:00Z';

describe('store hydration lifecycle', () => {
  it('trusts a count only once hydrated', () => {
    expect(isCountTrustworthy(NOT_HYDRATED)).toBe(false);
    expect(isCountTrustworthy(HYDRATING)).toBe(false);
    expect(isCountTrustworthy(hydrationFailed('vault locked'))).toBe(false);
    expect(isCountTrustworthy(hydrated(AT))).toBe(true);
  });

  it('never reports an unloaded store as known-empty', () => {
    // THE BUG: `cards.length === 0` before hydration told a user with cards
    // that they had none.
    expect(isKnownEmpty(NOT_HYDRATED, 0)).toBe(false);
    expect(isKnownEmpty(HYDRATING, 0)).toBe(false);
    expect(isKnownEmpty(hydrationFailed('vault locked'), 0)).toBe(false);
    expect(isKnownEmpty(hydrated(AT), 0)).toBe(true);
  });

  it('does not confuse a populated store with an empty one', () => {
    expect(isKnownEmpty(hydrated(AT), 3)).toBe(false);
  });

  it('classifies every lifecycle state distinctly', () => {
    expect(classifyCollection(NOT_HYDRATED, 0)).toBe('PENDING');
    expect(classifyCollection(HYDRATING, 0)).toBe('PENDING');
    expect(classifyCollection(hydrationFailed('locked'), 0)).toBe('UNAVAILABLE');
    expect(classifyCollection(hydrated(AT), 0)).toBe('KNOWN_EMPTY');
    expect(classifyCollection(hydrated(AT), 2)).toBe('KNOWN_POPULATED');
  });

  it('separates a locked vault from an empty wallet', () => {
    // Both leave `cards: []` behind; only one should send the user to the
    // add-card flow.
    expect(classifyCollection(hydrationFailed('vault locked'), 0)).not.toBe(
      classifyCollection(hydrated(AT), 0),
    );
  });

  it('marks pending states for a loading affordance', () => {
    expect(isPending(NOT_HYDRATED)).toBe(true);
    expect(isPending(HYDRATING)).toBe(true);
    expect(isPending(hydrated(AT))).toBe(false);
    expect(isPending(hydrationFailed('x'))).toBe(false);
  });

  it('records a failure reason without losing it', () => {
    const state = hydrationFailed(describeHydrationError(new Error('vault is locked')));
    expect(state.status).toBe('FAILED');
    expect(state.error).toContain('vault is locked');
    expect(describeHydrationError('plain string')).toBe('plain string');
    expect(describeHydrationError(undefined)).toBe('unknown_hydration_error');
  });

  it('carries a value only on the state that should have one', () => {
    expect(hydrated(AT).hydratedAt).toBe(AT);
    expect(NOT_HYDRATED.hydratedAt).toBeUndefined();
    expect(NOT_HYDRATED.error).toBeUndefined();
    expect(hydrationFailed('x').hydratedAt).toBeUndefined();
  });
});
