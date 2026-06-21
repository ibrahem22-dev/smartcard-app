// /src/types/benefit.types.ts

import type { CardIssuer } from './card.types';
import type { PurchaseCategory } from './purchase.types';

/**
 * Discriminated union on `kind`. JSON-safe: every variant is plain data, so a
 * row from Agent 2's JSON pipeline (M4) deserializes straight into this shape
 * with no runtime construction.
 */
export type BenefitDiscount =
  | {
      readonly kind: 'percentage';
      /** Fraction off, e.g. 0.15 = 15%. */
      readonly rate: number;
      /** Optional cap on the discount value in ₪ (null = uncapped). */
      readonly maxDiscount: number | null;
    }
  | {
      readonly kind: 'fixed';
      /** Flat ₪ amount off. */
      readonly amount: number;
    };

/**
 * Conditions gating a benefit. All fields are plain, serializable data —
 * no predicate functions. The engine evaluates these against a purchase at
 * runtime; the JSON only carries the parameters.
 */
export interface BenefitConditions {
  /** Minimum purchase ₪ required to qualify (null = no minimum). */
  readonly minPurchaseAmount: number | null;
  /** Allowed merchant names; empty = any merchant. */
  readonly eligibleMerchants: readonly string[];
  /** Allowed days of week (0=Sun..6=Sat); empty = any day. */
  readonly eligibleDaysOfWeek: readonly number[];
  /** Cap on times the benefit applies per calendar month (null = unlimited). */
  readonly usesPerMonth: number | null;
  /** Whether the benefit applies only to תשלומים purchases. */
  readonly installmentsOnly: boolean;
}

/** A single card benefit/perk, as sourced from the M4 JSON pipeline. */
export interface Benefit {
  readonly benefitId: string;
  readonly issuer: CardIssuer;
  readonly category: PurchaseCategory;
  readonly title: string;
  readonly description: string;
  readonly discount: BenefitDiscount;
  readonly conditions: BenefitConditions;

  /** Validity window as ISO 8601 dates (yyyy-mm-dd). validTo null = open-ended. */
  readonly validFrom: string;
  readonly validTo: string | null;
  /** Soft-disable flag so the pipeline can retire a benefit without deleting it. */
  readonly isActive: boolean;
}

/** The full benefits dataset, loaded from JSON and passed to benefitsMatcher. */
export interface BenefitsDatabase {
  /** ISO 8601 timestamp of when the dataset was generated. */
  readonly generatedAt: string;
  readonly version: string;
  readonly benefits: readonly Benefit[];
}