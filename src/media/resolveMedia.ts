import { rightsVerdict } from './rights';
import type {
  GeneratedSpec,
  MediaKind,
  MediaRecord,
  MediaResolution,
  MediaSubject,
  ResolveMediaOptions,
} from './types';

const CARD_TIER1: MediaKind = 'CARD_ARTWORK';
const CARD_TIER2: readonly MediaKind[] = ['ISSUER_MARK', 'NETWORK_MARK'];
const BENEFIT_TIER1: MediaKind = 'OFFER_ARTWORK';
const BENEFIT_TIER2: MediaKind = 'MERCHANT_LOGO';

const ALT = {
  cardGenerated: 'ייצוג כרטיס שנוצר באפליקציה',
  cardGeneric: 'ייצוג כללי של כרטיס',
  benefitGenerated: 'ייצוג הטבה לפי קטגוריה',
  benefitGeneric: 'ייצוג כללי של הטבה',
} as const;

const PALETTE = ['neutral', 'accent', 'raised', 'sunken'] as const;

const hashPalette = (id: string): (typeof PALETTE)[number] => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length] ?? 'neutral';
};

const eligible = (
  rec: MediaRecord,
  subject: MediaSubject,
  spec3Forbids: boolean,
): boolean => {
  if (rec.supersededBy) {
    return false;
  }
  if (rec.fallbackClass !== subject.fallbackClass) {
    return false;
  }
  if (rec.subjectId !== subject.subjectId && rec.subjectId !== '*') {
    return false;
  }
  return rightsVerdict(rec, spec3Forbids).renderable;
};

const assetResolution = (
  rec: MediaRecord,
  tier: 1 | 2,
  why: string,
): MediaResolution => ({
  tier,
  kind: 'asset',
  assetId: rec.assetId ?? null,
  generatedSpec: null,
  altTextKey: rec.altTextKey ?? ALT.cardGeneric,
  aspectRatio: rec.aspectRatio ?? '8:5',
  rightsState: rec.rightsState ?? 'UNRESOLVED',
  attribution: rec.attribution ?? null,
  provenanceChip: rec.provenanceChip ?? 'VERIFIED',
  why,
});

const generated = (
  spec: GeneratedSpec,
  altTextKey: string,
  why: string,
): MediaResolution => ({
  tier: spec.tier,
  kind: 'generated',
  assetId: null,
  generatedSpec: spec,
  altTextKey,
  aspectRatio: '8:5',
  rightsState: 'NOT_APPLICABLE',
  attribution: null,
  provenanceChip: 'VERIFIED',
  why,
});

const pickKind = (
  records: readonly MediaRecord[],
  subject: MediaSubject,
  kinds: readonly MediaKind[],
  spec3Forbids: boolean,
): MediaRecord | null => {
  for (const rec of records) {
    if (!kinds.includes(rec.mediaKind)) {
      continue;
    }
    if (eligible(rec, subject, spec3Forbids)) {
      return rec;
    }
  }
  return null;
};

/**
 * One function, two lanes, four tiers. It returns null only when the generic tier is
 * deliberately omitted (M1 negative control). Production never omits that tier.
 */
export function resolveMedia(
  subject: MediaSubject,
  mediaSet: readonly MediaRecord[],
  options: ResolveMediaOptions = {},
): MediaResolution | null {
  const spec3Forbids = options.spec3ForbidsCardArtwork !== false;
  const context = options.context;
  const lane = subject.fallbackClass;

  if (lane === 'card') {
    const t1 = pickKind(mediaSet, subject, [CARD_TIER1], spec3Forbids);
    if (t1) {
      return assetResolution(t1, 1, 'tier 1 CARD_ARTWORK: cleared and spec §3 permits it');
    }
    const t2 = pickKind(mediaSet, subject, CARD_TIER2, spec3Forbids);
    if (t2) {
      return assetResolution(
        t2,
        2,
        `tier 2 ${t2.mediaKind}: cleared and spec §3 permits it; no CARD_ARTWORK`,
      );
    }
    if (context?.issuerId || context?.productType) {
      const spec: GeneratedSpec = {
        lane: 'card',
        tier: 3,
        paletteKey: hashPalette(context.issuerId ?? context.productType ?? subject.subjectId),
        treatment: 'product',
      };
      return generated(
        spec,
        ALT.cardGenerated,
        'tier 3 application-generated card representation; tiers 1–2 inert or uncleared',
      );
    }
  } else {
    const t1 = pickKind(mediaSet, subject, [BENEFIT_TIER1], spec3Forbids);
    if (t1) {
      return assetResolution(t1, 1, 'tier 1 OFFER_ARTWORK: cleared');
    }
    const t2 = pickKind(mediaSet, subject, [BENEFIT_TIER2], spec3Forbids);
    if (t2) {
      return assetResolution(t2, 2, 'tier 2 MERCHANT_LOGO: cleared; no offer artwork');
    }
    const categoryKey = context?.categoryKey ?? (subject.subjectKind === 'category' ? subject.subjectId : undefined);
    if (categoryKey) {
      const spec: GeneratedSpec = {
        lane: 'benefit',
        tier: 3,
        paletteKey: hashPalette(categoryKey),
        treatment: 'category',
      };
      return generated(
        spec,
        ALT.benefitGenerated,
        'tier 3 category artwork (app-owned); no cleared offer or merchant asset',
      );
    }
  }

  if (options.omitGeneric) {
    return null;
  }

  const spec: GeneratedSpec = {
    lane,
    tier: 4,
    paletteKey: 'neutral',
    treatment: 'generic',
  };
  return generated(
    spec,
    lane === 'card' ? ALT.cardGeneric : ALT.benefitGeneric,
    'tier 4 generic app-owned fallback; nothing above it was renderable',
  );
}
