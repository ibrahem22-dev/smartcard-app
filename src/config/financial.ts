/**
 * THE ONE PLACE A FINANCIAL CONSTANT MAY LIVE IN THIS APP — criterion D5.
 *
 * Execution Model §9.4 rule 4:
 *
 *   > No numeric literal that looks like a rate, fee or threshold outside `config/**` and the packs
 *   > (allowlist the genuine exceptions, explicitly).
 *
 * WHY A SEPARATE FILE RATHER THAN "KEEP THEM NEAR THEIR ENGINE". Before this, nine constants sat in
 * five engine modules, each next to the code that used it, each looking entirely reasonable in
 * place. That is exactly the arrangement in which two of them can disagree and nobody notices,
 * because no reader ever sees them side by side. Collected here, `0.25` appearing twice with two
 * different meanings is visible in one screenful.
 *
 * WHAT THIS FILE IS NOT.
 *
 * It is **not** the packs. A number here is a POLICY THRESHOLD the app applies — "warn when the
 * commitment exceeds a quarter of income" — not a fact about a card. Every fact about a card is a
 * pack row read through the adapter (D1), and moving one here would be re-deriving an interface the
 * handoff §2 forbids re-deriving.
 *
 * It is **not** an engine. P2 renders facts and refusals; contract §1 puts every derivation in P3.
 * These values are inputs the engines will read, not calculations.
 *
 * EVERY CONSTANT CARRIES ITS PROVENANCE. A threshold with no stated source is a number somebody
 * chose once, and the next person cannot tell a legal limit from a guess. Where the source is a
 * product decision rather than a law, the comment says so plainly rather than dressing it up.
 */

/**
 * The Israeli legal maximum annual interest rate for consumer credit.
 *
 * SOURCE: statutory. This is the one value here that is not a product choice, and it is the reason
 * the ceiling exists at all — an app that accepted 45% would be accepting an input the law does not
 * permit a lender to charge.
 */
export const CONSUMER_CREDIT_ANNUAL_RATE_MAX_PCT = 30;

/** The floor of the same range. Zero interest is legal; negative is not a rate. */
export const CONSUMER_CREDIT_ANNUAL_RATE_MIN_PCT = 0;

/**
 * The monetary range the app will accept as a purchase, income or obligation amount, in shekels.
 *
 * SOURCE: product decision. `0.01` is one agora — the smallest amount that can be charged — and the
 * ceiling is an input-sanity bound, not a claim about anyone's finances.
 */
export const MONETARY_MIN_ILS = 0.01;
export const MONETARY_MAX_ILS = 999_999;

/**
 * Installment-commitment thresholds, as a fraction of monthly income.
 *
 * SOURCE: product decision. These decide whether a commitment is shown as fine, as a caution, or as
 * blocked. They are the app's opinion about prudence, not a fact about the user, and P3's engines
 * read them rather than embedding them.
 */
export const INSTALLMENT_WARNING_RATIO_OF_INCOME = 0.25;
export const INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME = 0.35;
export const INSTALLMENT_BLOCKED_RATIO_OF_INCOME = 0.5;

/**
 * Purchase-gate ratios.
 *
 * SOURCE: product decision. `warningBufferRatioOfIncome` is the cash cushion below which a purchase
 * earns a caution; the utilization ratios are fractions of the credit line.
 */
export const PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME = 0.1;
export const PURCHASE_WAIT_24H_RATIO_OF_INCOME = 0.25;
export const PURCHASE_BLOCKED_UTILIZATION_RATIO = 0.9;
export const PURCHASE_WARNING_UTILIZATION_RATIO = 0.7;

/**
 * Loan burden bands, as a percentage of monthly income.
 *
 * SOURCE: product decision. Below the first is "low", below the second is "moderate", above is
 * "high". Percentages rather than fractions because that is how the loan surface states them.
 */
export const LOAN_BURDEN_LOW_MAX_PCT_OF_INCOME = 30;
export const LOAN_BURDEN_MODERATE_MAX_PCT_OF_INCOME = 50;

/**
 * Card-role heuristics.
 *
 * SOURCE: product decision. A card is treated as travel-friendly below the fee threshold and as
 * cashback-oriented above the rate threshold. **These are thresholds the app applies to a fact, not
 * the fact itself** — the fee and the rate come from the packs through the adapter.
 */
export const CARD_ROLE_LOW_FOREIGN_FEE_MAX = 0.015;
export const CARD_ROLE_CASHBACK_MIN_RATE = 0.02;
export const CARD_ROLE_HIGH_FX_PCT = 2;

/**
 * The window, in days, in which a returned charge is still expected to appear on a statement.
 *
 * SOURCE: product decision, informed by Israeli issuer practice. A calendar constant rather than a
 * money one, but it decides what the cashflow surface shows and belongs with the rest.
 */
export const CHARGE_RETURN_WINDOW_DAYS = 7;

/**
 * Validation bounds for a profile transferred between devices.
 *
 * SOURCE: the ranges above. They are stated separately because the codec validates a payload it did
 * not produce, and a validator that imported the same constant it is checking against would agree
 * with a corrupted payload that happened to carry the constant.
 */
export const TRANSFER_RATE_MAX_PCT = CONSUMER_CREDIT_ANNUAL_RATE_MAX_PCT;
export const TRANSFER_FX_COMMISSION_MAX_PCT = 10;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// INPUT BOUNDS FOR THE CARD FORM
//
// These were literals inside src/screens/CardDetailScreen.tsx, and four of them were literal
// DUPLICATES of constants already defined above — a form validating an interest rate against a bare
// `30` while CONSUMER_CREDIT_ANNUAL_RATE_MAX_PCT sat in this file saying the same thing. One fact,
// two homes, no comparison. The E1 boundary lint's R4 flagged the two that were not duplicates; the
// duplicates it could not see, because a repeated correct number does not look wrong until somebody
// changes one of them.
//
// PROVENANCE: these are PRODUCT DECISIONS about what a person may type into a form, not statutory
// limits. They bound input; they do not compute anything.

/** A monthly card fee above this is treated as a typo rather than a fee. Product decision. */
export const CARD_MONTHLY_FEE_MAX_ILS = 9_999;

/** A percentage discount cannot exceed the whole. Arithmetic, not a product decision. */
export const DISCOUNT_PERCENT_MAX = 100;

/** A credit limit above this is treated as a typo. Product decision. */
export const CREDIT_LIMIT_MAX_ILS = 9_999_999;

/**
 * HOW MANY DECIMALS AN AMOUNT SHOWS. Two — the agora.
 *
 * It reads like typography and it is not. At 0 decimals the app would render ₪1,234.56 as
 * ₪1,235, which is a false statement about an amount by up to half a shekel, on every screen at
 * once. The boundary lint flagged it in src/utils/money.ts and was right to: the test this
 * campaign applies is whether the number, if wrong, could tell a user something false about
 * their money, and this one can.
 */
export const MONEY_FRACTION_DIGITS = 2;

/**
 * How many decimals a PERCENTAGE shows, at most. Trailing zeros are dropped: unlike money,
 * 2.5% and 2.50% read identically and the shorter form is what every issuer publishes.
 */
/**
 * PERCENT PER UNIT — the factor between a ratio and the percentage a reader sees.
 *
 * Here rather than in the formatter because R4 says so, and R4 is right about this one: the
 * hundred IS the unit relationship, and the unit relationship is exactly what OQ-P5-003 got
 * wrong for the length of a campaign. A financial constant with a name is harder to apply twice
 * or not at all than a literal 100 sitting in a format string.
 */
export const PERCENT_PER_UNIT = 100;

export const PERCENT_MAX_FRACTION_DIGITS = 2;

/** Days in the longest month — a billing day outside this is not a date. */
export const BILLING_DAY_MIN = 1;
export const BILLING_DAY_MAX = 31;
