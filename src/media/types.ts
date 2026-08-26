import type { ProvenanceChip } from '../authority/provenanceChip';

/** Canonical media kinds from MEDIA_ARCHITECTURE.md ```media-schema. */
export type MediaKind =
  | 'CARD_ARTWORK'
  | 'ISSUER_MARK'
  | 'NETWORK_MARK'
  | 'OFFER_ARTWORK'
  | 'MERCHANT_LOGO'
  | 'CATEGORY_ART'
  | 'GENERIC';

export type MediaSubjectKind =
  | 'card'
  | 'issuer'
  | 'network'
  | 'benefit'
  | 'merchant'
  | 'category'
  | 'none';

export type MediaFallbackClass = 'card' | 'benefit';

export type MediaRightsState = 'CLEARED' | 'DENIED' | 'UNRESOLVED';

/**
 * A content-pack media row, plus the fields a fixture may omit so absence can be UNRESOLVED.
 * This is a consumer of the schema, not a restatement of the fence.
 */
export interface MediaRecord {
  readonly assetId?: string;
  readonly mediaKind: MediaKind;
  readonly subjectKind: MediaSubjectKind;
  readonly subjectId: string;
  readonly rightsState?: MediaRightsState;
  readonly rightsBasis?: string;
  readonly rightsDecidedBy?: string;
  readonly rightsDecidedAt?: string;
  readonly attribution?: string;
  readonly sourceUrl?: string;
  readonly contentHash?: string;
  readonly altTextKey?: string;
  readonly aspectRatio?: string;
  readonly fallbackClass: MediaFallbackClass;
  readonly provenanceChip?: ProvenanceChip;
  readonly supersededBy?: string;
}

export interface MediaSubject {
  readonly subjectKind: MediaSubjectKind;
  readonly subjectId: string;
  readonly fallbackClass: MediaFallbackClass;
}

/**
 * Optional catalog facts that light generated tier 3. The M1 derived population carries none of
 * these, so those subjects fall to the generic tier — which is why removing generic fails totality.
 */
export interface GeneratedContext {
  readonly issuerId?: string;
  readonly productType?: string;
  readonly categoryKey?: string;
}

export interface GeneratedSpec {
  readonly lane: MediaFallbackClass;
  readonly tier: 3 | 4;
  readonly paletteKey: 'neutral' | 'accent' | 'raised' | 'sunken';
  readonly treatment: 'product' | 'category' | 'generic';
}

export interface MediaResolution {
  readonly tier: 1 | 2 | 3 | 4;
  readonly kind: 'asset' | 'generated';
  readonly assetId: string | null;
  readonly generatedSpec: GeneratedSpec | null;
  readonly altTextKey: string;
  readonly aspectRatio: string;
  readonly rightsState: MediaRightsState | 'NOT_APPLICABLE';
  readonly attribution: string | null;
  readonly provenanceChip: ProvenanceChip;
  readonly why: string;
}

export interface ResolveMediaOptions {
  /** Spec §3 still forbids real card artwork. Default true. */
  readonly spec3ForbidsCardArtwork?: boolean;
  readonly context?: GeneratedContext;
  /**
   * Test-only: drop the generic tier so M1's negative control can watch totality fail.
   * Production always leaves this unset.
   */
  readonly omitGeneric?: boolean;
}
