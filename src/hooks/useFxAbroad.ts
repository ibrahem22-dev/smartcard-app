import { useMemo } from 'react';

import fxAbroadJson from '../data/fxAbroad.v2.json';
import fxAbroadMapJson from '../data/fxAbroadCardMap.json';
import { CardIssuer, type CardInput } from '../types/card.types';
import type { CardFxTriple, ResolvedFxAbroad } from '../types/fxAbroad.types';

interface FxMapEntry {
  readonly issuer: string;
  readonly cardName: string;
  readonly matchNames: readonly string[];
}

const FX_ABROAD = fxAbroadJson as unknown as {
  readonly cards: Readonly<Record<string, CardFxTriple>>;
};
const FX_MAP = fxAbroadMapJson as unknown as {
  readonly map: Readonly<Record<string, FxMapEntry>>;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

/**
 * Map a user's card to a curated-release FX slug using issuer + display-name
 * aliases (same idiom as resolveClubName). Exact match wins; a prefix match is
 * used only as a fallback. Returns null when nothing matches — the caller must
 * then treat FX as unknown, never as a default.
 */
export function matchCardToFxSlug(
  issuer: CardIssuer,
  displayName: string,
): string | null {
  const target = normalize(displayName);
  let prefixFallback: string | null = null;

  for (const [slug, entry] of Object.entries(FX_MAP.map)) {
    if (entry.issuer !== issuer) {
      continue;
    }
    for (const name of entry.matchNames) {
      const candidate = normalize(name);
      if (candidate === target) {
        return slug;
      }
      if (
        prefixFallback === null &&
        (target.startsWith(candidate) || candidate.startsWith(target))
      ) {
        prefixFallback = slug;
      }
    }
  }

  return prefixFallback;
}

/**
 * Resolve a card's verified FX-abroad triple, or an explicit `unknown`.
 *
 * There is deliberately NO silent fallback to an issuer-wide rate: a card with
 * no verified, Tier-A triple resolves to `unknown` so the UI can show
 * "not yet confirmed" instead of an inferred number (DATA_AUTHORITY §1).
 */
export function resolveFxAbroad(
  card: Pick<CardInput, 'issuer' | 'displayName'>,
): ResolvedFxAbroad {
  const slug = matchCardToFxSlug(card.issuer, card.displayName);
  if (slug === null) {
    return { status: 'unknown', reason: 'no_verified_fx_data' };
  }
  const triple = FX_ABROAD.cards[slug];
  if (triple === undefined || triple.tier !== 'A') {
    return { status: 'unknown', reason: 'not_tier_a' };
  }
  return { status: 'verified', triple };
}

export function useFxAbroad(card: CardInput | undefined): ResolvedFxAbroad {
  return useMemo<ResolvedFxAbroad>(
    () =>
      card === undefined
        ? { status: 'unknown', reason: 'no_card' }
        : resolveFxAbroad(card),
    [card],
  );
}
