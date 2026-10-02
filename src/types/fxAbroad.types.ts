// /src/types/fxAbroad.types.ts
//
// Verified, per-card foreign-transaction ("abroad") FX data — the app-consumable
// contract v2.0.0 (production-approved 2026-07-27). Unlike the legacy single
// issuer-level `foreignExchangeCommission`, this models the THREE distinct legs
// and never falls back to a silent default: an uncovered card is explicitly
// `unknown`, per DATA_AUTHORITY (no silent defaults, unknown remains unknown).

import type { CardIssuer, CardInput } from './card.types';

export type FxTier = 'A' | 'B' | 'C';

export type AbroadMode = 'purchase' | 'cashWithdrawal';

/** One verified FX leg with its provenance. */
export interface FxLeg {
  readonly value: number;
  readonly unit: 'percent' | 'ils';
  /** null for a percentage rate. */
  readonly currency: string | null;
  /** ISO date the source tariff took effect. */
  readonly effectiveFrom: string;
  readonly source: {
    readonly url: string;
    /** Truncated SHA-256 of the source document. */
    readonly hash: string;
  };
}

/** A card's complete, verified foreign-transaction fee triple. */
export interface CardFxTriple {
  /** Curated-release card slug, e.g. `cal-365-vip`, `card-amex-platinacard`. */
  readonly cardId: string;
  readonly issuer: CardIssuer;
  readonly cardName: string;
  readonly tier: FxTier;
  /** Foreign-currency purchase commission. */
  readonly fxPurchasePct: FxLeg;
  /** Foreign cash withdrawal fee. */
  readonly fxCashWithdrawalForeign: FxLeg;
  /** Same-currency (e.g. ILS) withdrawal fee. */
  readonly withdrawalSameCurrency: FxLeg;
}

/**
 * Resolution result. There is intentionally NO third "default" branch:
 * a card with no verified triple resolves to `unknown`, never to an
 * inferred issuer-wide rate.
 */
export type ResolvedFxAbroad =
  | { readonly status: 'verified'; readonly triple: CardFxTriple }
  | { readonly status: 'unknown'; readonly reason: string };

/** One entry in an abroad ranking — the user's card, its verified triple, and
 *  the leg relevant to the requested mode. */
export interface AbroadRankEntry {
  readonly card: CardInput;
  readonly triple: CardFxTriple;
  readonly leg: FxLeg;
}
