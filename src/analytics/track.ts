import { ANALYTICS_EVENTS, isPermittedPropValue, type AnalyticsEvent, type PropsOf } from './events';
import { analyticsPermitted, type ConsentState } from './consent';
import { noOpTransport, type AnalyticsTransport } from './transport';

/**
 * THE ONE ANALYTICS BOUNDARY — criteria B6 and B7, Owner Decisions OD-5 and OD-8.
 *
 *   > **B6.** *"All instrumentation passes through **one** provider-agnostic `track(event, props)`
 *   > boundary; no vendor SDK is reachable from a screen, hook or engine."*
 *
 *   > **B7.** *"**No vault type can reach the `track()` boundary**; events allowlisted, props
 *   > primitive."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT REFUSES BEFORE IT SENDS, AND IT REFUSES WITHOUT CONSENT FIRST
 *
 * The order is deliberate. Consent is checked before the event is even validated, so an event that
 * would have been refused for a bad prop is not *examined* either — there is no path on which a
 * disallowed value is inspected, logged, or reported while analytics is off.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THERE IS NO QUEUE
 *
 *   > **OD-8.** *"Nothing collected, buffered or queued before consent."*
 *
 * A refused event is dropped and cannot be recovered. Not stored, not counted, not retried when
 * consent later arrives. The usual opt-in implementation buffers and flushes on grant, so the first
 * upload contains everything the user did before they agreed — a common pattern, forbidden here in
 * as many words.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE RESULT IS A VALUE AND NOT A THROW
 *
 * Instrumentation must never be able to take a screen down. A wrong `track` call is a bug in
 * telemetry, and a telemetry bug that crashes a verdict is worse than the missing data. So the
 * boundary returns a verdict the caller may ignore — and the tests, and the gate, do not ignore it.
 */

export type TrackOutcome =
  | { readonly sent: true; readonly outboundRequests: number }
  | {
      readonly sent: false;
      readonly reason: 'NO_CONSENT' | 'UNKNOWN_EVENT' | 'DISALLOWED_PROP';
      readonly why: string;
      /** Always zero. Present so "nothing was sent" is an assertion rather than an absence. */
      readonly outboundRequests: 0;
    };

export interface TrackContext {
  readonly consent: ConsentState;
  /** Supplied by the caller. This module never reads a clock. */
  readonly at: string;
  /** Defaults to the transport that ships, which sends nothing. */
  readonly transport?: AnalyticsTransport;
}

export function findLast4Carrier(value: unknown, path = 'props'): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(value, 'last4')) return path + '.last4';
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findLast4Carrier(value[i], path + '[' + i + ']');
      if (hit !== null) return hit;
    }
    return null;
  }
  for (const [key, nested] of Object.entries(value)) {
    const hit = findLast4Carrier(nested, path + '.' + key);
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Record one product-usage event, if everything about it is permitted.
 *
 * `props` is typed to the event, so an undeclared prop is a compile error. It is ALSO checked at
 * runtime, because a type assertion at a call site is one keystroke and the field that leaks is
 * never the one anybody planned to send.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  props: PropsOf<E>,
  context: TrackContext,
): TrackOutcome {
  // ── consent first, before the event is even examined ─────────────────────────────
  if (!analyticsPermitted({ state: context.consent })) {
    return {
      sent: false,
      reason: 'NO_CONSENT',
      outboundRequests: 0,
      why:
        `analytics consent is ${context.consent}. Nothing is collected, buffered or queued before ` +
        'consent — this event is dropped and cannot be recovered, because a queue that flushed on ' +
        'grant would upload everything the user did before they agreed.',
    };
  }

  // ── W7: last4 never leaves the vault via track(), even smuggled inside an object ─
  const last4At = findLast4Carrier(props);
  if (last4At !== null) {
    return {
      sent: false,
      reason: 'DISALLOWED_PROP',
      outboundRequests: 0,
      why:
        `last4 cannot leave the encrypted vault via track() (${last4At}). The only authorised ` +
        'path off the device is the user-initiated profile transfer.',
    };
  }

  if (!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS, event)) {
    return {
      sent: false,
      reason: 'UNKNOWN_EVENT',
      outboundRequests: 0,
      why: `"${String(event)}" is not a declared event. An allowlist that accepted an undeclared event would be a naming convention.`,
    };
  }

  const flat: Record<string, string | number | boolean> = {};
  for (const [prop, value] of Object.entries(props as Record<string, unknown>)) {
    const verdict = isPermittedPropValue(event, prop, value);
    if (!verdict.ok) {
      return { sent: false, reason: 'DISALLOWED_PROP', outboundRequests: 0, why: verdict.why };
    }
    flat[prop] = value as string | number | boolean;
  }

  const transport = context.transport ?? noOpTransport;
  const outboundRequests = transport.send({ event: String(event), props: flat, at: context.at });
  return { sent: true, outboundRequests };
}

/**
 * The transport that ships, named, for a gate and a diagnostic surface to read.
 *
 * No vendor SDK is a dependency of this app. OD-5 permits one; nobody has chosen one, and choosing
 * one carries a data-processing agreement that is not a campaign's to sign.
 */
export const activeTransportName = (): string => noOpTransport.name;
