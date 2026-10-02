/**
 * THE 23-SCENARIO ACCEPTANCE BATTERY — ported from the pipeline's archival L13 harness.
 *
 * Every fact comes from the shipped pack bytes through the published Data Authority Adapter. The
 * four ADR-019 harness judgements are gone: FX conversion/ranking uses the production engines,
 * card ranking uses the production scoring engine, and benefit validity/stacking use the two
 * PD-P3-007 production kernels. The pinned dates keep the suite deterministic.
 *
 * @authority ADR-019 §5
 * @authority PD-P3-007
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CardsAdapter,
  CostModelAdapter,
  FxSnapshotSlice,
  PROVENANCE_STATES,
  openBenefitsSlices,
  openCatalogSlices,
  openContentSlices,
  openTaxonomySlices,
  openVerifiedPack,
  type BundledFxSnapshot,
  type FxRate,
  type PackDocument,
  type PackManifest,
  type SignatureEnvelope,
} from '@smartcard/data-authority-adapter';

import { hasClosed, resolveStackingPair } from '../../benefits/validity';
import { compareAbroad, type CardFxQuote } from '../fx';
import { convertToIls } from '../currency';
import { scoreCards } from '../scoring';
import { evaluatePurchaseVerdict } from '../verdict';

const PACKS = join(__dirname, '..', '..', 'data', 'adapter', 'packs');
const DATASET = 'smartcard-canonical-v2';

function openPack(id: string): PackDocument {
  const packBytes = readFileSync(join(PACKS, id, 'pack.json'));
  const manifest = JSON.parse(
    readFileSync(join(PACKS, id, 'manifest.json'), 'utf8'),
  ) as PackManifest;
  const envelope = JSON.parse(
    readFileSync(join(PACKS, id, 'manifest.sig.json'), 'utf8'),
  ) as SignatureEnvelope;
  const opened = openVerifiedPack({
    packBytes,
    manifest,
    envelope,
    expectedDatasetId: DATASET,
    appVersion: manifest.minAppVersion,
  });
  if (!opened.accepted) {
    throw new Error(`${id} did not verify: ${opened.failures.map((failure) => failure.code).join(', ')}`);
  }
  return JSON.parse(packBytes.toString('utf8')) as PackDocument;
}

const catalogPack = openPack('catalog');
const benefitsPack = openPack('benefits');
const taxonomyPack = openPack('taxonomy');
const contentPack = openPack('content');
const options = { expectedDatasetId: DATASET };

const cat = openCatalogSlices(catalogPack, options);
const ben = openBenefitsSlices(benefitsPack, options);
const tax = openTaxonomySlices(taxonomyPack, options);
const con = openContentSlices(contentPack, options);

const cards = CardsAdapter.open({
  datasetId: catalogPack.datasetId,
  datasetVersion: catalogPack.datasetVersion,
  cards: catalogPack.units['cards'] as never,
}, options);

const costModel = CostModelAdapter.open({
  datasetId: catalogPack.datasetId,
  datasetVersion: catalogPack.datasetVersion,
  feeTerms: catalogPack.units['fees'] as never,
  fxPairs: catalogPack.units['fx'] as never,
  conflicts: (catalogPack.conflicts ?? []) as never,
}, options);

const snapshot = JSON.parse(
  readFileSync(join(PACKS, 'fx-rates', 'snapshot.json'), 'utf8'),
) as BundledFxSnapshot;
const fx = new FxSnapshotSlice(snapshot);

const allCardRows = (catalogPack.units['cards'] ?? []) as readonly Readonly<Record<string, unknown>>[];
const shippedCardIds = allCardRows.map((row) => String(row['cardId']));
const currentCardIds = shippedCardIds.filter(
  (cardId) => cards.read(cardId)?.countsAsCurrentProduct === true,
);

function costOf(
  cardId: string,
  field: 'fxCommissionPct' | 'foreignAtmPct' | 'atmSameCurrencyFee',
): Readonly<Record<string, unknown>> | undefined {
  return cards.read(cardId)?.cost(field) as Readonly<Record<string, unknown>> | undefined;
}

function usableNumber(
  cardId: string,
  field: 'fxCommissionPct' | 'foreignAtmPct' | 'atmSameCurrencyFee',
): number | undefined {
  const value = costOf(cardId, field);
  if (value === undefined || !('value' in value)) return undefined;
  const verdict = (value['consumability'] as { readonly verdict?: string } | undefined)?.verdict;
  return verdict === 'USABLE' || verdict === 'USABLE_ESTIMATE'
    ? Number(value['value'])
    : undefined;
}

const WALLET_ORGS = [
  'org:mizrahi-tefahot',
  'org:hapoalim',
  'org:leumi',
  'org:yahav',
  'org:max',
  'org:cal',
] as const;

const wallet = WALLET_ORGS
  .map((orgId) => currentCardIds.find(
    (cardId) => cards.read(cardId)?.issuerOrgId === orgId
      && usableNumber(cardId, 'fxCommissionPct') !== undefined,
  ))
  .filter((cardId): cardId is string => cardId !== undefined);

function rateFor(currency: string): FxRate {
  const rate = fx.rate(currency);
  if (rate === undefined) throw new Error(`the shipped snapshot has no ${currency} rate`);
  return rate as FxRate;
}

function quotesFor(
  cardIds: readonly string[],
  field: 'fxCommissionPct' | 'foreignAtmPct',
): readonly CardFxQuote[] {
  return cardIds.map((cardId) => {
    const fxPercent = usableNumber(cardId, field);
    return { cardId, ...(fxPercent === undefined ? {} : { fxPercent }) };
  });
}

function foreignComparison(currency: string, amount: number, cardIds = wallet) {
  return compareAbroad({
    amount,
    currency,
    mode: 'purchase',
    cards: quotesFor(cardIds, 'fxCommissionPct'),
    rate: rateFor(currency),
  });
}

const norm = (value: string | undefined): string =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const benefitsByMerchant = new Map<string, string[]>();
let unresolvedMerchantNames = 0;
for (const benefit of ben.benefits.all()) {
  unresolvedMerchantNames += (benefit.eligibleMerchantsUnresolved ?? []).length;
  for (const merchantId of benefit.eligibleMerchantIds ?? []) {
    benefitsByMerchant.set(
      merchantId,
      [...(benefitsByMerchant.get(merchantId) ?? []), benefit.benefitId],
    );
  }
}

describe('P3 acceptance — 23 shipped-pack scenarios through real engines', () => {
  it.each([
    ['EUR', 500],
    ['USD', 500],
    ['JPY', 50_000],
  ] as const)('rank mixed wallet for %s through FX + scoring', (currency, amount) => {
    const comparison = foreignComparison(currency, amount);
    expect(wallet).toHaveLength(WALLET_ORGS.length);
    expect(comparison.unknownCards).toEqual([]);
    expect(comparison.ranked).toHaveLength(wallet.length);
    expect(comparison.ranked.every((entry) => entry.quote.provenance === 'ESTIMATE')).toBe(true);
    expect(comparison.ranked.every(
      (entry, index) => index === 0
        || entry.quote.effectiveIls >= comparison.ranked[index - 1]!.quote.effectiveIls,
    )).toBe(true);

    const scored = scoreCards({
      cards: comparison.ranked.map((entry) => ({
        cardId: entry.cardId,
        available: true,
        costIls: { value: entry.quote.effectiveIls, provenance: entry.quote.provenance },
      })),
      deltasSuppressed: comparison.deltasSuppressed,
    });
    expect(scored.ranked.map((entry) => entry.effectiveCostIls.value))
      .toEqual(comparison.ranked.map((entry) => entry.quote.effectiveIls).sort((left, right) => left - right));
    expect(comparison.ranked.every(
      (entry) => entry.quote.rateUsed.rateDate === snapshot.snapshotDate,
    )).toBe(true);
  });

  it('handles the JPY per-100 unit trap in the production conversion path', () => {
    const converted = convertToIls(
      { amount: 50_000, currency: 'JPY' },
      rateFor('JPY'),
    );
    const usdControl = convertToIls(
      { amount: 250, currency: 'USD' },
      rateFor('USD'),
    );

    expect(converted.rateUsed.quoteUnit).toBe(100);
    expect(converted.referenceIls).toBeCloseTo(934.85, 2);
    expect(converted.referenceIls).not.toBeCloseTo(93_485, 2);
    expect(usdControl.rateUsed.quoteUnit).toBe(1);
    expect(usdControl.referenceIls).toBeCloseTo(746.5, 2);
  });

  it('compares foreign-ATM rates across the wallet through the FX engine', () => {
    const comparison = compareAbroad({
      amount: 500,
      currency: 'USD',
      mode: 'atm',
      cards: quotesFor(wallet, 'foreignAtmPct'),
      rate: rateFor('USD'),
    });

    expect(comparison.unknownCards).toEqual([]);
    expect(comparison.ranked).toHaveLength(wallet.length);
    expect(comparison.ranked.every((entry) => entry.floor === undefined)).toBe(true);
  });

  it('exercises every shipped FX fallback-chain resolution', () => {
    const paths = new Map<string, number>();
    for (const cardId of shippedCardIds) {
      const resolution = String(costOf(cardId, 'fxCommissionPct')?.['resolution'] ?? '(none)');
      paths.set(resolution, (paths.get(resolution) ?? 0) + 1);
    }
    expect([...paths.keys()]).toEqual(expect.arrayContaining([
      'ISSUER_X_OPERATOR',
      'ISSUER_DEFAULT',
      'CARD_LEVEL_EXCEPTION',
      'OPERATOR_UNKNOWN_RANGE',
    ]));
    expect(new Set(cat.exceptions.all().map((entry) => entry.cardNameRaw)).size).toBeGreaterThan(0);
  });

  it('keeps a card-level exception ahead of the issuer pair rate', () => {
    const cardId = shippedCardIds.find(
      (id) => costOf(id, 'fxCommissionPct')?.['resolution'] === 'CARD_LEVEL_EXCEPTION',
    );
    expect(cardId).toBeDefined();
    const exception = costOf(cardId!, 'fxCommissionPct');
    const issuerOrgId = cards.read(cardId!)?.issuerOrgId;
    const pairLeg = issuerOrgId === undefined
      ? undefined
      : costModel.fxPair(issuerOrgId)?.legs.get('fxCommissionPct');
    const exceptionValue = exception !== undefined && 'value' in exception
      ? Number(exception['value'])
      : undefined;
    const pairValue = pairLeg !== undefined && 'value' in pairLeg
      ? Number((pairLeg as { readonly value: number }).value)
      : undefined;

    expect(exceptionValue).toBeDefined();
    expect(exceptionValue).not.toBe(pairValue);
  });

  it('renders OPERATOR_UNKNOWN_RANGE from a range and one resolving question', () => {
    const rangeCards = shippedCardIds.filter(
      (cardId) => costOf(cardId, 'fxCommissionPct')?.['resolution'] === 'OPERATOR_UNKNOWN_RANGE',
    );
    const ranges = rangeCards.map(
      (cardId) => costOf(cardId, 'fxCommissionPct')?.['publishedRange'],
    );
    const questions = rangeCards.map(
      (cardId) => costOf(cardId, 'fxCommissionPct')?.['resolutionNote'],
    );

    expect(rangeCards.length).toBeGreaterThan(0);
    expect(ranges.every((range) => Array.isArray(range) && range.length > 1)).toBe(true);
    expect(questions.every((question) => typeof question === 'string' && question.length > 0))
      .toBe(true);
    expect(new Set(questions).size).toBe(1);
    expect(rangeCards.every(
      (cardId) => !('value' in (costOf(cardId, 'fxCommissionPct') ?? {})),
    )).toBe(true);
  });

  it('carries BOI weekend gaps forward with the publication date as the label', () => {
    const probes = [
      ['2026-08-01', '2026-07-31', 1],
      ['2026-08-02', '2026-07-31', 2],
      ['2026-08-08', '2026-08-07', 1],
      ['2026-08-09', '2026-08-07', 2],
      ['2026-08-15', '2026-08-14', 1],
      ['2026-08-16', '2026-08-14', 2],
    ] as const;

    for (const currency of fx.currencies) {
      for (const [probeDate, expectedDate, expectedDays] of probes) {
        const resolved = fx.rateAsOf(currency, probeDate);
        expect(resolved?.rateDate).toBe(expectedDate);
        expect(resolved?.carriedForward).toBe(true);
        expect(resolved?.carriedForwardDays).toBe(expectedDays);
        expect(resolved?.rateDate).not.toBe(probeDate);
      }
      const publicationDay = fx.rateAsOf(currency, '2026-08-17');
      expect(publicationDay?.rateDate).toBe('2026-08-17');
      expect(publicationDay?.carriedForward).toBe(false);
    }
  });

  it('matches benefits by merchant through cross-pack ids', () => {
    const merchants = tax.merchants.all();
    const merchantIds = new Set(merchants.map((merchant) => merchant.merchantId));
    const linked = [...benefitsByMerchant.keys()];

    expect(linked.length).toBeGreaterThan(0);
    expect(linked.filter((merchantId) => !merchantIds.has(merchantId))).toEqual([]);
    expect(unresolvedMerchantNames).toBeGreaterThanOrEqual(0);
  });

  it('matches benefits by category through benefit-to-merchant edges', () => {
    const categoryKeys = new Set(tax.categories.all().map((category) => category.key));
    const merchants = new Map(
      tax.merchants.all().map((merchant) => [merchant.merchantId, merchant] as const),
    );
    const reached = new Set<string>();
    const outside = new Set<string>();
    for (const merchantId of benefitsByMerchant.keys()) {
      const category = merchants.get(merchantId)?.canonicalCategory;
      if (category === undefined) continue;
      if (categoryKeys.has(category)) reached.add(category);
      else outside.add(category);
    }

    expect(reached.size).toBeGreaterThan(0);
    expect([...outside]).toEqual([]);
  });

  it('keeps programme-scoped benefits unresolved when namespaces do not meet', () => {
    const programmeScoped = ben.benefits.all().filter(
      (benefit) => benefit.scope === 'PROGRAMME_WIDE',
    );
    expect(programmeScoped.length).toBeGreaterThan(0);
    expect(programmeScoped.every(
      (benefit) => benefit.programmeResolution === 'UNRESOLVED_NAMESPACE_DISJOINT',
    )).toBe(true);
    expect(programmeScoped.every((benefit) => benefit.cardIds.length === 0)).toBe(true);
  });

  it('filters expired benefits through the production validity kernel', () => {
    const asOf = '2026-08-22';
    const benefits = ben.benefits.all();
    const dated = benefits.filter(
      (benefit) => typeof benefit.validUntil === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(benefit.validUntil),
    );
    const openEnded = benefits.filter(
      (benefit) => benefit.validUntil === 'UNTIL_FURTHER_NOTICE',
    );
    const closed = dated.filter((benefit) => hasClosed(benefit.validUntil, asOf));

    expect(dated.length).toBeGreaterThan(0);
    expect(closed.length).toBeGreaterThan(0);
    expect(openEnded.length).toBeGreaterThan(0);
    expect(openEnded.every((benefit) => !hasClosed(benefit.validUntil, asOf))).toBe(true);
  });

  it('reaches all three stacking outcomes through the production kernel', () => {
    const rules = new Set(ben.benefits.all().map((benefit) => benefit.stacking.rule));
    expect([...rules].sort()).toEqual(['MUTUALLY_EXCLUSIVE', 'STACKS', 'UNKNOWN']);
    expect([
      resolveStackingPair('STACKS', 'STACKS'),
      resolveStackingPair('MUTUALLY_EXCLUSIVE', 'STACKS'),
      resolveStackingPair('UNKNOWN', 'STACKS'),
    ]).toEqual([
      'MAY_SUM',
      'MUST_NOT_SUM_EXPLICIT',
      'MUST_NOT_SUM_DEFAULT',
    ]);
  });

  it('requires every STACKS benefit to carry its evidence quote', () => {
    const evidence = new Map(
      ben.stacking.all().map((entry) => [entry.benefitId, entry] as const),
    );
    const claiming = ben.benefits.all().filter(
      (benefit) => benefit.stacking.rule === 'STACKS',
    );
    const unsafe = claiming.filter((benefit) => {
      const phrase = evidence.get(benefit.benefitId)?.evidencePhrase;
      return phrase === undefined || phrase.trim() === '';
    });

    expect(claiming.length).toBeGreaterThan(0);
    expect(unsafe).toEqual([]);
  });

  it('maps every observable provenance chip to the manifest vocabulary', () => {
    const chips = new Set<string>();
    const grades = new Set<string>();
    for (const cardId of shippedCardIds) {
      for (const field of [
        'fxCommissionPct',
        'foreignAtmPct',
        'atmSameCurrencyFee',
      ] as const) {
        const value = costOf(cardId, field);
        if (value !== undefined) chips.add(String(value['chip']));
      }
    }
    for (const benefit of ben.benefits.all()) {
      if (benefit.provenanceChip !== undefined) chips.add(benefit.provenanceChip);
      if (benefit.verificationStatus !== undefined) grades.add(benefit.verificationStatus);
    }
    for (const merchant of tax.merchants.all()) {
      if (merchant.provenanceChip !== undefined) chips.add(merchant.provenanceChip);
      if (merchant.verificationStatus !== undefined) grades.add(merchant.verificationStatus);
    }
    for (const interest of cat.interest.all()) chips.add(interest.provenance.chip);
    for (const edge of cat.edges.all()) chips.add(edge.provenance.chip);
    for (const term of con.glossary.all()) {
      if (term.verificationStatus !== undefined) grades.add(term.verificationStatus);
    }
    for (const right of con.rights.all()) {
      if (right.verificationStatus !== undefined) grades.add(right.verificationStatus);
    }

    const declared = new Set<string>([...PROVENANCE_STATES, 'CONFLICT']);
    expect(chips.size).toBeGreaterThan(0);
    expect(grades.size).toBeGreaterThan(0);
    expect([...chips].filter((chip) => !declared.has(chip))).toEqual([]);
  });

  it('preserves CUSTOMER_SPECIFIC and LOGIN_GATED display states', () => {
    const billing = cat.billing.all();
    const loginGated = billing.filter(
      (entry) => entry.selfServiceChannelStatus === 'LOGIN_GATED',
    );
    const customerSpecific = billing.filter(
      (entry) => String(entry.customerMayChoose ?? '').toUpperCase().startsWith('YES'),
    );

    expect(loginGated.length).toBeGreaterThan(0);
    expect(customerSpecific.length).toBeGreaterThan(0);
  });

  it('assembles all four Card DNA sections for representative cards', () => {
    const sample = [
      ...wallet.slice(0, 4),
      ...currentCardIds.filter(
        (cardId) => cards.read(cardId)?.issuerOrgId === 'org:fibi',
      ).slice(0, 1),
    ];
    const coverage = new Map(
      ben.coverage.all().map((entry) => [entry.cardId, entry] as const),
    );

    for (const cardId of sample) {
      const card = cards.read(cardId);
      const issuerOrgId = card?.issuerOrgId ?? '';
      const sections = {
        identity: Boolean(card?.nameHe ?? card?.nameEn) && issuerOrgId !== '',
        costs: usableNumber(cardId, 'fxCommissionPct') !== undefined
          || costModel.feeTermsFor(issuerOrgId).some((fee) => fee.field === 'CARD_FEE'),
        benefits: ben.benefits.all().some((benefit) => benefit.cardIds.includes(cardId))
          || coverage.has(cardId),
        terms: cat.billing.all().some((entry) => entry.orgId === issuerOrgId)
          || cat.interest.all().some((entry) => entry.orgId === issuerOrgId),
      };
      expect(sections).toEqual({ identity: true, costs: true, benefits: true, terms: true });
    }
    expect(sample.length).toBe(5);
  });

  it('looks up billing rules for every issuer', () => {
    const billing = cat.billing.all();
    expect(billing).toHaveLength(18);
    expect(new Set(billing.map((entry) => entry.orgId)).size).toBe(18);
    expect(billing.filter((entry) => (entry.allowedBillingDays ?? []).length > 0).length)
      .toBeGreaterThan(0);
  });

  it('matches merchants in Hebrew, English, and Arabic', () => {
    const index = {
      he: new Map<string, string>(),
      en: new Map<string, string>(),
      ar: new Map<string, string>(),
    };
    for (const merchant of tax.merchants.all()) {
      if (merchant.nameHe !== undefined) index.he.set(norm(merchant.nameHe), merchant.merchantId);
      if (merchant.nameEn !== undefined) index.en.set(norm(merchant.nameEn), merchant.merchantId);
      if (merchant.nameAr !== undefined) index.ar.set(norm(merchant.nameAr), merchant.merchantId);
      index.he.set(norm(merchant.canonicalName), merchant.merchantId);
      for (const alias of merchant.aliases) {
        if (!index.he.has(norm(alias))) index.he.set(norm(alias), merchant.merchantId);
      }
    }
    const probes = [
      ['שופרסל', 'he'],
      ['Shufersal', 'en'],
      ['شوفرسال', 'ar'],
      ['سوبير فارم', 'ar'],
      ['كارفور', 'ar'],
      ['رامي ليفي', 'ar'],
      ['רמי לוי', 'he'],
      ['Fox', 'en'],
      ['סופר פארם', 'he'],
    ] as const;
    const hits = probes.map(([query, language]) => {
      const table = index[language];
      return table.get(norm(query))
        ?? [...table.entries()].find(([key]) => key.includes(norm(query)))?.[1];
    });

    expect(hits.filter((hit) => hit !== undefined).length).toBeGreaterThanOrEqual(probes.length - 1);
    for (const language of ['he', 'en'] as const) {
      const positions = probes
        .map(([, probeLanguage], indexOfProbe) => probeLanguage === language ? indexOfProbe : -1)
        .filter((position) => position >= 0);
      expect(positions.every((position) => hits[position] !== undefined)).toBe(true);
    }
  });

  it('produces a real purchase verdict for 250 USD across the wallet', () => {
    const comparison = foreignComparison('USD', 250);
    const verdicts = comparison.ranked.map((entry) => evaluatePurchaseVerdict({
      purchaseAmountIls: {
        value: entry.quote.effectiveIls,
        provenance: entry.quote.provenance,
      },
      installmentCount: 1,
      monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
      commitments: [],
    }));

    expect(verdicts).toHaveLength(wallet.length);
    expect(verdicts.every((result) => result.verdict === 'good_to_go')).toBe(true);
    expect(verdicts.every(
      (result) => result.financialImpact.thresholdMath.projectedLoadRatio.provenance === 'ESTIMATE',
    )).toBe(true);
  });

  it('scores the full current-product universe through FX + scoring', () => {
    const comparison = foreignComparison('USD', 500, currentCardIds);
    const scored = scoreCards({
      cards: [
        ...comparison.ranked.map((entry) => ({
          cardId: entry.cardId,
          available: true,
          costIls: { value: entry.quote.effectiveIls, provenance: entry.quote.provenance },
        })),
        ...comparison.unknownCards.map((cardId) => ({ cardId, available: true })),
      ],
      deltasSuppressed: comparison.deltasSuppressed,
    });

    expect(currentCardIds).toHaveLength(cards.countCurrentProducts());
    expect(scored.ranked.length).toBeGreaterThan(0.9 * currentCardIds.length);
    expect([...scored.unknownCostCards].sort()).toEqual([...comparison.unknownCards].sort());
    expect(scored.ranked.map((entry) => entry.cardId))
      .toEqual(comparison.ranked.map((entry) => entry.cardId));
  });

  it('keeps issuer interest bands display-only and out of load calculations', () => {
    const rows = cat.interest.all();
    const withBand = rows.filter((entry) => entry.observedBand?.p25Pct !== undefined);
    const notPublished = rows.filter((entry) => entry.observedBand?.p25Pct === undefined);

    expect(rows.length).toBeGreaterThan(0);
    expect(withBand.length).toBeGreaterThan(0);
    expect(notPublished.length).toBeGreaterThan(0);
    expect(rows.every((entry) => entry.calculationSafe === false)).toBe(true);
  });
});
