/**
 * THE CARD FEE PROFILE — what a canonical product actually costs, and what the estate cannot say.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE OBSERVATION THIS MODULE ANSWERS
 *
 * The campaign directive records the Owner's observation that the app *"appears not to genuinely
 * bind card fee/commission details to the selected card"*, and instructs that it be audited rather
 * than assumed. It was audited, and it was correct in one direction and wrong in another:
 *
 *   · WRONG about the data. Every one of the 378 current products carries a `costs` block, and
 *     `fxCommissionPct` and `foreignAtmPct` carry a VERIFIED, USABLE value on ALL 378 — resolved
 *     per card, with the estate's own `resolution` recording HOW (`ISSUER_X_OPERATOR`,
 *     `CARD_LEVEL_EXCEPTION`, `ISSUER_DEFAULT`, …). The card-level exceptions are already applied
 *     in those figures, which is why this module must NOT re-apply them.
 *
 *   · RIGHT about the app. `writeWizardCard` stored `foreignTransactionFee` from what the USER
 *     typed and `annualFee: 0`, `cashbackRate: 0` as literals — so a card picked from the catalog
 *     reached Card DNA carrying the user's guess and a zero, while a verified figure sat in the
 *     pack the device already had.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CARD FEE IS THE HARD ONE, AND THE HONEST ANSWER IS USUALLY A SET
 *
 * `fees` rows are scoped `ALL_CARDS_OF_OPERATOR_AT_ISSUER`, and inside one issuer×operator scope
 * the estate still publishes SEVERAL rows with different `cardLevels` and different values —
 * Amex-IL alone lists Blue ₪15.90, Credit ₪16.90, Green/Classic/Business ₪18.90, Gold ₪22.90,
 * Gold+ ₪24.90, Platinum $32.90. **No field on a card row names its level.** So for most products
 * the estate supports "one of these six", not "this one".
 *
 * Picking one would be modelling identity from display text, which the directive forbids in as
 * many words, and the failure mode is not academic: it would tell somebody their fee is ₪15.90
 * when the issuer charges them ₪32.90. So a multi-candidate reading is returned AS a set, with
 * every level label and every source, and the surface renders it through the same
 * `ConflictedValue` component criterion C3 already requires for competing readings.
 *
 * `NOT_AVAILABLE` is never a zero. A card whose fee the estate does not publish shows that it does
 * not publish it.
 */
import {
  catalogFeeRows,
  catalogInterestRows,
  catalogProductById,
  catalogWaiverRows,
  type CatalogProduct,
} from './cardCatalog';
import { catalogCardRows } from './catalogSearch';

/** The four evidence states the directive names. Nothing collapses into a value of zero. */
export type FeeEvidenceState = 'VERIFIED' | 'CONDITIONAL' | 'NOT_AVAILABLE' | 'NOT_APPLICABLE';

/** Why a reading is not a single verified figure. Each is a different sentence to a user. */
export type FeeAbsenceReason =
  /** The estate publishes no row for this card's issuer-and-operator scope. */
  | 'NO_PUBLISHED_ROW'
  /** Rows exist and differ by a card LEVEL the estate models on no field of the card. */
  | 'LEVEL_NOT_MODELLED'
  /** A row exists and carries no value — an evidenced absence, not a missing lookup. */
  | 'NO_VALUE_PUBLISHED'
  /** The estate itself records competing readings and does not arbitrate them. */
  | 'CONFLICTED';

/** One published figure, with everything needed to show where it came from. */
export interface FeeCandidate {
  readonly value: number;
  readonly unit: string;
  readonly frequency?: string;
  /** The tariff's own level labels for this row. Display text — never used as a join key. */
  readonly levels: readonly string[];
  readonly labelHe?: string;
  readonly labelEn?: string;
  readonly labelAr?: string;
  readonly chip: string;
  readonly asOfDate?: string;
  readonly sourceLabel?: string;
  readonly registryId?: string;
  /** How the estate resolved this figure to this card, where it says. */
  readonly resolution?: string;
  readonly conditions: readonly string[];
  readonly exemptions: readonly string[];
  readonly discounts: readonly string[];
  readonly notes: readonly string[];
  readonly consumabilityVerdict?: string;
}

export interface FeeReading {
  /** The estate's own field name, e.g. `CARD_FEE`. Never shown raw to a consumer. */
  readonly field: string;
  readonly state: FeeEvidenceState;
  /** Present only when exactly one candidate survives — the VERIFIED lane. */
  readonly single?: FeeCandidate;
  /** Every candidate in scope, in the pack's order. Empty when there is no row at all. */
  readonly candidates: readonly FeeCandidate[];
  readonly reason?: FeeAbsenceReason;
}

/** A waiver rule as the estate published it — quoted, never evaluated here. */
export interface WaiverReading {
  readonly ruleId: string;
  readonly appliesToFee: string;
  readonly ruleType: string;
  readonly scopeText?: string;
  /** The tariff clause, verbatim. `quoteProvenance` says how literal it is. */
  readonly quote?: string;
  readonly baseCardFeeIls?: number;
  readonly resultingFeeIls?: number;
  /** Present when the estate itself says the clause cannot be reduced to a machine rule. */
  readonly notMachineUsableBecause?: string;
  readonly calculationSafe: boolean;
}

export interface CardFeeProfile {
  readonly cardId: string;
  readonly issuerOrgId: string;
  readonly operatingCardCompanyId?: string;
  /** Monthly/annual card fee. Usually `CONDITIONAL` with a level set — see the header. */
  readonly cardFee: FeeReading;
  /** Per-card and VERIFIED on every current product. The estate resolved it card by card. */
  readonly fxCommissionPct: FeeReading;
  /** Per-card and VERIFIED on every current product. */
  readonly foreignAtmPct: FeeReading;
  /** Per-card; a value on a minority of products, an evidenced absence on the rest. */
  readonly atmSameCurrencyFee: FeeReading;
  readonly cashAdvanceFee: FeeReading;
  readonly replacementFee: FeeReading;
  /** Card-fee waiver rules published for this card's issuer. Quoted, never evaluated. */
  readonly waivers: readonly WaiverReading[];
}

type Row = Readonly<Record<string, unknown>>;

const text = (row: Row | undefined, key: string): string | undefined => {
  const value = row?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

const strings = (row: Row, key: string): readonly string[] => {
  const value = row[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
};

const record = (value: unknown): Row | undefined =>
  typeof value === 'object' && value !== null ? (value as Row) : undefined;

const numberOf = (row: Row | undefined, key: string): number | undefined => {
  const value = row?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const verdictOf = (row: Row | undefined): string | undefined =>
  text(record(row?.['consumability']), 'verdict');

/** A `{value, unit, chip, …}` provenanced amount as the projection ships it. */
function candidateFromAmount(
  amount: Row,
  extras: {
    readonly levels?: readonly string[];
    readonly frequency?: string;
    readonly labelHe?: string;
    readonly labelEn?: string;
    readonly labelAr?: string;
    readonly conditions?: readonly string[];
    readonly exemptions?: readonly string[];
    readonly discounts?: readonly string[];
    readonly notes?: readonly string[];
  } = {},
): FeeCandidate | null {
  const value = numberOf(amount, 'value');
  if (value === undefined) return null;
  return {
    value,
    unit: text(amount, 'unit') ?? 'ILS',
    chip: text(amount, 'chip') ?? 'UNKNOWN',
    levels: extras.levels ?? [],
    conditions: extras.conditions ?? [],
    exemptions: extras.exemptions ?? [],
    discounts: extras.discounts ?? [],
    notes: extras.notes ?? [],
    ...(extras.frequency === undefined ? {} : { frequency: extras.frequency }),
    ...(extras.labelHe === undefined ? {} : { labelHe: extras.labelHe }),
    ...(extras.labelEn === undefined ? {} : { labelEn: extras.labelEn }),
    ...(extras.labelAr === undefined ? {} : { labelAr: extras.labelAr }),
    ...(text(amount, 'asOfDate') === undefined ? {} : { asOfDate: text(amount, 'asOfDate') as string }),
    ...(text(amount, 'sourceLabel') === undefined
      ? {}
      : { sourceLabel: text(amount, 'sourceLabel') as string }),
    ...(text(amount, 'registryId') === undefined
      ? {}
      : { registryId: text(amount, 'registryId') as string }),
    ...(text(amount, 'resolution') === undefined
      ? {}
      : { resolution: text(amount, 'resolution') as string }),
    ...(verdictOf(amount) === undefined ? {} : { consumabilityVerdict: verdictOf(amount) as string }),
  };
}

/**
 * A card-level cost from the product row's own `costs` block.
 *
 * These are the exactly-bound ones: the estate resolved each per card and recorded HOW in
 * `resolution`, including the 14 card-level exceptions it already applied. Nothing here re-applies
 * an exception — doing so would double-apply the estate's own arithmetic.
 */
function readingFromCardCost(field: string, costs: Row | undefined): FeeReading {
  const amount = record(costs?.[field]);
  if (amount === undefined) {
    return { field, state: 'NOT_AVAILABLE', candidates: [], reason: 'NO_PUBLISHED_ROW' };
  }
  const candidate = candidateFromAmount(amount);
  if (candidate === null) {
    /* `obtainable: false` with a `reason` is the estate saying it looked and there is nothing —
       which is a different statement from "no row", and never a zero. */
    return { field, state: 'NOT_AVAILABLE', candidates: [], reason: 'NO_VALUE_PUBLISHED' };
  }
  const usable = candidate.consumabilityVerdict === 'USABLE' && candidate.chip === 'VERIFIED';
  return {
    field,
    state: usable ? 'VERIFIED' : 'CONDITIONAL',
    single: candidate,
    candidates: [candidate],
    ...(usable ? {} : { reason: 'CONFLICTED' as const }),
  };
}

/**
 * Does this tariff row apply to this product?
 *
 * ISSUER first, always. Then the operator, because the `org:amex-il` join caveat says the two
 * scopes *"carry genuinely different fee terms (e.g. FX 2.9% vs 2.5%) and must not be merged"*.
 * A row naming an operator matches only a card run by that operator; a row naming none matches a
 * card whose operator the estate did not record. `excludedOperatorIds` is honoured in both cases.
 */
function feeRowApplies(row: Row, product: CatalogProduct): boolean {
  if (text(row, 'issuerOrgId') !== product.issuerOrgId) return false;
  const excluded = strings(row, 'excludedOperatorIds');
  if (product.operatingCardCompanyId !== undefined && excluded.includes(product.operatingCardCompanyId)) {
    return false;
  }
  const scope = text(row, 'scopeKind');
  if (scope === 'ISSUER_WIDE') return true;
  if (scope !== 'ALL_CARDS_OF_OPERATOR_AT_ISSUER') {
    /* NAMED_CARD_OR_LEVEL rows name a card by a display label the card row does not carry.
       Matching them would be matching a fee to a card by its NAME. Counted, never joined. */
    return false;
  }
  const operator = text(row, 'operatingCardCompanyId');
  return operator === undefined
    ? product.operatingCardCompanyId === undefined
    : operator === product.operatingCardCompanyId;
}

function readingFromTariff(field: string, product: CatalogProduct): FeeReading {
  const rows = catalogFeeRows().filter(
    (row) => text(row, 'field') === field && feeRowApplies(row, product),
  );
  if (rows.length === 0) {
    return { field, state: 'NOT_AVAILABLE', candidates: [], reason: 'NO_PUBLISHED_ROW' };
  }

  const candidates: FeeCandidate[] = [];
  for (const row of rows) {
    const amount = record(row['value']);
    if (amount === undefined) continue;
    const candidate = candidateFromAmount(amount, {
      levels: strings(row, 'cardLevels'),
      conditions: strings(row, 'conditions'),
      exemptions: strings(row, 'exemptions'),
      discounts: strings(row, 'discounts'),
      notes: strings(row, 'notes'),
      ...(text(row, 'frequency') === undefined ? {} : { frequency: text(row, 'frequency') as string }),
      ...(text(row, 'labelHe') === undefined ? {} : { labelHe: text(row, 'labelHe') as string }),
      ...(text(row, 'labelEn') === undefined ? {} : { labelEn: text(row, 'labelEn') as string }),
      ...(text(row, 'labelAr') === undefined ? {} : { labelAr: text(row, 'labelAr') as string }),
    });
    if (candidate !== null) candidates.push(candidate);
  }

  if (candidates.length === 0) {
    return { field, state: 'NOT_AVAILABLE', candidates: [], reason: 'NO_VALUE_PUBLISHED' };
  }

  /* IDENTICAL FIGURES ARE ONE ANSWER, NOT SEVERAL. Several rows can publish the same value under
     different level labels; that is one fee stated several times and the user should see one. */
  const distinct = new Set(candidates.map((c) => `${c.value}|${c.unit}|${c.frequency ?? ''}`));
  if (distinct.size === 1) {
    const single = candidates[0] as FeeCandidate;
    const conditional =
      single.consumabilityVerdict !== 'USABLE'
      || single.chip !== 'VERIFIED'
      || single.exemptions.length > 0
      || single.discounts.length > 0;
    return {
      field,
      state: conditional ? 'CONDITIONAL' : 'VERIFIED',
      single,
      candidates,
      ...(conditional ? { reason: 'CONFLICTED' as const } : {}),
    };
  }

  /* SEVERAL DIFFERENT FIGURES, and the difference is a card LEVEL the estate models on no field.
     The set is returned whole so the surface can show every one with its own label. */
  return { field, state: 'CONDITIONAL', candidates, reason: 'LEVEL_NOT_MODELLED' };
}

function waiversFor(product: CatalogProduct): readonly WaiverReading[] {
  return catalogWaiverRows()
    .filter((row) => text(row, 'issuerOrgId') === product.issuerOrgId)
    .map((row): WaiverReading => {
      const base = record(row['baseCardFeeIls']);
      const resulting = record(row['resultingFeeIls']);
      return {
        ruleId: text(row, 'ruleId') ?? 'unknown',
        appliesToFee: text(row, 'appliesToFee') ?? 'UNKNOWN',
        ruleType: text(row, 'ruleType') ?? 'UNKNOWN',
        calculationSafe: row['calculationSafe'] === true,
        ...(text(row, 'scopeText') === undefined ? {} : { scopeText: text(row, 'scopeText') as string }),
        ...(text(row, 'quote') === undefined ? {} : { quote: text(row, 'quote') as string }),
        ...(numberOf(base, 'value') === undefined
          ? {}
          : { baseCardFeeIls: numberOf(base, 'value') as number }),
        ...(numberOf(resulting, 'value') === undefined
          ? {}
          : { resultingFeeIls: numberOf(resulting, 'value') as number }),
        ...(text(row, 'notMachineUsableBecause') === undefined
          ? {}
          : { notMachineUsableBecause: text(row, 'notMachineUsableBecause') as string }),
      };
    });
}

const cardRowCosts = (cardId: string): Row | undefined =>
  record(catalogCardRows().find((row) => row['cardId'] === cardId)?.['costs']);

/**
 * The whole fee profile for one canonical product, or `undefined` for an id the catalog does not
 * hold. An unknown product is a caller defect; an unpublished fee is a fact, and they are
 * different returns.
 */
export function cardFeeProfileFor(cardId: string): CardFeeProfile | undefined {
  const product = catalogProductById(cardId);
  if (product === undefined) return undefined;
  const costs = cardRowCosts(cardId);

  return {
    cardId,
    issuerOrgId: product.issuerOrgId,
    ...(product.operatingCardCompanyId === undefined
      ? {}
      : { operatingCardCompanyId: product.operatingCardCompanyId }),
    cardFee: readingFromTariff('CARD_FEE', product),
    fxCommissionPct: readingFromCardCost('fxCommissionPct', costs),
    foreignAtmPct: readingFromCardCost('foreignAtmPct', costs),
    atmSameCurrencyFee: readingFromCardCost('atmSameCurrencyFee', costs),
    cashAdvanceFee: readingFromTariff('CASH_ADVANCE_FEE', product),
    replacementFee: readingFromTariff('REPLACEMENT_FEE', product),
    waivers: waiversFor(product),
  };
}

/**
 * How many `NAMED_CARD_OR_LEVEL` tariff rows this product's issuer publishes that nothing can bind.
 *
 * Reported rather than hidden: the data-gaps section of the campaign report is built from this,
 * and a number nobody can see is a gap that quietly becomes permanent.
 */
export function unbindableNamedFeeRowCount(issuerOrgId: string): number {
  return catalogFeeRows().filter(
    (row) => text(row, 'issuerOrgId') === issuerOrgId && text(row, 'scopeKind') === 'NAMED_CARD_OR_LEVEL',
  ).length;
}

/** The published consumer-credit interest observation for an organisation, where the estate has one. */
export function issuerInterestObservation(orgId: string): Row | undefined {
  return catalogInterestRows().find((row) => text(row, 'orgId') === orgId);
}
