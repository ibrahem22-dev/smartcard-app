/**
 * GATE: card-identity-split — criterion M6.  →  `CARD-IDENTITY-SPLIT OK`
 *
 *   > **M6.** *"CardProduct and UserCard are structurally separate: no UserCard
 *   > record holds artwork, an asset reference or a shared product fact, and no
 *   > CardProduct holds user state."*
 *
 * MEASURES: 'source'. The population is the exported `UserCard` and `CardProduct`
 * interfaces plus the persisted `CardEntry` shape. A hand-kept list of "fields
 * we care about" that is not derived from those interfaces would go silent the
 * day a new mixed field landed.
 *
 * THE LEGACY `interface CardInput` IS THE DEFECT. It conflated product facts,
 * user state and engine output. It must not exist as an interface. A type alias
 * onto the composed engine view is a migration seam, not a stored record.
 *
 * NEGATIVE CONTROL (contract §13 M6): add an artworkUrl field to UserCard and
 * watch this gate fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['M6'];
export const SENTINEL = 'CARD-IDENTITY-SPLIT OK';
export const MEASURES = 'source';

const TYPES = 'src/types/card.types.ts';
const STORE = 'src/store/useCardsStore.ts';

const USER_FORBIDDEN = [
  'artworkUrl',
  'imageUrl',
  'logoUrl',
  'sourceUrl',
  'mediaAsset',
  'cashbackRate',
  'annualFee',
  'rewardCategories',
  'foreignTransactionFee',
  'supportsInstallments',
  'issuer',
  'network',
  'cardRates',
  'cardFee',
];

const PRODUCT_FORBIDDEN = [
  'last4',
  'currentBalance',
  'isActive',
  'framework',
  'billingCycle',
  'primaryRole',
  'unknownClub',
  'displayName',
  'cardIssuanceDate',
  'hasForeignCurrencyAccount',
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const interfaceBody = (src, name) => {
  const start = src.search(new RegExp('export\\s+interface\\s+' + name + '\\b'));
  if (start < 0) return null;
  const from = src.indexOf('{', start);
  if (from < 0) return null;
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  return null;
};

const mentions = (body, names) => names.filter((n) => new RegExp('\\b' + n + '\\b').test(body));

export const run = async ({ root }) => {
  const typesAbs = join(root, TYPES);
  const storeAbs = join(root, STORE);
  if (!existsSync(typesAbs)) {
    return fail(TYPES + ' does not exist — M6 is about the card identity types');
  }
  if (!existsSync(storeAbs)) {
    return fail(STORE + ' does not exist — M6 is also about the persisted record');
  }

  const types = stripComments(readFileSync(typesAbs, 'utf8'));
  const store = stripComments(readFileSync(storeAbs, 'utf8'));

  if (/export\s+interface\s+CardInput\b/.test(types)) {
    return fail(TYPES + ' still exports interface CardInput — that mixed stored record is the defect M6 replaces');
  }

  const user = interfaceBody(types, 'UserCard');
  const product = interfaceBody(types, 'CardProduct');
  const entry = interfaceBody(store, 'CardEntry');

  if (!user) return fail(TYPES + ' does not export interface UserCard');
  if (!product) return fail(TYPES + ' does not export interface CardProduct');
  if (!entry) return fail(STORE + ' does not export interface CardEntry');

  const problems = [];

  if (!/\bcardProductId\b/.test(user)) {
    problems.push('UserCard has no cardProductId — a user record that does not reference a product is not a split');
  }
  if (!/\bcardProductId\b/.test(product)) {
    problems.push('CardProduct has no cardProductId');
  }
  if (!/\blast4\?/.test(user) && !/\blast4\?:\s*string/.test(user)) {
    problems.push('UserCard.last4 must be optional — spec §10: the tile that omits digits is the normal case');
  }

  const userHits = mentions(user, USER_FORBIDDEN);
  if (userHits.length) {
    problems.push('UserCard holds product/artwork fields: ' + userHits.join(', '));
  }
  const productHits = mentions(product, PRODUCT_FORBIDDEN);
  if (productHits.length) {
    problems.push('CardProduct holds user-state fields: ' + productHits.join(', '));
  }

  if (!/\breadonly user:\s*UserCard\b/.test(entry)) {
    problems.push('CardEntry does not persist user: UserCard');
  }
  if (!/\breadonly product:\s*CardProduct\b/.test(entry)) {
    problems.push('CardEntry does not persist product: CardProduct');
  }
  if (/\breadonly card:\s*(UserCard|CardInput|EngineCard)\b/.test(entry)) {
    problems.push('CardEntry still persists a mixed `card` field — that is the pre-split record');
  }

  if (problems.length) {
    return fail('M6 broken:\n    ' + problems.join('\n    '));
  }

  return ok(SENTINEL, [
    'UserCard        ' + TYPES + ' — product reference + optional last4 + local state; no artwork, no product facts',
    'CardProduct     ' + TYPES + ' — shared facts; no user state',
    'CardEntry       ' + STORE + ' — persists user + product, not a mixed card',
    'interface CardInput is absent (composed engine view may alias EngineCard)',
  ].join('\n'));
};
