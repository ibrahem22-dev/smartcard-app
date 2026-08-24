/**
 * THE ALLOWLIST — criterion B7, Owner Decision OD-5, Exec §9.4 rule 5.
 *
 *   > **B7.** *"**No vault type can reach the `track()` boundary**; events allowlisted, props
 *   > primitive."*
 *
 *   > **OD-5.** *"SmartCard may use an external privacy-safe analytics service for **non-sensitive
 *   > product-usage telemetry**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AN ALLOWLIST IS A CLOSED DOMAIN, NOT A NAMING CONVENTION
 *
 * The usual arrangement is `track('whatever_you_like', { ...anything })` and a rule in a wiki. That
 * rule is followed until somebody is debugging at 2am and adds one field. **The field that leaks is
 * never the one anybody planned to send.**
 *
 * So every event is declared here with the exact props it may carry, and the boundary refuses
 * anything else at runtime — not in review, not in a lint, at the call.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT MAY BE IN A PROP, AND WHY THE LIST IS THIS SHORT
 *
 * Numbers, booleans, and strings **from a declared closed set**. No free strings, because a free
 * string is where a card name, a merchant, an amount or an error message containing any of those
 * ends up. No objects and no arrays, because nesting hides the leaf that matters from a reviewer
 * reading a call site.
 *
 * A count is allowed — "how many cards does this user have" is product usage. A card id is not.
 */

/** The events this app may ever send. Adding one is a diff a reviewer sees. */
export const ANALYTICS_EVENTS = {
  app_opened: {
    /** Cold start, or resumed from background. A closed set, never a free string. */
    launch_kind: ['cold', 'warm'] as const,
  },
  verdict_completed: {
    /** How many cards took part. A COUNT, never an id. */
    card_count: 'number' as const,
    /** Whether the answer was complete. A verdict's honesty, not its content. */
    was_complete: 'boolean' as const,
  },
  consent_prompt_shown: {},
  consent_answered: {
    granted: 'boolean' as const,
  },
  pack_update_outcome: {
    /** The refusal CODE, from the import client's closed domain. Never the message. */
    outcome: ['imported', 'refused', 'rolled_back'] as const,
  },
  screen_viewed: {
    /** A route name from the app's own navigation, which is a closed set by construction. */
    route: ['Home', 'Wallet', 'Check', 'Plan', 'More'] as const,
  },
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;

/** The prop names an event may carry, derived from the declaration rather than repeated. */
export type PropsOf<E extends AnalyticsEvent> = {
  [K in keyof (typeof ANALYTICS_EVENTS)[E]]: (typeof ANALYTICS_EVENTS)[E][K] extends 'number'
    ? number
    : (typeof ANALYTICS_EVENTS)[E][K] extends 'boolean'
      ? boolean
      : (typeof ANALYTICS_EVENTS)[E][K] extends readonly (infer M)[]
        ? M
        : never;
};

/** Every declared event name, derived. A gate counts these rather than trusting a number. */
export const ANALYTICS_EVENT_NAMES = Object.keys(ANALYTICS_EVENTS) as readonly AnalyticsEvent[];

/**
 * Is this a value a prop may carry?
 *
 * Checked at the boundary, so a caller cannot smuggle an object through a type assertion. The type
 * system stops an honest mistake; this stops the 2am one.
 */
export function isPermittedPropValue(
  event: AnalyticsEvent,
  prop: string,
  value: unknown,
): { ok: true } | { ok: false; why: string } {
  const declaration = (ANALYTICS_EVENTS[event] as Record<string, unknown>)[prop];

  if (declaration === undefined) {
    return {
      ok: false,
      why:
        `"${prop}" is not a declared prop of "${event}". An allowlist that accepted an undeclared ` +
        'prop would be a naming convention, and the field that leaks is never the one anybody ' +
        'planned to send.',
    };
  }

  if (declaration === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
      ? { ok: true }
      : { ok: false, why: `"${prop}" must be a finite number, and was ${typeof value}.` };
  }

  if (declaration === 'boolean') {
    return typeof value === 'boolean'
      ? { ok: true }
      : { ok: false, why: `"${prop}" must be a boolean, and was ${typeof value}.` };
  }

  if (Array.isArray(declaration)) {
    return (declaration as readonly unknown[]).includes(value)
      ? { ok: true }
      : {
          ok: false,
          why:
            `"${prop}" must be one of ${JSON.stringify(declaration)} and was ` +
            `${JSON.stringify(value)}. A free string is where a card name, a merchant or an error ` +
            'message containing either of them ends up.',
        };
  }

  return { ok: false, why: `"${prop}" has an unrecognised declaration.` };
}
