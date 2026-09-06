/**
 * THE BENEFITS HUB'S DERIVATION — one screen's worth of answers, composed outside the screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM IT SOLVES IS BENEFIT BLINDNESS, AND THE HONEST VERSION IS SMALLER THAN THE IDEAL
 *
 * The addendum's objective is that a person can open one screen and know what their cards give
 * them, without opening each card. That is buildable: 298 of the corpus's 700 benefits are pinned
 * to a specific card product, across 64 distinct products, and every one of those references
 * resolves to a real catalog row.
 *
 * What is NOT buildable from this corpus is the consumer-sector view the directive sketches —
 * restaurants, cinema, 1+1, fuel, flights. Those are merchant categories, and a benefit is linked
 * to a merchant on SIX rows out of seven hundred. A "restaurants" filter would be empty, and an
 * empty filter reads as *"you have no restaurant benefits"* when the truth is that nobody recorded
 * any. So the Hub filters on what the estate models — the benefit's own type family, its validity,
 * and which of the user's cards provides it — and the merchant lane stays where the merchant
 * evidence is, in Merchant Radar.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE OFFER, ONE ROW — even when two cards reach it
 *
 * The addendum: *"do not blindly duplicate the offer… one benefit entry, 'Available with 2 of your
 * cards'."* The eligibility layer already groups by benefit id and returns the reaching cards, so
 * this file inherits that and never re-groups. Two benefits with DIFFERENT ids stay separate even
 * when they read alike, because the estate published them as two facts and merging them would be
 * this file deciding they are one.
 *
 * THIS FILE FILTERS AND COUNTS. It does not decide eligibility, does not read a pack, and does not
 * re-word a benefit: titles come back exactly as the estate published them.
 */
import {
  benefitFamily,
  eligibleBenefitsForCards,
  isCurrentlyShowable,
  type BenefitFamily,
  type EligibleBenefit,
  type HeldCard,
} from '../../authority/benefitAuthority';
import {
  merchantById,
  merchantName,
  normalizeMerchantText,
  type MerchantNameLanguage,
} from '../../authority/merchantAuthority';

/** `all` is not a family — it is the absence of a family filter, and it is spelled out so. */
export type BenefitFilter = 'all' | BenefitFamily;

export interface BenefitsHubInput {
  readonly held: readonly HeldCard[];
  readonly todayIso: string;
  readonly filter: BenefitFilter;
  /** Free text over benefit titles, descriptions and the merchants a benefit names. */
  readonly query: string;
  /** A single vault card id, when the Hub was opened from one card. */
  readonly onlyUserCardId?: string;
  readonly language: MerchantNameLanguage;
}

export interface BenefitsHubSummary {
  /** Benefits reaching this wallet that are neither expired nor not-yet-started. */
  readonly showableCount: number;
  /** Distinct vault cards contributing at least one showable benefit. */
  readonly contributingCardCount: number;
  /** Showable benefits whose published end date is inside the expiring window. */
  readonly expiringSoonCount: number;
  /** Benefits reaching the wallet that have already ended. Counted, never listed as available. */
  readonly expiredCount: number;
}

/** Which filters have something behind them, so an empty filter is never offered. */
export interface BenefitFilterOption {
  readonly filter: BenefitFilter;
  readonly count: number;
}

export interface BenefitsHubReading {
  readonly summary: BenefitsHubSummary;
  /** The rows the current filter and query select, newest evidence first is NOT imposed. */
  readonly rows: readonly EligibleBenefit[];
  readonly filters: readonly BenefitFilterOption[];
  /** Which kind of nothing an empty `rows` is. Absent when `rows` is non-empty. */
  readonly emptiness?: 'NO_CARDS' | 'NO_EVIDENCED_BENEFITS' | 'FILTER_EMPTY';
}

/** Text a benefit can be searched by: its own titles, its description, and its merchants' names. */
function haystack(row: EligibleBenefit, language: MerchantNameLanguage): string {
  const merchantNames = (row.benefit.eligibleMerchantIds ?? [])
    .map(merchantById)
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .flatMap((m) => [merchantName(m, language), ...m.aliases]);
  return [
    row.benefit.titleHe,
    row.benefit.titleEn,
    row.benefit.titleAr,
    row.benefit.description,
    ...merchantNames,
  ]
    .filter((part): part is string => typeof part === 'string')
    .map(normalizeMerchantText)
    .join('\n');
}

export function benefitsHubReading(input: BenefitsHubInput): BenefitsHubReading {
  if (input.held.length === 0) {
    return {
      summary: {
        showableCount: 0,
        contributingCardCount: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
      },
      rows: [],
      filters: [],
      emptiness: 'NO_CARDS',
    };
  }

  const all = eligibleBenefitsForCards(input.held, input.todayIso);
  const scoped = input.onlyUserCardId === undefined
    ? all
    : all.filter((row) => row.viaUserCardIds.includes(input.onlyUserCardId as string));

  const showable = scoped.filter((row) => isCurrentlyShowable(row.validity));
  const contributingCards = new Set(showable.flatMap((row) => row.viaUserCardIds));

  const summary: BenefitsHubSummary = {
    showableCount: showable.length,
    contributingCardCount: contributingCards.size,
    expiringSoonCount: showable.filter((row) => row.validity === 'EXPIRING_SOON').length,
    expiredCount: scoped.filter((row) => row.validity === 'EXPIRED').length,
  };

  /* ONLY NON-EMPTY FILTERS ARE OFFERED. A chip that always returns nothing teaches a user the app
     has nothing, which is a different claim from the one the corpus supports. */
  const counts = new Map<BenefitFamily, number>();
  for (const row of showable) {
    counts.set(row.family, (counts.get(row.family) ?? 0) + 1);
  }
  const filters: BenefitFilterOption[] = [
    { filter: 'all', count: showable.length },
    ...[...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))
      .map(([family, count]): BenefitFilterOption => ({ filter: family, count })),
  ];

  const needle = normalizeMerchantText(input.query);
  const rows = showable
    .filter((row) => input.filter === 'all' || benefitFamily(row.benefit) === input.filter)
    .filter((row) => needle === '' || haystack(row, input.language).includes(needle));

  if (rows.length > 0) return { summary, rows, filters };

  return {
    summary,
    rows,
    filters,
    emptiness: showable.length === 0 ? 'NO_EVIDENCED_BENEFITS' : 'FILTER_EMPTY',
  };
}
