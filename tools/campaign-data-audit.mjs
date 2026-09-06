/**
 * THE CANONICAL DATA AUDIT — campaign addendum §26 · §27 · §28 · §29.
 *
 * It prints counts DERIVED from the shipped packs. Nothing here is typed: every figure comes from
 * the same bytes the app reads, so a number in the campaign report and a number on the device
 * cannot disagree.
 *
 * Run: node tools/campaign-data-audit.mjs
 * Writes: reports/campaign/CANONICAL_DATA_AUDIT.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const pack = (name) =>
  JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'adapter', 'packs', name, 'pack.json'), 'utf8'));

const catalog = pack('catalog').units;
const benefits = pack('benefits').units;
const taxonomy = pack('taxonomy').units;
const content = pack('content').units;

const out = [];
const say = (line = '') => out.push(line);

const current = catalog.cards.filter((c) => c.lifecycleStatus === 'CURRENT' && c.isSelectable === true);
const issuers = Object.fromEntries(catalog.issuers.map((i) => [i.orgId, i]));
const edges = catalog.edges.filter((e) => e.type === 'CARD_ATTACHED_TO_PROGRAMME' && e.shipToApp === true);
const programmeByCard = new Map();
for (const e of edges) {
  programmeByCard.set(e.fromNodeId, [...(programmeByCard.get(e.fromNodeId) ?? []), e.toNodeId]);
}
const benefitCardIds = new Set();
for (const b of benefits.benefits) for (const id of b.cardIds ?? []) benefitCardIds.add(id);

const feeApplies = (row, card) => {
  if (row.issuerOrgId !== card.issuerOrgId) return false;
  const excl = row.excludedOperatorIds ?? [];
  if (card.operatingCardCompanyId && excl.includes(card.operatingCardCompanyId)) return false;
  if (row.scopeKind === 'ISSUER_WIDE') return true;
  if (row.scopeKind !== 'ALL_CARDS_OF_OPERATOR_AT_ISSUER') return false;
  return row.operatingCardCompanyId === undefined
    ? card.operatingCardCompanyId === undefined
    : row.operatingCardCompanyId === card.operatingCardCompanyId;
};
const cardFeeRowsFor = (card) =>
  catalog.fees.filter((f) => f.field === 'CARD_FEE' && f.value && f.value.value !== undefined && feeApplies(f, card));
const feeKey = (f) => String(f.value.value) + '|' + String(f.value.unit) + '|' + String(f.frequency ?? '');

say('# CANONICAL DATA AUDIT');
say('');
say('Derived from the shipped packs by `tools/campaign-data-audit.mjs`. Every figure is counted');
say('from the same bytes the application reads.');
say('');
say('## SECTION 26 — DATASET TOTALS');
say('');
say('| measure | count |');
say('| --- | ---: |');
say('| canonical card products (all lifecycles) | ' + catalog.cards.length + ' |');
say('| CURRENT + selectable products (what Add Card offers) | ' + current.length + ' |');
say('| RETIRED products | ' + catalog.cards.filter((c) => c.lifecycleStatus === 'RETIRED').length + ' |');
say('| TARIFF_ONLY_NOT_PROVEN_CURRENT | ' + catalog.cards.filter((c) => c.lifecycleStatus === 'TARIFF_ONLY_NOT_PROVEN_CURRENT').length + ' |');
say('| EXCLUDED_FROM_PRODUCT_COUNT | ' + catalog.cards.filter((c) => c.lifecycleStatus === 'EXCLUDED_FROM_PRODUCT_COUNT').length + ' |');
say('| shipping organisations | ' + catalog.issuers.filter((i) => i.shipToApp).length + ' |');
say('| — of which BANK | ' + catalog.issuers.filter((i) => i.shipToApp && i.kind === 'BANK').length + ' |');
say('| — of which CARD_COMPANY | ' + catalog.issuers.filter((i) => i.shipToApp && i.kind === 'CARD_COMPANY').length + ' |');
say('| payment networks | ' + catalog.networks.length + ' |');
say('| clubs | ' + catalog.clubs.length + ' |');
say('| programmes | ' + catalog.programmes.length + ' |');
say('| card-to-programme edges | ' + edges.length + ' |');
say('| CURRENT products carrying a programme edge | ' + current.filter((c) => programmeByCard.has(c.cardId)).length + ' |');
say('| CURRENT products with NO programme edge | ' + current.filter((c) => !programmeByCard.has(c.cardId)).length + ' |');
say('| tariff fee rows | ' + catalog.fees.length + ' |');
say('| — CARD_FEE rows | ' + catalog.fees.filter((f) => f.field === 'CARD_FEE').length + ' |');
say('| — scope ALL_CARDS_OF_OPERATOR_AT_ISSUER (bindable) | ' + catalog.fees.filter((f) => f.scopeKind === 'ALL_CARDS_OF_OPERATOR_AT_ISSUER').length + ' |');
say('| — scope ISSUER_WIDE (bindable) | ' + catalog.fees.filter((f) => f.scopeKind === 'ISSUER_WIDE').length + ' |');
say('| — scope NAMED_CARD_OR_LEVEL (NOT bindable — see gaps) | ' + catalog.fees.filter((f) => f.scopeKind === 'NAMED_CARD_OR_LEVEL').length + ' |');
say('| waiver rules | ' + catalog.waivers.length + ' |');
say('| card-level fee exceptions (already applied by the pipeline) | ' + catalog.exceptions.length + ' |');
say('| products with a VERIFIED per-card FX commission | ' + current.filter((c) => c.costs && c.costs.fxCommissionPct && c.costs.fxCommissionPct.value !== undefined).length + ' |');
say('| products with a VERIFIED per-card foreign-ATM percentage | ' + current.filter((c) => c.costs && c.costs.foreignAtmPct && c.costs.foreignAtmPct.value !== undefined).length + ' |');
say('| products with a published same-currency ATM fee | ' + current.filter((c) => c.costs && c.costs.atmSameCurrencyFee && c.costs.atmSameCurrencyFee.value !== undefined).length + ' |');
say('| products with at least one bindable CARD_FEE candidate | ' + current.filter((c) => cardFeeRowsFor(c).length > 0).length + ' |');
say('| products where exactly ONE distinct CARD_FEE figure is bindable | ' + current.filter((c) => { const r = cardFeeRowsFor(c); return r.length > 0 && new Set(r.map(feeKey)).size === 1; }).length + ' |');
say('| products with NO bindable CARD_FEE row | ' + current.filter((c) => cardFeeRowsFor(c).length === 0).length + ' |');
say('| total benefits | ' + benefits.benefits.length + ' |');
say('| benefits pinned to at least one card product | ' + benefits.benefits.filter((b) => (b.cardIds ?? []).length > 0).length + ' |');
say('| distinct products any benefit is pinned to | ' + benefitCardIds.size + ' |');
say('| benefits carrying eligibleMerchantIds | ' + benefits.benefits.filter((b) => (b.eligibleMerchantIds ?? []).length > 0).length + ' |');
say('| benefits with a validUntil | ' + benefits.benefits.filter((b) => b.validUntil).length + ' |');
say('| benefits with a validFrom | ' + benefits.benefits.filter((b) => b.validFrom).length + ' |');
say('| benefits with lifecycleStatus RETIRED | ' + benefits.benefits.filter((b) => b.lifecycleStatus === 'RETIRED').length + ' |');
say('| benefits with lifecycleStatus CURRENT | ' + benefits.benefits.filter((b) => b.lifecycleStatus === 'CURRENT').length + ' |');
say('| benefits carrying a value | ' + benefits.benefits.filter((b) => b.value).length + ' |');
say('| benefits with programmeResolution UNRESOLVED_NAMESPACE_DISJOINT | ' + benefits.benefits.filter((b) => b.programmeResolution === 'UNRESOLVED_NAMESPACE_DISJOINT').length + ' |');
say('| merchants | ' + taxonomy.merchants.length + ' |');
say('| merchants with a Hebrew name | ' + taxonomy.merchants.filter((m) => m.nameHe).length + ' |');
say('| merchants with an Arabic name | ' + taxonomy.merchants.filter((m) => m.nameAr).length + ' |');
say('| merchant aliases | ' + taxonomy.merchants.reduce((n, m) => n + (m.aliases ?? []).length, 0) + ' |');
say('| issuer contact rows | ' + content.contacts.length + ' |');
say('');
say('### Orphans');
say('');
const orphanFeeIssuers = [...new Set(catalog.fees.map((f) => f.issuerOrgId))].filter((o) => !issuers[o]);
const orphanBenefitOrgs = [...new Set(benefits.benefits.map((b) => b.orgId).filter(Boolean))].filter((o) => !issuers[o]);
const orphanEdgeCards = edges.filter((e) => !catalog.cards.some((c) => c.cardId === e.fromNodeId)).length;
const nodeIds = new Set([...catalog.clubs, ...catalog.programmes].map((n) => n.nodeId));
const orphanEdgeNodes = edges.filter((e) => !nodeIds.has(e.toNodeId)).length;
const orphanBenefitCards = [...benefitCardIds].filter((id) => !catalog.cards.some((c) => c.cardId === id));
say('- fee rows naming an organisation the issuers unit does not hold: **' + orphanFeeIssuers.length + '**');
say('- benefits naming an organisation the issuers unit does not hold: **' + orphanBenefitOrgs.length + '** ' + (orphanBenefitOrgs.length ? '(' + orphanBenefitOrgs.join(', ') + ')' : ''));
say('- programme edges from a card the catalog does not hold: **' + orphanEdgeCards + '**');
say('- programme edges to a node neither clubs nor programmes holds: **' + orphanEdgeNodes + '**');
say('- benefit card references resolving to no catalog row: **' + orphanBenefitCards.length + '**');
say('');

say('## SECTION 27 — THE FOUR CONSUMER CARD COMPANIES');
say('');
say('| org | kind | relationship the data states | CURRENT products | network spellings | programme edges | products with bindable CARD_FEE | products with pinned benefits |');
say('| --- | --- | --- | ---: | --- | ---: | ---: | ---: |');
for (const orgId of ['org:max', 'org:cal', 'org:isracard', 'org:amex-il']) {
  const i = issuers[orgId];
  const mine = current.filter((c) => c.issuerOrgId === orgId);
  const nets = [...new Set(mine.map((c) => c.networkRaw).filter(Boolean))].join(' / ');
  const progs = mine.filter((c) => programmeByCard.has(c.cardId)).length;
  const withFee = mine.filter((c) => cardFeeRowsFor(c).length > 0).length;
  const withBen = mine.filter((c) => benefitCardIds.has(c.cardId)).length;
  const rel = i.issuingEntityOrgId ? 'issued by ' + i.issuingEntityOrgId : 'issues its own';
  say('| ' + orgId + ' | ' + i.kind + ' | ' + rel + ' | ' + mine.length + ' | ' + (nets || '-') + ' | ' + progs + ' | ' + withFee + ' | ' + withBen + ' |');
}
say('');
for (const orgId of ['org:max', 'org:cal', 'org:isracard', 'org:amex-il']) {
  const i = issuers[orgId];
  if (i.joinCaveat) say('- **' + orgId + ' join caveat, verbatim:** ' + i.joinCaveat);
}
say('');

say('## SECTION 28 — BANK COVERAGE (the list Add Card actually offers)');
say('');
say('| bank | CURRENT products | operators recorded | network spellings | programme edges | bindable CARD_FEE | pinned benefits | unbindable NAMED rows |');
say('| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |');
const banks = catalog.issuers.filter((i) => i.shipToApp && i.kind === 'BANK' && current.some((c) => c.issuerOrgId === i.orgId));
for (const b of banks.sort((x, y) => x.orgId.localeCompare(y.orgId))) {
  const mine = current.filter((c) => c.issuerOrgId === b.orgId);
  const ops = [...new Set(mine.map((c) => c.operatingCardCompanyId ?? '(none recorded)'))].join(' / ');
  const nets = [...new Set(mine.flatMap((c) => (c.networkRaw ? [c.networkRaw] : [])))].join(' / ');
  const progs = mine.filter((c) => programmeByCard.has(c.cardId)).length;
  const withFee = mine.filter((c) => cardFeeRowsFor(c).length > 0).length;
  const withBen = mine.filter((c) => benefitCardIds.has(c.cardId)).length;
  const named = catalog.fees.filter((f) => f.issuerOrgId === b.orgId && f.scopeKind === 'NAMED_CARD_OR_LEVEL').length;
  say('| ' + b.orgId + ' — ' + (b.nameHe ?? b.nameEn) + ' | ' + mine.length + ' | ' + ops + ' | ' + (nets || '-') + ' | ' + progs + ' | ' + withFee + ' | ' + withBen + ' | ' + named + ' |');
}
say('');
const noProduct = catalog.issuers.filter((i) => i.shipToApp && i.kind === 'BANK' && !current.some((c) => c.issuerOrgId === i.orgId));
say('Banks shipped but with NO current product, therefore NOT offered: ' + (noProduct.map((i) => i.orgId + ' (' + i.lifecycleStatus + ')').join(', ') || 'none'));
say('');

say('## SECTION 29 — THE DISCOVERY CATEGORIES, AGAINST THE ACTUAL CORPUS');
say('');
const merchByCat = {};
for (const m of taxonomy.merchants) {
  const k = m.canonicalCategory ?? '(none)';
  merchByCat[k] = (merchByCat[k] ?? 0) + 1;
}
const merchantsWithBenefit = new Set(benefits.benefits.flatMap((b) => b.eligibleMerchantIds ?? []));
const catOf = Object.fromEntries(taxonomy.merchants.map((m) => [m.merchantId, m.canonicalCategory]));
const offersByCat = {};
for (const b of benefits.benefits) {
  for (const id of b.eligibleMerchantIds ?? []) {
    const k = catOf[id] ?? '(unresolved merchant)';
    offersByCat[k] = (offersByCat[k] ?? 0) + 1;
  }
}
say('| requested category | canonical taxonomy mapping | merchants in taxonomy | benefit offers linked to those merchants |');
say('| --- | --- | ---: | ---: |');
const asked = [
  ['restaurants', ['DINING']],
  ['cinema / entertainment', ['ENTERTAINMENT']],
  ['1+1', []],
  ['fuel', ['FUEL']],
  ['flights / travel', ['TRAVEL_AIRLINE', 'TRAVEL_AGENCY', 'TRAVEL_HOTEL']],
];
for (const [label, keys] of asked) {
  const merchants = keys.reduce((n, k) => n + (merchByCat[k] ?? 0), 0);
  const offers = keys.reduce((n, k) => n + (offersByCat[k] ?? 0), 0);
  const mapping = keys.length === 0
    ? 'no taxonomy category — 1+1 is a benefit SHAPE, not a merchant sector, and the corpus models no such field'
    : keys.join(' / ');
  say('| ' + label + ' | ' + mapping + ' | ' + merchants + ' | ' + offers + ' |');
}
say('');
say('Every merchant category the taxonomy models, with its merchant count:');
say('');
say('| canonical category | merchants |');
say('| --- | ---: |');
for (const [k, v] of Object.entries(merchByCat).sort((a, b) => b[1] - a[1])) say('| ' + k + ' | ' + v + ' |');
say('');
say('Merchants any benefit in the whole corpus is linked to: **' + merchantsWithBenefit.size + '** — ' + [...merchantsWithBenefit].join(', '));
say('');
say('Benefit families the app groups the estate benefitType vocabulary into, over the whole corpus:');
say('');
const FAMILY_PATTERNS = [
  ['lounge', /lounge|airport_vip|airport_service/i],
  ['travel', /travel|airline|miles|flight|car_rental|concierge/i],
  ['insurance', /insurance/i],
  ['foreign-currency', /^fx|foreign_currency|foreign_exchange|fx_/i],
  ['fees', /fee_waiver|card_fee_waiver|fee_discount|account_fee_waiver|fee_reference|membership_cost/i],
  ['cashback', /cashback|crypto_rewards|retail_cashback|partner_cashback/i],
  ['points', /points|loyalty|rewards_program|redemption|accrual|stored_value/i],
  ['merchant', /merchant|retail_discount|partner_benefit|partner_gift|voucher|free_delivery|discount/i],
  ['credit', /loan|interest|installment|payment_flexibility|credit_benefit|financing/i],
];
const familyOf = (b) => {
  const t = b.benefitType ?? '';
  for (const [f, re] of FAMILY_PATTERNS) if (re.test(t)) return f;
  return 'other';
};
const famCounts = {};
const famPinned = {};
for (const b of benefits.benefits) {
  const f = familyOf(b);
  famCounts[f] = (famCounts[f] ?? 0) + 1;
  if ((b.cardIds ?? []).length > 0) famPinned[f] = (famPinned[f] ?? 0) + 1;
}
say('| family | benefits | of which pinned to a card product |');
say('| --- | ---: | ---: |');
for (const [k, v] of Object.entries(famCounts).sort((a, b) => b[1] - a[1])) {
  say('| ' + k + ' | ' + v + ' | ' + (famPinned[k] ?? 0) + ' |');
}
say('');

mkdirSync(join(ROOT, 'reports', 'campaign'), { recursive: true });
writeFileSync(join(ROOT, 'reports', 'campaign', 'CANONICAL_DATA_AUDIT.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
