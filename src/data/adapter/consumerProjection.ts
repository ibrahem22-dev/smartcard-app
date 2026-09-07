/**
 * THE CONSUMER-SAFE PROJECTION — raw canonical row in, reader-facing object out.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS
 *
 * A canonical pack is a research artefact as well as a product one. Beside the Hebrew title a
 * reader is meant to see, a benefit row carries the analyst's English note about how it was
 * extracted (`description`), the sentence explaining which product ids the source pinned
 * (`scopeBasis`), and the method by which the card link was made (`cardLinkMethod`). A contact row
 * carries, on every field, the provenance `quote` it was read from and the analyst's `note` about
 * the issuer's website. An interest row carries `appTreatment` — an instruction addressed to this
 * app, in English, in the data.
 *
 * None of that is consumer copy, and the app shipped two leaks of it before this module existed:
 * PD-MDC-082 on the Learn screen (artifact #7) and `benefit.description` on the Benefits Hub (found
 * during the unified upgrade). Both had the same shape — an adapter type aliased straight to the
 * pack row:
 *
 *     export type BenefitView = AdapterBenefit;   // ← the whole row, research notes included
 *
 * A surface handed that alias holds every field the estate ships, and rendering one is a single
 * keystroke away at all times. Nothing in the type system, and nothing in review, distinguishes
 * `benefit.titleHe` from `benefit.description`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE PROJECTION GUARANTEES
 *
 * A projection is an EXPLICIT list of field names and a function that builds a NEW object holding
 * only those fields. Both halves matter:
 *
 *   · the list makes the type carry only consumer-safe fields, so `row.description` does not
 *     compile on a surface;
 *   · the copy makes the runtime object hold only consumer-safe fields, so nothing rides along
 *     into a `JSON.stringify`, a test snapshot, a crash log or an accessibility label.
 *
 * The lists are declared here, `as const`, and `tools/mdc/gates/pack-text-boundary.mjs` reads them
 * out of this file and checks them against the census of the shipped packs: a field classified
 * INTERNAL in `packTextRegister.json` may not appear in a projection, and a pack field nobody has
 * classified fails the gate before it can be projected at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS NOT DELETED
 *
 * Nothing. The research material stays in the packs, where it belongs and where the pipeline, the
 * audits and `DataPrivacyScreen`'s provenance surface can still read it. This module governs what
 * REACHES A READER, which is a different question from what the app carries.
 */
import type {
  AdapterBenefit,
  AdapterContact,
  AdapterGlossaryTerm,
  AdapterMerchant,
  AdapterRight,
  SourcedValue,
} from '@smartcard/data-authority-adapter';

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- a pack row is data, not a promise
   the type made: a field the type declares required can still be missing in a shipped row, and the
   copy below must not turn that into an own property whose value is `undefined`. */

// ── the field lists ───────────────────────────────────────────────────────────────────────────
//
// EXCLUDED FROM `BENEFIT_CONSUMER_FIELDS`, each for a stated reason:
//   description         English-only research annotation about the SOURCE (the artifact #8 leak)
//   scopeBasis          "The source pins 1 specific product id(s): cal_365_vip" — analyst prose
//   benefitSource       which extraction wave produced the row
//   cardLinkMethod      how the card link was made — a pipeline fact, not a customer fact
//   valueCorroboratedBy the corroborating excerpt, in the analyst's words
export const BENEFIT_CONSUMER_FIELDS = [
  'benefitId',
  'orgId',
  'titleHe',
  'titleEn',
  'titleAr',
  'benefitType',
  'scope',
  'lifecycleStatus',
  'validFrom',
  'validUntil',
  'verificationStatus',
  'provenanceChip',
  'consumability',
  'cardIds',
  'cardIdsExcludedCount',
  'cardIdsAbsentCount',
  'eligibleMerchantIds',
  'eligibleMerchantsUnresolved',
  'programmeRef',
  'programmeResolution',
  'stacking',
  'value',
  'valueSuppressedBecause',
] as const;

// EXCLUDED: canonicalCategoryBasis (why the category is what it is — a pipeline note),
//           nameArEvidence (the Arabic-name research wave's own quote and preserved-copy path).
export const MERCHANT_CONSUMER_FIELDS = [
  'merchantId',
  'canonicalName',
  'entityKind',
  'canonicalCategory',
  'aliases',
  'nameHe',
  'nameAr',
  'nameEn',
  'provenanceChip',
  'verificationStatus',
] as const;

// EXCLUDED: arabicSource, definitionSource (SourcedValue provenance records), notes (analyst).
export const GLOSSARY_CONSUMER_FIELDS = [
  'termId',
  'he',
  'en',
  'ar',
  'definitionHe',
  'definitionEn',
  'definitionAr',
  'arabicStatus',
  'verificationStatus',
  'seeAlso',
] as const;

export const RIGHT_CONSUMER_FIELDS = [
  'topicId',
  'titleHe',
  'titleEn',
  'titleAr',
  'summaryHe',
  'summaryEn',
  'summaryAr',
  'appliesTo',
  'whatTheLawSays',
  'whatToDo',
  'whoToContact',
  'deadlines',
  'caveat',
  'verificationStatus',
] as const;

/**
 * A sourced value, reduced.
 *
 * `value` is the published fact and the only part a reader is shown. `sourceUrl` and
 * `publicationDate` are citations a reader can follow. `sourceLabel`, `quote`, `note`,
 * `registryId` and `accessedAt` are the research record: the label of the document, the sentence it
 * was read from, the analyst's remark about the site, the registry citation and when it was
 * fetched. `content.contacts.customerServicePhone.quote` is 15 rows of exactly that.
 *
 * THE ABSENCE REASON DOES NOT COME FROM THE PACK. Where a value is missing, the surface says so in
 * the reader's language — *"לא פורסם מספר טלפון רשמי לחברה הזאת"* — rather than printing the
 * estate's English note, which is a sentence about a website and not an answer to the reader.
 */
export interface ConsumerSourcedValue {
  readonly value?: string;
  readonly sourceUrl?: string;
  readonly publicationDate?: string;
  /** WHEN the citation was captured. A date is a citation, not prose. */
  readonly accessedAt?: string;
  readonly verificationStatus?: string;
  /** TRUE where the estate recorded an evidenced absence rather than never having looked. */
  readonly evidencedAbsence: boolean;
}

export type BenefitConsumerView = Pick<
  AdapterBenefit,
  (typeof BENEFIT_CONSUMER_FIELDS)[number]
>;
export type MerchantConsumerView = Pick<
  AdapterMerchant,
  (typeof MERCHANT_CONSUMER_FIELDS)[number]
>;
export type GlossaryConsumerView = Pick<
  AdapterGlossaryTerm,
  (typeof GLOSSARY_CONSUMER_FIELDS)[number]
>;
export type RightConsumerView = Pick<AdapterRight, (typeof RIGHT_CONSUMER_FIELDS)[number]>;

/** Every `SourcedValue` field of a contact row, reduced; the plain fields carried through. */
export type ContactConsumerView = {
  readonly [K in keyof AdapterContact]: AdapterContact[K] extends SourcedValue | undefined
    ? ConsumerSourcedValue | undefined
    : AdapterContact[K];
};

// ── the projections ───────────────────────────────────────────────────────────────────────────

function pick<T extends object, K extends readonly (keyof T)[]>(
  row: T,
  fields: K,
): Pick<T, K[number]> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = row[field];
    // `exactOptionalPropertyTypes` is on: an absent optional field must stay absent, not become an
    // own property holding `undefined`. The two are different objects to `Object.keys`, to
    // `JSON.stringify` and to every test that asserts what a projection carries.
    if (value !== undefined) out[field as string] = value;
  }
  return out as Pick<T, K[number]>;
}

export function projectSourcedValue(raw: SourcedValue | undefined): ConsumerSourcedValue | undefined {
  if (raw === undefined) return undefined;
  const out: {
    value?: string;
    sourceUrl?: string;
    publicationDate?: string;
    accessedAt?: string;
    verificationStatus?: string;
    evidencedAbsence: boolean;
  } = { evidencedAbsence: raw.value === undefined && raw.note !== undefined };
  if (raw.value !== undefined) out.value = raw.value;
  if (raw.sourceUrl !== undefined) out.sourceUrl = raw.sourceUrl;
  if (raw.publicationDate !== undefined) out.publicationDate = raw.publicationDate;
  if (raw.accessedAt !== undefined) out.accessedAt = raw.accessedAt;
  if (raw.verificationStatus !== undefined) out.verificationStatus = raw.verificationStatus;
  return out;
}

export function projectBenefit(row: AdapterBenefit): BenefitConsumerView {
  return pick(row, BENEFIT_CONSUMER_FIELDS);
}

export function projectMerchant(row: AdapterMerchant): MerchantConsumerView {
  return pick(row, MERCHANT_CONSUMER_FIELDS);
}

export function projectGlossaryTerm(row: AdapterGlossaryTerm): GlossaryConsumerView {
  return pick(row, GLOSSARY_CONSUMER_FIELDS);
}

export function projectRight(row: AdapterRight): RightConsumerView {
  return pick(row, RIGHT_CONSUMER_FIELDS);
}

/** A `SourcedValue`-shaped field of a contact row, by name. */
const CONTACT_SOURCED_FIELDS = [
  'legalNameHe',
  'legalNameEn',
  'legalNameAr',
  'officialWebsite',
  'arabicSiteUrl',
  'customerServicePhone',
  'customerServiceHours',
  'cardLostStolenPhone',
  'complaintsEmail',
  'complaintsCommissionerUrl',
  'disputeChannelUrl',
  'accessibilityStatementUrl',
] as const;

export function projectContact(row: AdapterContact): ContactConsumerView {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if ((CONTACT_SOURCED_FIELDS as readonly string[]).includes(key)) {
      const projected = projectSourcedValue(value as SourcedValue | undefined);
      if (projected !== undefined) out[key] = projected;
      continue;
    }
    // `notes` and `historicalNote` are the analyst's own remarks on the row and are dropped with
    // every other unclassified plain field: only the fields named below survive.
    if (key === 'notes' || key === 'historicalNote') continue;
    if (value !== undefined) out[key] = value;
  }
  return out as ContactConsumerView;
}
