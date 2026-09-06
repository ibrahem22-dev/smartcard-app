/**
 * HOW MANY ROWS A LIST SHOWS — and nothing else.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THESE THREE NUMBERS LIVE IN config/ RATHER THAN BESIDE THE LISTS THEY BOUND
 *
 * P2's boundary rule 4 and P3's `no-magic-numbers` both read a bare numeric literal in application
 * code as a rate, a fee or a threshold until something proves otherwise, and they are right to: a
 * threshold with no single home is a threshold that quietly disagrees with itself. The first
 * version of this campaign answered that by writing three entries into
 * `tools/p2/financial-literals.allow.json`, one per literal, each with a reason.
 *
 * P5's own `no-magic-numbers` gate refused that, and its refusal is the better argument:
 *
 *   > *"An exception carried from an earlier campaign is a reviewed decision; one a campaign writes
 *   > for its own new code is that campaign marking its own homework, and B3 is a claim about the
 *   > code rather than about the list."*
 *
 * So the allowlist entries are gone and the numbers moved here instead, which is what the rule
 * asked for in the first place. Nothing about them changed.
 *
 * NONE OF THESE IS A FINANCIAL THRESHOLD. No money is compared against them, no decision is taken
 * on them, and a card is neither preferred nor refused because of one. They bound the LENGTH OF A
 * LIST — how many search results a surface offers before it asks the user to type more, and how
 * many recently chosen merchants are worth remembering. Changing one changes how much scrolling a
 * user does and nothing else.
 */

/**
 * Merchant search results the adapter returns when a caller names no limit of its own.
 *
 * The taxonomy holds 266 merchants and a name fragment like "סופר" reaches dozens of them. A
 * search surface that returns all of them is a surface the user has to read instead of type.
 */
export const MERCHANT_SEARCH_RESULT_LIMIT = 8;

/**
 * Rows Merchant Radar shows while the user is typing.
 *
 * Smaller than the adapter's own default on purpose: the Radar's list sits above the amount field
 * inside the Check flow, and a longer one pushes the thing the user came to do below the fold.
 */
export const MERCHANT_RADAR_RESULT_LIMIT = 6;

/**
 * Recently chosen merchants kept per profile.
 *
 * Local-first, on the device, canonical ids only. Five is what fits one row of chips without
 * wrapping; it is not a retention policy and nothing is deleted anywhere else because of it.
 */
export const RECENT_MERCHANT_LIMIT = 5;
