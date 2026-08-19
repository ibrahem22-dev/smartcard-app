/**
 * W1-AS-07 — Route bundled FX/purchase data through authority-safe contracts.
 *
 * The bundled FX dataset is genuinely good data: each leg carries an effective
 * date and a hashed source document. But it was verified against a tariff PDF
 * shipped inside the app, not read from a live Data Authority. Its provenance
 * is therefore BUNDLED_DATASET, and `isCurrentAuthority` rejects it.
 *
 * That is the point. `resolveFxAbroad` already says `status: 'verified'`, and
 * "verified" there is easy to read as "official". This bridge keeps the raw
 * dataset and the existing resolver completely unchanged, and makes the
 * distinction explicit at the boundary where it matters.
 */

import type {
  CardFxTriple,
  FxLeg,
  ResolvedFxAbroad,
} from '../types/fxAbroad.types';
import {
  type AuthorityValue,
  type Provenance,
  known,
  unknown,
} from './authorityValue';

/**
 * Provenance of everything shipped inside the app bundle.
 *
 * Deliberately NOT in AUTHORITY_GRADE_PROVENANCES: bundled data is a snapshot
 * taken at build time. It cannot know about a tariff change published after the
 * release, so it must never satisfy a requirement for CURRENT official
 * authority.
 */
export const BUNDLED_DATASET_PROVENANCE: Provenance = 'BUNDLED_DATASET';

export interface FxAuthorityTriple {
  readonly cardId: string;
  readonly fxPurchasePct: AuthorityValue<number>;
  readonly fxCashWithdrawalForeign: AuthorityValue<number>;
  readonly withdrawalSameCurrency: AuthorityValue<number>;
}

function legToAuthority(leg: FxLeg): AuthorityValue<number> {
  return known(
    leg.value,
    BUNDLED_DATASET_PROVENANCE,
    leg.effectiveFrom,
    leg.source.hash,
  );
}

function tripleToAuthority(triple: CardFxTriple): FxAuthorityTriple {
  return {
    cardId: triple.cardId,
    fxPurchasePct: legToAuthority(triple.fxPurchasePct),
    fxCashWithdrawalForeign: legToAuthority(triple.fxCashWithdrawalForeign),
    withdrawalSameCurrency: legToAuthority(triple.withdrawalSameCurrency),
  };
}

/**
 * Wrap an existing FX resolution in authority values.
 *
 * The resolver itself is untouched — this consumes its output. An `unknown`
 * resolution stays unknown; a `verified` resolution becomes KNOWN with bundled
 * provenance, which is usable for the user's own comparison but never
 * presentable as official authority.
 */
export function fxAbroadToAuthority(
  resolved: ResolvedFxAbroad,
): FxAuthorityTriple | AuthorityValue<never> {
  if (resolved.status === 'unknown') {
    return unknown(`fx_unresolved:${resolved.reason}`);
  }
  return tripleToAuthority(resolved.triple);
}
