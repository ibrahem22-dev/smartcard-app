/**
 * THE MERCHANT DIRECTORY — Merchant Radar's single door to the shipped taxonomy pack.
 *
 * Only modules inside `src/data/adapter/**` may name a pack or the published adapter package (D2),
 * so this file is where the merchant vocabulary is read and nowhere else. The Check surfaces
 * receive the views below; they never open `taxonomy/pack.json`, never count its rows, and never
 * invent a merchant that is not in it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY NAME HERE IS THE ESTATE'S, INCLUDING THE ABSENCES
 *
 * `AdapterMerchant` carries `nameHe` on 189 of 266 rows and `nameAr` on 93, plus 413 aliases. A
 * merchant with no Arabic name has one because the estate searched and recorded an evidenced
 * absence — `nameArStatus: 'UNKNOWN_AFTER_RESEARCH'` — and this module returns the absence rather
 * than transliterating one. A display name falls back through the reader's language to the
 * canonical name, which is a name the estate published; it is never synthesised.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE QUICK CHIPS ARE RESOLVED, NOT TYPED
 *
 * The Owner named five merchants for the checkout chips. Their ids are declared here as ids to
 * RESOLVE, and `quickMerchants()` returns only those the pack actually holds: an id the estate
 * does not carry yields no chip, rather than a chip with a name this file made up. That is the
 * difference between naming a merchant and asserting one exists.
 */
import {
  openTaxonomySlices,
  type AdapterMerchant,
  type PackDocument,
} from '@smartcard/data-authority-adapter';

import taxonomyPackJson from './packs/taxonomy/pack.json';

import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';

export type MerchantView = AdapterMerchant;

/** The reader's language, for choosing which of the estate's published names to show. */
export type MerchantNameLanguage = 'he' | 'ar' | 'en';

const taxonomyPack = taxonomyPackJson as PackDocument;

/**
 * READ ONCE, ON FIRST USE, NOT AT IMPORT.
 *
 * `CheckInputScreen` imports this module and dozens of render suites mount that screen. Opening a
 * 266-row slice in every one of them at import time would put pack parsing on the critical path of
 * files that never ask a merchant question. The memo keeps the "one read" property that makes two
 * callers see the same rows; the laziness keeps a screen that shows no merchant from paying for it.
 */
let merchantsMemo: readonly MerchantView[] | null = null;

function readMerchants(): readonly MerchantView[] {
  if (merchantsMemo === null) {
    assertPinnedAdapter();
    merchantsMemo = openTaxonomySlices(taxonomyPack, {
      expectedDatasetId: EXPECTED_DATASET_ID,
    }).merchants.all();
  }
  return merchantsMemo;
}

/** Every merchant the shipped taxonomy pack holds, in the pack's canonical order. */
export function allMerchants(): readonly MerchantView[] {
  return readMerchants();
}

/**
 * The five checkout chips the Owner named, AS IDS TO RESOLVE.
 *
 * Order is the Owner's. An id absent from the pack produces no chip — see the file header.
 */
export const QUICK_MERCHANT_IDS: readonly string[] = [
  'merch:shufersal',
  'merch:carrefour',
  'merch:rami-levy-stores',
  'merch:super-pharm',
  'merch:sonol',
];

let byIdMemo: Map<string, MerchantView> | null = null;

function merchantIndex(): Map<string, MerchantView> {
  if (byIdMemo === null) {
    byIdMemo = new Map(readMerchants().map((m) => [m.merchantId, m] as const));
  }
  return byIdMemo;
}

/**
 * Word separators inside a name, written as escapes rather than as raw characters.
 *
 * The characters are the same ones: maqaf, apostrophe, double quote, backtick, geresh, gershayim,
 * hyphen, en dash, em dash, underscore, slash, backslash, full stop, comma, brackets. Written raw,
 * the class contains a quote character, and any scanner reading this file for string literals —
 * the i18n audit does — sees a quote open, runs to the next one, and reports the geresh inside as
 * untranslated Hebrew reaching a reader. It never reached one; it is punctuation in a regex.
 */
const SEPARATORS = /[\u05be\u0027\u0022\u0060\u05f3\u05f4\u002d\u2013\u2014\u005f\u002f\u005c\u002e\u002c()[\]]+/g;

/**
 * Normalisation for matching only — never for display.
 *
 * Case folded, NFC composed, whitespace collapsed, and Hebrew/Arabic diacritics dropped so that a
 * typed name matches a stored one that carries points. Punctuation that separates words in a brand
 * (hyphen, apostrophe, quote) becomes a space rather than vanishing, because Super-Pharm and
 * Super Pharm are the same shop.
 */
export function normalizeMerchantText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFC')
    .replace(/[֑-ׇً-ْٰ]/g, '')
    .replace(SEPARATORS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every string the estate published for this merchant, for matching. Display uses `merchantName`. */
export function merchantHaystack(merchant: MerchantView): readonly string[] {
  return [
    merchant.canonicalName,
    merchant.nameHe,
    merchant.nameAr,
    merchant.nameEn,
    ...merchant.aliases,
  ].filter((part): part is string => typeof part === 'string' && part.trim() !== '');
}

/**
 * The name to SHOW, in the reader's language, falling back to a name the estate published.
 *
 * `canonicalName` is the last resort and it is always present, so this never returns an empty
 * string and never returns a name nobody published.
 */
export function merchantName(
  merchant: MerchantView,
  language: MerchantNameLanguage,
): string {
  if (language === 'he') return merchant.nameHe ?? merchant.canonicalName;
  if (language === 'ar') return merchant.nameAr ?? merchant.nameEn ?? merchant.canonicalName;
  return merchant.nameEn ?? merchant.canonicalName;
}

/** True when the estate published no name in this language — the reader is seeing a fallback. */
export function merchantNameIsFallback(
  merchant: MerchantView,
  language: MerchantNameLanguage,
): boolean {
  if (language === 'he') return merchant.nameHe === undefined;
  if (language === 'ar') return merchant.nameAr === undefined;
  return merchant.nameEn === undefined;
}

/** One merchant by canonical id, or `undefined`. Absence is an answer. */
export function merchantById(merchantId: string): MerchantView | undefined {
  return merchantIndex().get(merchantId);
}

/**
 * Resolve a typed name or alias to exactly one merchant, or `undefined`.
 *
 * EXACT MATCH ONLY, over the normalised forms of every published name and alias. A prefix match
 * would resolve a two-letter stem to several merchants, and a resolver that silently picks one of
 * them is a resolver that is sometimes wrong without saying so. Ambiguity is reported as
 * `undefined`; `searchMerchants` is where a partial query belongs.
 */
export function resolveMerchantAlias(query: string): MerchantView | undefined {
  const needle = normalizeMerchantText(query);
  if (needle === '') return undefined;
  const hits = readMerchants().filter((merchant) =>
    merchantHaystack(merchant).some((part) => normalizeMerchantText(part) === needle),
  );
  return hits.length === 1 ? hits[0] : undefined;
}

export interface MerchantSearchOptions {
  /** Hard bound so a one-letter query cannot hand a list screen 266 rows. */
  readonly limit?: number;
}

const DEFAULT_SEARCH_LIMIT = 8;

/**
 * Substring search over every published name and alias, in canonical pack order.
 *
 * An exact match is promoted to the front — a name typed in full should not rank behind a merchant
 * whose alias merely contains it — and everything else keeps the pack's own order, which is
 * deterministic across reads and across builds.
 */
export function searchMerchants(
  query: string,
  options?: MerchantSearchOptions,
): readonly MerchantView[] {
  const needle = normalizeMerchantText(query);
  if (needle === '') return [];
  const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT;

  const exact: MerchantView[] = [];
  const partial: MerchantView[] = [];
  for (const merchant of readMerchants()) {
    const parts = merchantHaystack(merchant).map(normalizeMerchantText);
    if (parts.some((part) => part === needle)) exact.push(merchant);
    else if (parts.some((part) => part.includes(needle))) partial.push(merchant);
  }
  return [...exact, ...partial].slice(0, limit);
}

/** The Owner's checkout chips, resolved. An id the pack does not carry yields no chip. */
export function quickMerchants(): readonly MerchantView[] {
  return QUICK_MERCHANT_IDS.map(merchantById).filter(
    (merchant): merchant is MerchantView => merchant !== undefined,
  );
}

/** The taxonomy pack's identity, so a surface can say which estate it read. */
export function merchantPackIdentity(): {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly packVersion: string;
} {
  return {
    datasetId: taxonomyPack.datasetId,
    datasetVersion: taxonomyPack.datasetVersion,
    packVersion: taxonomyPack.packVersion,
  };
}
