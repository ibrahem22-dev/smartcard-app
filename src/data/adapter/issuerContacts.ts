/**
 * ISSUER CONTACT CHANNELS, FROM THE SHIPPED CONTENT PACK — the Negotiation Hub's only source.
 *
 * Eighteen `contacts` rows, each field a `SourcedValue`: a value, the URL it was read from, the
 * verbatim quote, the date it was accessed, and a verification status. Nothing in this module
 * types a phone number. Every digit a user can dial came off a page the pipeline captured, and the
 * evidence travels with it so a surface can show WHERE it came from.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE OWNER'S CANDIDATE NUMBERS ARE NOT IN THIS FILE, AND THAT IS THE POINT
 *
 * The campaign directive supplied three candidates — MAX `*6969`, CAL `*4554`, Isracard `*6464` —
 * and instructed that they be treated as candidates rather than production truth until verified
 * against an official source. The shipped corpus, whose rows were captured from the issuers' own
 * contact pages on 2026-08-19 and carry `VERIFIED_OFFICIAL`, disagrees with all three:
 *
 *   · `org:max` publishes `03-6178888` and notes in as many words that *"max publishes NO *NNNN
 *     star number for its own cardholder service"*;
 *   · `org:cal` publishes `03-5726444`; the only `4554` anywhere in the corpus is `03-6364554`,
 *     which the `org:amex-il` row records as a COLLECTIONS desk, not a service line;
 *   · `org:isracard` publishes `*6272`, and `6464` appears nowhere in the pack.
 *
 * So the app ships what the estate verified, and the three candidates are reported as unresolved
 * contact facts for the Owner rather than shipped, ignored, or quietly merged.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * PARSING A HUMAN SENTENCE INTO A DIALABLE NUMBER IS A DERIVATION, SO IT IS NAMED AS ONE
 *
 * `customerServicePhone.value` is prose: `03-6178888 (טלפון); 054-5408881 (WhatsApp)`. Splitting it
 * is not reading a field, it is deriving two facts from one string, and a derivation that quietly
 * fails is how a wrong number gets dialled. So each channel comes back with the exact substring it
 * was taken from, and a value this module cannot parse yields NO channel rather than a guess.
 */
import {
  openContentSlices,
  type AdapterContact,
  type PackDocument,
  type SourcedValue,
} from '@smartcard/data-authority-adapter';

import contentPackJson from './packs/content/pack.json';

import { projectContact, type ContactConsumerView } from './consumerProjection';

import { CardIssuer } from '../../types/card.types';
import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';

/**
 * The reader-facing contact row. A PROJECTION: every `SourcedValue` field is reduced to the
 * published value and its citation, and the research record beside it — the `quote` it was read
 * from, the analyst's `note` about the issuer's website, the `sourceLabel` of the document — is
 * dropped at the boundary. See consumerProjection.ts.
 */
export type IssuerContactRow = ContactConsumerView;

/**
 * THE THREE CARD ISSUERS THIS APP MODELS, AS CANONICAL ORGANISATION IDS.
 *
 * `CardIssuer` is the app's own three-member enum (`max` · `isracard` · `cal`) and `org:*` is the
 * estate's key. The bridge is declared once, here, beside the only consumer of the estate's
 * contact rows — the same shape `ISSUER_DATABASE_KEYS` already uses in `benefitLookup.ts`, and for
 * the same reason: an issuer rename must not desynchronise two independent spellings.
 */
export const ISSUER_ORG_IDS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: 'org:max',
  [CardIssuer.Isracard]: 'org:isracard',
  [CardIssuer.Cal]: 'org:cal',
};

const contentPack = contentPackJson as PackDocument;

let contactsMemo: readonly IssuerContactRow[] | null = null;

function readContacts(): readonly IssuerContactRow[] {
  if (contactsMemo === null) {
    assertPinnedAdapter();
    contactsMemo = openContentSlices(contentPack, {
      expectedDatasetId: EXPECTED_DATASET_ID,
    })
      .contacts.all()
      .map(projectContact);
  }
  return contactsMemo;
}

/** Every issuer/bank contact row the shipped content pack holds. */
export function allIssuerContacts(): readonly IssuerContactRow[] {
  return readContacts();
}

/** One row by canonical organisation id (`org:max`), or `undefined`. Absence is an answer. */
export function issuerContactByOrgId(orgId: string): IssuerContactRow | undefined {
  return readContacts().find((row) => row.orgId === orgId);
}

/**
 * A dialable or messageable channel, WITH the evidence it was derived from.
 *
 * `raw` is the exact substring of the pack's own value this channel came out of, so a reader can
 * see the sentence as well as the number.
 */
export interface IssuerChannel {
  readonly kind: 'phone' | 'whatsapp';
  /** As the estate published it, for display. Never reformatted for the eye. */
  readonly display: string;
  /** The URI the user's tap opens. Built here, once, so no surface assembles one. */
  readonly uri: string;
  /** The exact substring of the pack value this was read out of. */
  readonly raw: string;
}

export interface IssuerNegotiationContact {
  readonly orgId: string;
  readonly slug: string;
  readonly legalNameHe?: string;
  readonly legalNameEn?: string;
  readonly legalNameAr?: string;
  readonly phone?: IssuerChannel;
  readonly whatsapp?: IssuerChannel;
  readonly hours?: string;
  /** The pack's own verification status for the service-phone field. */
  readonly verificationStatus?: string;
  readonly sourceUrl?: string;
  readonly accessedAt?: string;
  /*
   * THE PACK'S `quote` IS NOT HERE, AND WAS.
   *
   * `content.contacts.*.quote` is a MIXED field: for `customerServicePhone` its 15 values are the
   * issuer's own Hebrew sentence, and for `arabicSiteUrl` and `complaintsEmail` several are the
   * analyst describing an absence in English — "no Arabic link in the served markup", "e-mail
   * rendered through an anti-scrape obfuscator". One field, two kinds of text, and no way for a
   * surface to tell which it holds. It was carried onto this row and rendered by nothing; carrying
   * it kept a leak one keystroke away for no gain. The citation a reader is offered is `sourceUrl`
   * and `accessedAt`, which the Negotiation Hub prints.
   */
  /** Present when no channel could be derived, saying why. */
  readonly absence?: 'NO_PUBLISHED_VALUE' | 'NO_PARSEABLE_NUMBER';
}

/**
 * A number as the Israeli corpus writes them.
 *
 * Three shapes and no more: a `*NNNN` short code, a national number with an optional hyphen, and
 * an international `+972` form. Anything else is left unparsed, which is the honest outcome for a
 * string this module was not written to understand.
 */
const NUMBER_TOKEN = /(\*\d{3,5}|\+972[-\s]?\d[-\s]?\d{7}|0\d{1,2}-?\d{7})/;

const WHATSAPP_LABEL = /whats\s*app|וואטסאפ|واتساب/i;

/** Digits only, for a URI. Visual separators are display, not data. */
function digitsOf(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * `tel:` for anything dialable, including a star code.
 *
 * RFC 3966 permits `*` in a phone-subscriber, which is what an Israeli `*NNNN` service line is,
 * and stripping it would dial a four-digit number that is not the issuer.
 */
function telUri(display: string): string {
  return `tel:${display.replace(/[\s()]/g, '')}`;
}

/**
 * `https://wa.me/<E.164 digits>` — DERIVED, and only from a national mobile number.
 *
 * Dropping the national trunk `0` and prefixing `972` is the documented rendering of an Israeli
 * national number in E.164; it is arithmetic on a format, not a new fact. A `*NNNN` short code has
 * no international form, so it yields no WhatsApp channel rather than a fabricated one.
 */
function whatsappUri(display: string): string | undefined {
  const digits = digitsOf(display);
  if (display.trim().startsWith('*')) return undefined;
  if (digits.startsWith('972')) return `https://wa.me/${digits}`;
  if (digits.startsWith('0') && digits.length >= 9) return `https://wa.me/972${digits.slice(1)}`;
  return undefined;
}

/** Split the pack's prose value into its labelled segments, in the order it wrote them. */
function segmentsOf(value: string): readonly string[] {
  return value
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function channelsFrom(value: string): {
  readonly phone?: IssuerChannel;
  readonly whatsapp?: IssuerChannel;
} {
  let phone: IssuerChannel | undefined;
  let whatsapp: IssuerChannel | undefined;

  for (const segment of segmentsOf(value)) {
    const token = NUMBER_TOKEN.exec(segment)?.[1];
    if (token === undefined) continue;
    if (WHATSAPP_LABEL.test(segment)) {
      if (whatsapp === undefined) {
        const uri = whatsappUri(token);
        if (uri !== undefined) whatsapp = { kind: 'whatsapp', display: token, uri, raw: segment };
      }
      continue;
    }
    if (phone === undefined) phone = { kind: 'phone', display: token, uri: telUri(token), raw: segment };
  }

  return {
    ...(phone === undefined ? {} : { phone }),
    ...(whatsapp === undefined ? {} : { whatsapp }),
  };
}

function textOf(sourced: SourcedValue | undefined): string | undefined {
  const value = sourced?.value;
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * The contact a Negotiation Hub can act on, for one organisation.
 *
 * Returns `undefined` only when the corpus holds no row for the organisation at all. A row with no
 * usable number still comes back — with `absence` saying which kind of nothing it is — because the
 * rest of the Hub (the fee facts, the scripts to copy) is still useful without a phone.
 */
export function negotiationContactFor(orgId: string): IssuerNegotiationContact | undefined {
  const row = issuerContactByOrgId(orgId);
  if (row === undefined) return undefined;

  const service = row.customerServicePhone;
  const value = textOf(service);
  const channels = value === undefined ? {} : channelsFrom(value);
  const absence: IssuerNegotiationContact['absence'] =
    value === undefined
      ? 'NO_PUBLISHED_VALUE'
      : channels.phone === undefined && channels.whatsapp === undefined
        ? 'NO_PARSEABLE_NUMBER'
        : undefined;

  return {
    orgId: row.orgId,
    slug: row.slug,
    ...(textOf(row.legalNameHe) === undefined ? {} : { legalNameHe: textOf(row.legalNameHe) as string }),
    ...(textOf(row.legalNameEn) === undefined ? {} : { legalNameEn: textOf(row.legalNameEn) as string }),
    ...(textOf(row.legalNameAr) === undefined ? {} : { legalNameAr: textOf(row.legalNameAr) as string }),
    ...channels,
    ...(textOf(row.customerServiceHours) === undefined
      ? {}
      : { hours: textOf(row.customerServiceHours) as string }),
    ...(service?.verificationStatus === undefined
      ? {}
      : { verificationStatus: service.verificationStatus }),
    ...(service?.sourceUrl === undefined ? {} : { sourceUrl: service.sourceUrl }),
    ...(service?.accessedAt === undefined ? {} : { accessedAt: service.accessedAt }),
    ...(absence === undefined ? {} : { absence }),
  };
}
