import type { MediaRecord } from './types';

const SESSION_LIKE =
  /(session|campaign|agent|worker|supervisor|claude|codex|cursor|antigravity|ox alpha|automated|script)/i;

const CARD_BRAND_KINDS = new Set(['CARD_ARTWORK', 'ISSUER_MARK', 'NETWORK_MARK']);

export interface RightsVerdict {
  readonly renderable: boolean;
  readonly why: string;
  readonly selfGranted?: boolean;
}

/**
 * The rights decision applied exactly as MEDIA_ARCHITECTURE.md §4 and p4-media.mjs state it.
 * Absence of rightsState is UNRESOLVED. No session may grant a clearance.
 */
export function rightsVerdict(rec: MediaRecord, spec3Forbids: boolean): RightsVerdict {
  const st = rec.rightsState ?? 'UNRESOLVED';
  if (st !== 'CLEARED') {
    return {
      renderable: false,
      why: st === 'DENIED' ? 'DENIED' : 'UNRESOLVED (absent counts as unresolved)',
    };
  }
  for (const field of ['rightsBasis', 'rightsDecidedBy', 'rightsDecidedAt'] as const) {
    if (!String(rec[field] ?? '').trim()) {
      return {
        renderable: false,
        why: `CLEARED but ${field} is empty — an incomplete clearance is not a clearance`,
      };
    }
  }
  if (SESSION_LIKE.test(String(rec.rightsDecidedBy))) {
    return {
      renderable: false,
      why: `rightsDecidedBy names a session or campaign ("${rec.rightsDecidedBy}"). No session may grant a clearance.`,
      selfGranted: true,
    };
  }
  if (spec3Forbids && CARD_BRAND_KINDS.has(rec.mediaKind)) {
    return {
      renderable: false,
      why: 'cleared, but spec §3 still says "never real card artwork" — the design gate is independent of the rights gate',
    };
  }
  return { renderable: true, why: 'CLEARED with a complete basis, on a kind authority permits' };
}
