/**
 * THE BENEFIT ELIGIBILITY LAYER — one answer to "does this benefit reach this wallet?".
 *
 * The campaign addendum requires Merchant Radar and the Benefits Hub to share this rather than
 * grow two matchers that diverge, and the reason is not tidiness: two matchers would eventually
 * disagree about whether a user has a benefit, and the app would say both things on two screens.
 * So every question about eligibility — for a wallet, for a merchant, for one card, for a family —
 * is a filter over the ONE derivation below.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE EDGE IS EVIDENCE AND EVERYTHING ELSE IS NOT
 *
 * `AdapterBenefit.cardIds` is the estate's own statement that a benefit is evidenced for a card
 * product. 298 of 700 benefits carry one, 461 references in total, and every one of them resolves
 * to a real catalog row. That is the join, and it is exact.
 *
 * THE PROGRAMME PATH IS DELIBERATELY NOT JOINED. Every programme-scoped benefit carries
 * `programmeResolution: UNRESOLVED_NAMESPACE_DISJOINT` — the estate saying, in its own field, that
 * its benefit namespace and its programme namespace do not meet. Constructing that join would be
 * inventing a relationship the pipeline explicitly refused to construct, and the catalog's own
 * note records what it costs: *"v1 filled sections like this one by fanning benefits out across
 * programme edges, and a blind audit found 53% of the resulting links defective."* So a
 * programme-scoped benefit is reported as programme-dependent and never as held.
 *
 * ISSUER_WIDE AND CARD_FAMILY ARE NOT JOINED EITHER, for the same reason: neither names a product,
 * and "your issuer publishes this" is not "your card has this".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * VALIDITY IS READ, NEVER INVENTED
 *
 * 34 of 700 benefits carry a `validUntil` and 46 a `validFrom`. An absent date is `UNKNOWN`
 * validity, not an open-ended offer, and a `RETIRED` lifecycle is expired regardless of dates. An
 * expired benefit never appears as available — which is the one validity rule that can cost a user
 * a wasted trip.
 */
import {
  openBenefitsSlices,
  type AdapterBenefit,
  type PackDocument,
} from '@smartcard/data-authority-adapter';

import benefitsPackJson from './packs/benefits/pack.json';

import { projectBenefit, type BenefitConsumerView } from './consumerProjection';

import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';

/**
 * The reader-facing benefit. NOT `AdapterBenefit`, and the difference is the whole point:
 * the raw row carries `description`, an English-only research annotation that the Benefits Hub
 * rendered underneath Hebrew titles until the unified upgrade removed it. See consumerProjection.ts.
 */
export type BenefitView = BenefitConsumerView;

const benefitsPack = benefitsPackJson as PackDocument;

let benefitsMemo: readonly BenefitView[] | null = null;
let byCardMemo: ReadonlyMap<string, readonly BenefitView[]> | null = null;

function readAllBenefits(): readonly BenefitView[] {
  if (benefitsMemo === null) {
    assertPinnedAdapter();
    benefitsMemo = openBenefitsSlices(benefitsPack, {
      expectedDatasetId: EXPECTED_DATASET_ID,
    })
      .benefits.all()
      .map(projectBenefit);
  }
  return benefitsMemo;
}

/**
 * cardProductId → benefits, built once.
 *
 * §21 of the addendum: the corpus is large and a Hub that re-scanned 700 rows on every render
 * would be a Hub that stutters. One index, built on first ask, and every query is a map lookup
 * plus a filter over a short list.
 */
function benefitsByCard(): ReadonlyMap<string, readonly BenefitView[]> {
  if (byCardMemo === null) {
    const index = new Map<string, BenefitView[]>();
    for (const benefit of readAllBenefits()) {
      for (const cardId of benefit.cardIds) {
        const list = index.get(cardId) ?? [];
        list.push(benefit);
        index.set(cardId, list);
      }
    }
    byCardMemo = index;
  }
  return byCardMemo;
}

/** Every benefit the shipped pack holds. The Hub never shows this list — it shows a filter of it. */
export function allBenefits(): readonly BenefitView[] {
  return readAllBenefits();
}

// ── Validity ──────────────────────────────────────────────────────────────────────────────────

export type BenefitValidity = 'ACTIVE' | 'UPCOMING' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';

/** Days before `validUntil` at which the Hub starts calling a benefit expiring. */
export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
  const time = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Number.isFinite(time) ? time : undefined;
}

/**
 * The benefit's validity against a supplied clock.
 *
 * `todayIso` IS A PARAMETER AND NOT `new Date()`. A validity that reads the clock itself can only
 * be tested on the day the test runs, which is the same defect `WaiverBadge` was written to avoid
 * and the reason criterion C10's declared control is "pin the staleness clock to now".
 */
export function benefitValidity(benefit: BenefitView, todayIso: string): BenefitValidity {
  if (benefit.lifecycleStatus === 'RETIRED') return 'EXPIRED';
  const today = isoDay(todayIso);
  const from = isoDay(benefit.validFrom);
  const until = isoDay(benefit.validUntil);
  if (today === undefined) return 'UNKNOWN';
  if (until !== undefined && until < today) return 'EXPIRED';
  if (from !== undefined && from > today) return 'UPCOMING';
  if (until !== undefined && until - today <= EXPIRING_SOON_DAYS * DAY_MS) return 'EXPIRING_SOON';
  if (from === undefined && until === undefined) {
    /* No dates at all. `CURRENT` is the estate stating the benefit is live; anything else is an
       absence, and an absence of a date is not an open-ended offer. */
    return benefit.lifecycleStatus === 'CURRENT' ? 'ACTIVE' : 'UNKNOWN';
  }
  return 'ACTIVE';
}

/** True for the validity states a consumer may act on today. `UNKNOWN` is included and flagged. */
export function isCurrentlyShowable(validity: BenefitValidity): boolean {
  return validity !== 'EXPIRED' && validity !== 'UPCOMING';
}

// ── Consumer families ─────────────────────────────────────────────────────────────────────────

/**
 * CONSUMER-FACING FAMILIES, DECLARED AS A MAPPING OF THE ESTATE'S OWN `benefitType` VOCABULARY.
 *
 * The estate publishes over a hundred `benefitType` spellings, in three cases and two languages of
 * naming convention, and it publishes no consumer category. This table is a PRESENTATION grouping
 * of those spellings and nothing else: it changes no eligibility, creates no benefit, and every
 * spelling it does not recognise falls to `other` rather than to a flattering guess.
 *
 * It is deliberately NOT the Owner's example list (restaurants · cinema · 1+1 · fuel · flights).
 * Those are MERCHANT categories, and the estate links a benefit to a merchant on six rows out of
 * seven hundred — so a "restaurants" filter built from benefits would be empty and would read as
 * "you have no restaurant benefits" when the truth is that the corpus records none. The merchant
 * categories the estate DOES model are reachable through the merchant lane instead.
 */
export type BenefitFamily =
  | 'cashback'
  | 'points'
  | 'travel'
  | 'lounge'
  | 'insurance'
  | 'fees'
  | 'foreign-currency'
  | 'merchant'
  | 'credit'
  | 'other';

const FAMILY_PATTERNS: readonly (readonly [BenefitFamily, RegExp])[] = [
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

/** The family a benefit belongs to, from its estate `benefitType`. Unrecognised falls to `other`. */
export function benefitFamily(benefit: BenefitView): BenefitFamily {
  const type = benefit.benefitType ?? '';
  for (const [family, pattern] of FAMILY_PATTERNS) {
    if (pattern.test(type)) return family;
  }
  return 'other';
}

// ── Eligibility queries ───────────────────────────────────────────────────────────────────────

/** Why a benefit is in this wallet's list. The user is shown the difference. */
export type EligibilityBasis =
  /** The estate names this exact card product on the benefit. The only exact lane. */
  | 'CARD_PINNED'
  /** The benefit is programme-scoped and the estate could not resolve the programme namespace. */
  | 'PROGRAMME_DEPENDENT';

export interface EligibleBenefit {
  readonly benefit: BenefitView;
  readonly basis: EligibilityBasis;
  /** The user's own card ids (vault ids, not product ids) that reach this benefit. */
  readonly viaUserCardIds: readonly string[];
  /** The canonical product ids that reach it. */
  readonly viaProductIds: readonly string[];
  readonly validity: BenefitValidity;
  readonly family: BenefitFamily;
}

/** One held card, as this layer needs it: a vault id and the canonical product it resolves to. */
export interface HeldCard {
  readonly cardId: string;
  readonly cardProductId: string;
}

/**
 * Every benefit evidenced for the cards this wallet holds.
 *
 * GROUPED BY BENEFIT, NOT BY CARD. The addendum requires that one offer reachable through two
 * cards appears once, naming both — a list that repeated it would make a wallet look richer than
 * it is by counting the same offer twice.
 */
export function eligibleBenefitsForCards(
  held: readonly HeldCard[],
  todayIso: string,
): readonly EligibleBenefit[] {
  const index = benefitsByCard();
  const byBenefit = new Map<string, { user: Set<string>; product: Set<string>; benefit: BenefitView }>();

  for (const card of held) {
    for (const benefit of index.get(card.cardProductId) ?? []) {
      const entry = byBenefit.get(benefit.benefitId)
        ?? { user: new Set<string>(), product: new Set<string>(), benefit };
      entry.user.add(card.cardId);
      entry.product.add(card.cardProductId);
      byBenefit.set(benefit.benefitId, entry);
    }
  }

  return [...byBenefit.values()].map((entry): EligibleBenefit => ({
    benefit: entry.benefit,
    basis: 'CARD_PINNED',
    viaUserCardIds: [...entry.user].sort(),
    viaProductIds: [...entry.product].sort(),
    validity: benefitValidity(entry.benefit, todayIso),
    family: benefitFamily(entry.benefit),
  }));
}

/** The benefits evidenced for exactly one canonical product. */
export function benefitsForProduct(
  cardProductId: string,
  todayIso: string,
): readonly EligibleBenefit[] {
  return (benefitsByCard().get(cardProductId) ?? []).map((benefit): EligibleBenefit => ({
    benefit,
    basis: 'CARD_PINNED',
    viaUserCardIds: [],
    viaProductIds: [cardProductId],
    validity: benefitValidity(benefit, todayIso),
    family: benefitFamily(benefit),
  }));
}

/**
 * The benefits evidenced for BOTH a merchant and this wallet — Merchant Radar's question.
 *
 * The same derivation the Hub uses, narrowed by the merchant edge, so the two surfaces cannot
 * disagree about whether the user has a benefit at a shop.
 */
export function eligibleBenefitsForMerchant(
  merchantId: string,
  held: readonly HeldCard[],
  todayIso: string,
): readonly EligibleBenefit[] {
  return eligibleBenefitsForCards(held, todayIso).filter((row) =>
    (row.benefit.eligibleMerchantIds ?? []).includes(merchantId),
  );
}

/** The wallet's benefits in one consumer family. */
export function eligibleBenefitsForFamily(
  family: BenefitFamily,
  held: readonly HeldCard[],
  todayIso: string,
): readonly EligibleBenefit[] {
  return eligibleBenefitsForCards(held, todayIso).filter((row) => row.family === family);
}

/**
 * Programme-scoped benefits the estate could not resolve to a product.
 *
 * Returned separately and never mixed into the held list. A surface may say "this may require
 * confirming your club membership"; it may not say the user has it.
 */
export function programmeDependentBenefitsFor(orgIds: readonly string[]): readonly BenefitView[] {
  const orgs = new Set(orgIds);
  return readAllBenefits().filter(
    (benefit) =>
      benefit.cardIds.length === 0
      && benefit.scope === 'PROGRAMME_WIDE'
      && benefit.orgId !== undefined
      && orgs.has(benefit.orgId),
  );
}

/** The benefit's own published title in the reader's language. Never re-worded. */
export function benefitTitle(benefit: BenefitView, language: 'he' | 'ar' | 'en'): string {
  if (language === 'ar') return benefit.titleAr ?? benefit.titleEn ?? benefit.titleHe ?? benefit.benefitId;
  if (language === 'en') return benefit.titleEn ?? benefit.titleHe ?? benefit.benefitId;
  return benefit.titleHe ?? benefit.titleEn ?? benefit.benefitId;
}

/** Distinct canonical product ids the corpus evidences any benefit for. Used by the coverage report. */
export function productsWithEvidencedBenefits(): readonly string[] {
  return [...benefitsByCard().keys()].sort();
}
