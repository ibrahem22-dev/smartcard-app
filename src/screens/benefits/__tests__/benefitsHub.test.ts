/**
 * THE BENEFITS HUB'S DERIVATION, over the real shipped corpus.
 *
 * The fixture is a WALLET, not a benefit list: the benefits come from the pack, joined to whatever
 * canonical products the test says the user holds. That is the only way these cases can fail when
 * a pack publication changes the corpus, which is the point of measuring against real data.
 */
import {
  eligibleBenefitsForCards,
  benefitValidity,
  benefitFamily,
  allBenefits,
  productsWithEvidencedBenefits,
  type HeldCard,
} from '../../../authority/benefitAuthority';
import { benefitsHubReading } from '../benefitsHub';

const TODAY = '2026-09-06';

/** A product the corpus evidences many benefits for. Chosen from the pack, not invented. */
const RICH_PRODUCT = 'card:max:skymax';
const held = (...products: readonly string[]): readonly HeldCard[] =>
  products.map((cardProductId, index) => ({ cardId: 'vault-' + String(index), cardProductId }));

describe('benefits hub', () => {
  it('shows nothing and says why when the wallet is empty', () => {
    const reading = benefitsHubReading({
      held: [], todayIso: TODAY, filter: 'all', query: '', language: 'he',
    });
    expect(reading.emptiness).toBe('NO_CARDS');
    expect(reading.rows).toEqual([]);
    expect(reading.summary.showableCount).toBe(0);
    expect(reading.filters).toEqual([]);
  });

  it('shows a wallet’s evidenced benefits for one card', () => {
    const reading = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: 'all', query: '', language: 'he',
    });
    expect(reading.emptiness).toBeUndefined();
    expect(reading.rows.length).toBeGreaterThan(5);
    expect(reading.summary.contributingCardCount).toBe(1);
    for (const row of reading.rows) {
      expect(row.basis).toBe('CARD_PINNED');
      expect(row.viaProductIds).toContain(RICH_PRODUCT);
    }
  });

  it('says the corpus is silent — not that the card has nothing — when nothing is evidenced', () => {
    const reading = benefitsHubReading({
      held: held('card:leumi:leumi-united-airlines-credit-card'),
      todayIso: TODAY, filter: 'all', query: '', language: 'he',
    });
    expect(reading.emptiness).toBe('NO_EVIDENCED_BENEFITS');
    expect(reading.summary.showableCount).toBe(0);
  });

  it('offers only filters that have something behind them', () => {
    const reading = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: 'all', query: '', language: 'he',
    });
    expect(reading.filters[0]?.filter).toBe('all');
    for (const option of reading.filters) {
      expect(option.count).toBeGreaterThan(0);
    }
    /* The counts of the family filters add up to the ALL count — one benefit, one family. */
    const families = reading.filters.filter((f) => f.filter !== 'all');
    expect(families.reduce((n, f) => n + f.count, 0)).toBe(reading.summary.showableCount);
  });

  it('filters by family and reports FILTER_EMPTY rather than NO_EVIDENCED_BENEFITS', () => {
    const all = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: 'all', query: '', language: 'he',
    });
    const family = all.filters.find((f) => f.filter !== 'all')?.filter;
    if (family === undefined) throw new Error('the corpus gave this wallet no family to filter on');

    const filtered = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: family, query: '', language: 'he',
    });
    expect(filtered.rows.length).toBeGreaterThan(0);
    for (const row of filtered.rows) expect(row.family).toBe(family);

    const empty = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: 'all', query: 'זהו טקסט שאין לו התאמה', language: 'he',
    });
    expect(empty.rows).toEqual([]);
    expect(empty.emptiness).toBe('FILTER_EMPTY');
  });

  it('searches the benefit’s own published title', () => {
    const all = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: 'all', query: '', language: 'en',
    });
    const first = all.rows[0];
    if (first === undefined) throw new Error('no rows to search');
    const word = (first.benefit.titleEn ?? first.benefit.titleHe ?? '').split(' ')[0] ?? '';
    if (word.length < 3) return;
    const found = benefitsHubReading({
      held: held(RICH_PRODUCT), todayIso: TODAY, filter: 'all', query: word, language: 'en',
    });
    expect(found.rows.length).toBeGreaterThan(0);
  });

  it('shows one row for an offer two cards reach, naming both', () => {
    /* The eligibility layer groups by benefit id; two vault cards on the SAME product reach the
       same benefits, and the Hub must not print each offer twice. */
    const two: readonly HeldCard[] = [
      { cardId: 'vault-a', cardProductId: RICH_PRODUCT },
      { cardId: 'vault-b', cardProductId: RICH_PRODUCT },
    ];
    const reading = benefitsHubReading({
      held: two, todayIso: TODAY, filter: 'all', query: '', language: 'he',
    });
    const ids = reading.rows.map((r) => r.benefit.benefitId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of reading.rows) {
      expect([...row.viaUserCardIds].sort()).toEqual(['vault-a', 'vault-b']);
    }
    expect(reading.summary.contributingCardCount).toBe(2);
  });

  it('scopes to one card when opened from a card', () => {
    const two: readonly HeldCard[] = [
      { cardId: 'vault-a', cardProductId: RICH_PRODUCT },
      { cardId: 'vault-b', cardProductId: 'card:leumi:leumi-united-airlines-credit-card' },
    ];
    const scoped = benefitsHubReading({
      held: two, todayIso: TODAY, filter: 'all', query: '', language: 'he', onlyUserCardId: 'vault-b',
    });
    expect(scoped.summary.showableCount).toBe(0);
    const other = benefitsHubReading({
      held: two, todayIso: TODAY, filter: 'all', query: '', language: 'he', onlyUserCardId: 'vault-a',
    });
    expect(other.summary.showableCount).toBeGreaterThan(0);
  });

  it('never lists an expired benefit as available', () => {
    const reading = benefitsHubReading({
      held: held(...productsWithEvidencedBenefits().slice(0, 12)),
      todayIso: '2030-01-01', filter: 'all', query: '', language: 'he',
    });
    for (const row of reading.rows) expect(row.validity).not.toBe('EXPIRED');
  });
});

describe('benefit validity', () => {
  const anyBenefit = () => {
    const found = allBenefits()[0];
    if (found === undefined) throw new Error('the shipped pack holds no benefit');
    return found;
  };

  it('reads a RETIRED lifecycle as expired whatever the dates say', () => {
    const retired = allBenefits().find((b) => b.lifecycleStatus === 'RETIRED');
    if (retired === undefined) throw new Error('the corpus holds no retired benefit');
    expect(benefitValidity(retired, '1990-01-01')).toBe('EXPIRED');
  });

  it('reads a past validUntil as expired and a future validFrom as upcoming', () => {
    const dated = allBenefits().find((b) => b.validUntil !== undefined && b.lifecycleStatus !== 'RETIRED');
    if (dated === undefined) throw new Error('the corpus holds no dated benefit');
    expect(benefitValidity(dated, '2099-01-01')).toBe('EXPIRED');

    const future = allBenefits().find((b) => b.validFrom !== undefined && b.lifecycleStatus !== 'RETIRED');
    if (future === undefined) throw new Error('the corpus holds no benefit with a start date');
    expect(benefitValidity(future, '1990-01-01')).toBe('UPCOMING');
  });

  it('reads no dates at all as UNKNOWN rather than as an open-ended offer', () => {
    const undated = allBenefits().find(
      (b) => b.validFrom === undefined && b.validUntil === undefined && b.lifecycleStatus === 'UNKNOWN',
    );
    if (undated === undefined) throw new Error('the corpus holds no undated benefit');
    expect(benefitValidity(undated, TODAY)).toBe('UNKNOWN');
  });

  it('puts every benefit in exactly one family, with an explicit other', () => {
    const families = new Set(allBenefits().map(benefitFamily));
    expect(families.size).toBeGreaterThan(1);
    expect(families.has('other')).toBe(true);
    expect(benefitFamily(anyBenefit())).toBeDefined();
  });

  it('never returns a programme-scoped benefit as one this wallet holds', () => {
    const rows = eligibleBenefitsForCards(held(RICH_PRODUCT), TODAY);
    for (const row of rows) {
      expect(row.benefit.cardIds.length).toBeGreaterThan(0);
      expect(row.basis).toBe('CARD_PINNED');
    }
  });
});
